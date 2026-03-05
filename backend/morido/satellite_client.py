"""
盛土監視Ops – 衛星データクライアント
Element84 Earth Search STAC API (Sentinel-2 L2A) を利用

認証不要・無料で Sentinel-2 シーンメタデータを検索可能
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# ── 定数 ──
STAC_API_URL = "https://earth-search.aws.element84.com/v1"
SENTINEL2_COLLECTION = "sentinel-2-l2a"

# 東京周辺のデフォルト bbox (lon_min, lat_min, lon_max, lat_max)
DEFAULT_BBOX_TOKYO = [139.5, 35.5, 140.0, 36.0]

# リクエストタイムアウト (秒)
REQUEST_TIMEOUT = 30


@dataclass
class SatelliteScene:
    """衛星シーンのメタデータ"""

    scene_id: str
    collection: str
    datetime: str
    cloud_cover: Optional[float]
    bbox: list[float]
    geometry: dict
    thumbnail_url: str
    visual_url: str
    platform: str
    mgrs_tile: str
    properties: dict

    def to_dict(self) -> dict:
        return {
            "scene_id": self.scene_id,
            "collection": self.collection,
            "datetime": self.datetime,
            "cloud_cover": self.cloud_cover,
            "bbox": self.bbox,
            "geometry": self.geometry,
            "thumbnail_url": self.thumbnail_url,
            "visual_url": self.visual_url,
            "platform": self.platform,
            "mgrs_tile": self.mgrs_tile,
        }


def search_sentinel2_scenes(
    bbox: Optional[list[float]] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    max_cloud_cover: float = 30.0,
    limit: int = 20,
) -> dict:
    """
    Sentinel-2 L2A シーンを STAC API で検索

    Args:
        bbox: [lon_min, lat_min, lon_max, lat_max]
        date_from: 開始日 (ISO format, e.g. "2024-01-01")
        date_to: 終了日
        max_cloud_cover: 最大雲量 (%)
        limit: 取得件数

    Returns:
        GeoJSON FeatureCollection (STAC Items)
    """
    if bbox is None:
        bbox = DEFAULT_BBOX_TOKYO

    # デフォルト期間: 直近 90 日
    if date_to is None:
        date_to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if date_from is None:
        dt_from = datetime.now(timezone.utc) - timedelta(days=90)
        date_from = dt_from.strftime("%Y-%m-%d")

    search_body = {
        "collections": [SENTINEL2_COLLECTION],
        "bbox": bbox,
        "datetime": f"{date_from}T00:00:00Z/{date_to}T23:59:59Z",
        "limit": min(limit, 100),
        "query": {
            "eo:cloud_cover": {"lte": max_cloud_cover},
        },
        "sortby": [{"field": "properties.datetime", "direction": "desc"}],
    }

    try:
        resp = requests.post(
            f"{STAC_API_URL}/search",
            json=search_body,
            timeout=REQUEST_TIMEOUT,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()

        # 結果を整形
        features = []
        for item in data.get("features", []):
            props = item.get("properties", {})
            assets = item.get("assets", {})

            feature = {
                "type": "Feature",
                "id": item.get("id", ""),
                "geometry": item.get("geometry", {}),
                "bbox": item.get("bbox", []),
                "properties": {
                    "scene_id": item.get("id", ""),
                    "collection": SENTINEL2_COLLECTION,
                    "datetime": props.get("datetime", ""),
                    "cloud_cover": props.get("eo:cloud_cover"),
                    "platform": props.get("platform", ""),
                    "mgrs_tile": props.get("s2:mgrs_tile", props.get("grid:code", "")),
                    "constellation": props.get("constellation", "sentinel-2"),
                    "processing_level": props.get("s2:processing_baseline", ""),
                    "sun_elevation": props.get("view:sun_elevation"),
                    "thumbnail_url": assets.get("thumbnail", {}).get("href", ""),
                    "visual_url": assets.get("visual", {}).get("href", ""),
                    "scl_url": assets.get("scl", {}).get("href", ""),
                },
            }
            features.append(feature)

        return {
            "type": "FeatureCollection",
            "numberMatched": data.get("numberMatched", data.get("context", {}).get("matched", len(features))),
            "numberReturned": len(features),
            "features": features,
        }

    except requests.exceptions.RequestException as e:
        logger.error("Sentinel-2 STAC API search failed: %s", e)
        return {
            "type": "FeatureCollection",
            "numberMatched": 0,
            "numberReturned": 0,
            "features": [],
            "error": str(e),
        }


def get_scene_detail(scene_id: str) -> Optional[dict]:
    """
    個別シーンの詳細取得

    Args:
        scene_id: STAC Item ID

    Returns:
        STAC Item (dict) or None
    """
    try:
        resp = requests.get(
            f"{STAC_API_URL}/collections/{SENTINEL2_COLLECTION}/items/{scene_id}",
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        logger.error("Scene detail fetch failed for %s: %s", scene_id, e)
        return None


def get_available_collections() -> list[dict]:
    """
    利用可能なコレクション一覧を取得
    """
    try:
        resp = requests.get(
            f"{STAC_API_URL}/collections",
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        return [
            {
                "id": col["id"],
                "title": col.get("title", col["id"]),
                "description": col.get("description", ""),
            }
            for col in data.get("collections", [])
        ]
    except requests.exceptions.RequestException as e:
        logger.error("Collections fetch failed: %s", e)
        return []


def build_bbox_from_sites(sites_qs, buffer_deg: float = 0.05) -> list[float]:
    """
    疑義地点の QuerySet から bbox を計算

    Args:
        sites_qs: DetectedSite QuerySet
        buffer_deg: 緯度経度のバッファ（度）

    Returns:
        [lon_min, lat_min, lon_max, lat_max]
    """
    from django.db.models import Max, Min

    agg = sites_qs.aggregate(
        min_lon=Min("longitude"),
        max_lon=Max("longitude"),
        min_lat=Min("latitude"),
        max_lat=Max("latitude"),
    )

    if agg["min_lon"] is None:
        return DEFAULT_BBOX_TOKYO

    return [
        agg["min_lon"] - buffer_deg,
        agg["min_lat"] - buffer_deg,
        agg["max_lon"] + buffer_deg,
        agg["max_lat"] + buffer_deg,
    ]
