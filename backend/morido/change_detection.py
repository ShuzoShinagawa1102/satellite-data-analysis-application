"""
盛土監視Ops – NDVI 時系列変化検出エンジン

Sentinel-2 の B04(Red) と B08(NIR) バンドから NDVI を計算し、
2時期の差分から地表被覆の変化（盛土・造成候補）を検出する。

手法:
  1. STAC API で「前期」「後期」それぞれ雲量が少ないシーンを1枚ずつ選定
  2. 各シーンの COG (Cloud Optimized GeoTIFF) から B04/B08 を読み取り
  3. NDVI = (NIR - Red) / (NIR + Red) を計算
  4. ΔNDVI = NDVI_after - NDVI_before を算出
  5. ΔNDVI < threshold の領域（植生が消失した箇所）を候補とする
  6. 近接ピクセルをクラスタリングし、位置・面積・リスクスコアを算出

精度に関する既知の制約:
  - 季節による植生変化（落葉等）を盛土と誤判定する場合がある
    → 対策: 同一シーズンの異年比較をデフォルトにする
  - 雲・影が残る場合がある → SCL マスクでの除外は将来課題
  - 都市部は建物影の影響を受けやすい
  - 概観レベル (overview) で処理するため位置精度は 80m 程度
"""

import logging
import os
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import requests

logger = logging.getLogger(__name__)

# ── GDAL 設定: COG over HTTPS を効率的に読むため ──
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
os.environ.setdefault("GDAL_HTTP_TIMEOUT", "60")
os.environ.setdefault("GDAL_HTTP_MERGE_CONSECUTIVE_RANGES", "YES")

try:
    import rasterio
    from rasterio.warp import transform_bounds
    from rasterio.windows import from_bounds

    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False
    logger.warning(
        "rasterio が未インストールです。NDVI 変化検出を利用するには "
        "`pip install rasterio numpy` を実行してください。"
    )

from .satellite_client import (
    DEFAULT_BBOX_TOKYO,
    REQUEST_TIMEOUT,
    SENTINEL2_COLLECTION,
    STAC_API_URL,
    search_sentinel2_scenes,
)

# ── 定数 ──
DEFAULT_NDVI_THRESHOLD = -0.25  # ΔNDVI がこれ以下なら「植生消失」と判定
DEFAULT_OVERVIEW_FACTOR = 8  # 10m × 8 = 80m 解像度で処理 (速度と精度の妥協点)
DEFAULT_MIN_CLUSTER_PIXELS = 3  # 最小クラスタサイズ (これ以下のクラスタは除外)
SENTINEL2_SCALE_FACTOR = 10000  # Sentinel-2 L2A の反射率スケール


# ==========================================================================
# Step 1: シーン選定
# ==========================================================================


def find_best_scene(
    bbox: list[float],
    date_from: str,
    date_to: str,
    max_cloud_cover: float = 20.0,
) -> Optional[dict]:
    """指定期間・BBOX で最も雲量が少ない Sentinel-2 シーンを選定"""
    result = search_sentinel2_scenes(
        bbox=bbox,
        date_from=date_from,
        date_to=date_to,
        max_cloud_cover=max_cloud_cover,
        limit=5,
    )

    features = result.get("features", [])
    if not features:
        return None

    best = min(
        features,
        key=lambda f: f["properties"].get("cloud_cover", 100) or 100,
    )
    return best


# ==========================================================================
# Step 2: バンド URL 取得
# ==========================================================================


def get_band_urls(scene_id: str) -> dict:
    """STAC Item から B04(red) / B08(nir) 等のバンド COG URL を取得"""
    resp = requests.get(
        f"{STAC_API_URL}/collections/{SENTINEL2_COLLECTION}/items/{scene_id}",
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    item = resp.json()
    assets = item.get("assets", {})
    return {
        "red": assets.get("red", {}).get("href", ""),
        "nir": assets.get("nir", {}).get("href", ""),
        "scl": assets.get("scl", {}).get("href", ""),
        "datetime": item.get("properties", {}).get("datetime", ""),
        "cloud_cover": item.get("properties", {}).get("eo:cloud_cover"),
        "scene_id": scene_id,
    }


# ==========================================================================
# Step 3: COG バンド読み取り
# ==========================================================================


def read_band_window(
    url: str,
    bbox_wgs84: list[float],
    overview_factor: int = DEFAULT_OVERVIEW_FACTOR,
) -> tuple[np.ndarray, dict]:
    """
    Cloud Optimized GeoTIFF から指定 BBOX 領域のバンドデータを読み取る。
    overview レベルを使って高速化 (80m 解像度)。

    Args:
        url: COG の HTTPS URL
        bbox_wgs84: [lon_min, lat_min, lon_max, lat_max] (WGS84)
        overview_factor: 解像度の間引き率

    Returns:
        (data_array, geo_info_dict)
    """
    if not HAS_RASTERIO:
        raise RuntimeError("rasterio が必要です: pip install rasterio")

    with rasterio.open(url) as src:
        # WGS84 bbox → ソース CRS (通常 UTM)
        src_bbox = transform_bounds("EPSG:4326", src.crs, *bbox_wgs84)

        window = from_bounds(*src_bbox, src.transform)

        out_height = max(1, int(window.height / overview_factor))
        out_width = max(1, int(window.width / overview_factor))

        data = src.read(
            1,
            window=window,
            out_shape=(out_height, out_width),
        ).astype(np.float32)

        pixel_size_x = (bbox_wgs84[2] - bbox_wgs84[0]) / out_width if out_width > 0 else 0
        pixel_size_y = (bbox_wgs84[3] - bbox_wgs84[1]) / out_height if out_height > 0 else 0

        geo_info = {
            "bbox_wgs84": bbox_wgs84,
            "crs": str(src.crs),
            "out_shape": (out_height, out_width),
            "pixel_size_m": src.res[0] * overview_factor,
            "origin_wgs84": [bbox_wgs84[0], bbox_wgs84[3]],  # top-left
            "pixel_size_deg": [pixel_size_x, pixel_size_y],
        }

        return data, geo_info


# ==========================================================================
# Step 4: NDVI 計算
# ==========================================================================


def compute_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """
    NDVI = (NIR - Red) / (NIR + Red)

    入力は Sentinel-2 DN 値 (uint16, scale=10000)。
    典型値:
        密な植生: 0.6 – 0.9
        まばらな植生: 0.2 – 0.4
        裸地: 0.05 – 0.2
        水/雲/雪: < 0.1 or 負
    """
    red_f = red / SENTINEL2_SCALE_FACTOR
    nir_f = nir / SENTINEL2_SCALE_FACTOR
    denominator = nir_f + red_f
    ndvi = np.zeros_like(red_f)
    valid = denominator > 0
    ndvi[valid] = (nir_f[valid] - red_f[valid]) / denominator[valid]
    return ndvi


# ==========================================================================
# Step 5 & 6: 変化検出 + クラスタリング
# ==========================================================================


def simple_connected_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """
    4-連結のシンプルな連結成分ラベリング (scipy 不要)。
    overview レベルのデータ (数百×数百ピクセル) では十分高速。
    """
    labels = np.zeros_like(mask, dtype=np.int32)
    current_label = 0
    rows, cols = mask.shape

    for i in range(rows):
        for j in range(cols):
            if mask[i, j] and labels[i, j] == 0:
                current_label += 1
                queue = deque([(i, j)])
                while queue:
                    r, c = queue.popleft()
                    if r < 0 or r >= rows or c < 0 or c >= cols:
                        continue
                    if not mask[r, c] or labels[r, c] != 0:
                        continue
                    labels[r, c] = current_label
                    queue.extend([(r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)])

    return labels, current_label


def cluster_candidates(
    change_mask: np.ndarray,
    ndvi_before: np.ndarray,
    ndvi_after: np.ndarray,
    geo_info: dict,
    min_cluster_pixels: int = DEFAULT_MIN_CLUSTER_PIXELS,
) -> list[dict]:
    """変化ピクセルをクラスタリングし、候補地点リストを生成"""
    labels, num_clusters = simple_connected_components(change_mask)

    pixel_size_m = geo_info.get("pixel_size_m", 80)
    origin = geo_info.get("origin_wgs84", [0, 0])
    pixel_size_deg = geo_info.get("pixel_size_deg", [0.001, 0.001])

    candidates: list[dict] = []

    for label_id in range(1, num_clusters + 1):
        cluster_mask = labels == label_id
        pixel_count = int(cluster_mask.sum())

        if pixel_count < min_cluster_pixels:
            continue

        rows, cols = np.where(cluster_mask)
        center_row = float(rows.mean())
        center_col = float(cols.mean())

        lon = origin[0] + center_col * pixel_size_deg[0]
        lat = origin[1] - center_row * pixel_size_deg[1]

        avg_before = float(ndvi_before[cluster_mask].mean())
        avg_after = float(ndvi_after[cluster_mask].mean())
        avg_change = float((ndvi_after[cluster_mask] - ndvi_before[cluster_mask]).mean())

        area_m2 = pixel_count * (pixel_size_m**2)

        # リスクスコア: NDVI 低下の大きさ (70%) + 面積 (30%)
        magnitude = min(1.0, abs(avg_change) / 0.6)
        area_factor = min(1.0, area_m2 / 50000)
        risk = magnitude * 0.7 + area_factor * 0.3
        risk = round(min(1.0, max(0.0, risk)), 3)

        candidates.append(
            {
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "ndvi_before": round(avg_before, 4),
                "ndvi_after": round(avg_after, 4),
                "ndvi_change": round(avg_change, 4),
                "risk_score": risk,
                "area_m2": round(area_m2, 1),
                "pixel_count": pixel_count,
            }
        )

    candidates.sort(key=lambda c: c["risk_score"], reverse=True)
    return candidates


# ==========================================================================
# メインエントリポイント
# ==========================================================================


def run_change_detection(
    bbox: list[float],
    before_start: Optional[str] = None,
    before_end: Optional[str] = None,
    after_start: Optional[str] = None,
    after_end: Optional[str] = None,
    ndvi_threshold: float = DEFAULT_NDVI_THRESHOLD,
    max_cloud_cover: float = 20.0,
    overview_factor: int = DEFAULT_OVERVIEW_FACTOR,
    min_cluster_pixels: int = DEFAULT_MIN_CLUSTER_PIXELS,
) -> dict:
    """
    NDVI 時系列変化検出のメインエントリポイント。

    「前期」と「後期」それぞれで最良のシーンを選定し、
    NDVI の差分から植生消失（盛土・造成候補）を検出する。

    デフォルトでは同一シーズンの異年比較を行い、
    季節変化による誤検知を低減する。

    Returns:
        {
          "before_scene": {...},
          "after_scene": {...},
          "candidates": [{lat, lon, ndvi_change, risk_score, area_m2}, ...],
          "stats": {total_pixels, changed_pixels, ...},
        }
        エラー時は {"error": "...", "candidates": []}
    """
    start_time = time.time()

    if not HAS_RASTERIO:
        return {
            "error": (
                "rasterio が未インストールです。\n"
                "pip install rasterio numpy でインストールしてください。"
            ),
            "candidates": [],
        }

    now = datetime.now(timezone.utc)

    # ── デフォルト期間: 同シーズン異年比較で季節性バイアスを低減 ──
    #   After : 直近 90 日 (今年)
    #   Before: 1 年前の同じ 90 日間
    if after_end is None:
        after_end = now.strftime("%Y-%m-%d")
    if after_start is None:
        after_start = (now - timedelta(days=90)).strftime("%Y-%m-%d")
    if before_end is None:
        before_end = (now - timedelta(days=365)).strftime("%Y-%m-%d")
    if before_start is None:
        before_start = (now - timedelta(days=365 + 90)).strftime("%Y-%m-%d")

    logger.info(
        "Change detection: bbox=%s, before=[%s, %s], after=[%s, %s]",
        bbox,
        before_start,
        before_end,
        after_start,
        after_end,
    )

    # ── Step 1: シーン選定 ──
    before_scene = find_best_scene(bbox, before_start, before_end, max_cloud_cover)
    if not before_scene:
        return {
            "error": (
                f"前期 ({before_start}〜{before_end}) に"
                f"雲量 {max_cloud_cover}% 以下のシーンが見つかりません。"
                "雲量閾値を上げるか、期間を広げてお試しください。"
            ),
            "candidates": [],
        }

    after_scene = find_best_scene(bbox, after_start, after_end, max_cloud_cover)
    if not after_scene:
        return {
            "error": (
                f"後期 ({after_start}〜{after_end}) に"
                f"雲量 {max_cloud_cover}% 以下のシーンが見つかりません。"
                "雲量閾値を上げるか、期間を広げてお試しください。"
            ),
            "candidates": [],
        }

    before_id = before_scene["id"]
    after_id = after_scene["id"]
    logger.info("Selected scenes: before=%s, after=%s", before_id, after_id)

    # ── Step 2: バンド URL 取得 ──
    try:
        before_bands = get_band_urls(before_id)
        after_bands = get_band_urls(after_id)
    except Exception as e:
        return {"error": f"バンド URL 取得に失敗: {e}", "candidates": []}

    for label, bands in [("前期", before_bands), ("後期", after_bands)]:
        if not bands["red"] or not bands["nir"]:
            return {
                "error": f"{label}シーン {bands['scene_id']} の Red/NIR バンドが利用できません。",
                "candidates": [],
            }

    # ── Step 3: COG バンド読み取り ──
    try:
        logger.info("Reading before B04 (Red) ...")
        red_before, geo_info = read_band_window(before_bands["red"], bbox, overview_factor)
        logger.info("Reading before B08 (NIR) ...")
        nir_before, _ = read_band_window(before_bands["nir"], bbox, overview_factor)
        logger.info("Reading after B04 (Red) ...")
        red_after, _ = read_band_window(after_bands["red"], bbox, overview_factor)
        logger.info("Reading after B08 (NIR) ...")
        nir_after, _ = read_band_window(after_bands["nir"], bbox, overview_factor)
    except Exception as e:
        logger.error("Band reading failed: %s", e)
        return {
            "error": f"衛星バンドデータの読み取りに失敗しました: {e}",
            "candidates": [],
        }

    # サイズ不一致の場合はリサイズ (シーンが異なるタイルの場合など)
    if red_before.shape != red_after.shape:
        min_h = min(red_before.shape[0], red_after.shape[0])
        min_w = min(red_before.shape[1], red_after.shape[1])
        red_before = red_before[:min_h, :min_w]
        nir_before = nir_before[:min_h, :min_w]
        red_after = red_after[:min_h, :min_w]
        nir_after = nir_after[:min_h, :min_w]

    # ── Step 4: NDVI 計算 ──
    ndvi_before = compute_ndvi(red_before, nir_before)
    ndvi_after = compute_ndvi(red_after, nir_after)

    # ── Step 5: 変化検出 ──
    ndvi_diff = ndvi_after - ndvi_before

    # NoData / 無効ピクセルの除外
    valid_mask = (red_before > 0) & (nir_before > 0) & (red_after > 0) & (nir_after > 0)

    # 植生消失マスク: NDVI が閾値以上に低下したピクセル
    change_mask = valid_mask & (ndvi_diff < ndvi_threshold)

    # ── Step 6: クラスタリング ──
    candidates = cluster_candidates(
        change_mask, ndvi_before, ndvi_after, geo_info, min_cluster_pixels
    )

    processing_time = round(time.time() - start_time, 2)

    return {
        "before_scene": {
            "scene_id": before_id,
            "datetime": before_bands.get("datetime", ""),
            "cloud_cover": before_bands.get("cloud_cover"),
        },
        "after_scene": {
            "scene_id": after_id,
            "datetime": after_bands.get("datetime", ""),
            "cloud_cover": after_bands.get("cloud_cover"),
        },
        "parameters": {
            "bbox": bbox,
            "ndvi_threshold": ndvi_threshold,
            "overview_factor": overview_factor,
            "resolution_m": geo_info.get("pixel_size_m", 80),
            "min_cluster_pixels": min_cluster_pixels,
        },
        "candidates": candidates,
        "stats": {
            "total_pixels": int(valid_mask.sum()),
            "changed_pixels": int(change_mask.sum()),
            "candidate_clusters": len(candidates),
            "processing_time_sec": processing_time,
            "image_shape": list(ndvi_before.shape),
        },
    }
