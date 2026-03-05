/**
 * 盛土監視Ops – 地図可視化ページ
 *
 * - 国土地理院 / 衛星写真 タイルレイヤ切替
 * - 疑義地点をリスクスコア別色分け表示
 * - クラスタリング対応
 * - テーブルと地図の選択同期
 * - 右側 Drawer で地点詳細表示
 * - フィルタ（ステータス / 地域 / リスク帯 / 許認可照合状態）
 * - Sentinel-2 衛星シーンパネル（リアルタイムデータ）
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  LayersControl,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import CloseIcon from "@mui/icons-material/Close";
import SatelliteAltIcon from "@mui/icons-material/SatelliteAlt";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RadarIcon from "@mui/icons-material/Radar";
import Button from "@mui/material/Button";

import { fetchSitesGeoJSON, searchSatelliteScenes, runChangeDetection } from "../../api/morido";
import type {
  SiteGeoFeature,
  SiteStatus,
  SatelliteSceneFeature,
  ChangeDetectionResult,
  ChangeCandidate,
} from "../../types/morido";
import { useNavigate } from "react-router-dom";

// ── 定数 ──

const TOKYO_CENTER: [number, number] = [35.68, 139.76];
const DRAWER_WIDTH = 400;

// 国土地理院タイルURL
const GSI_STD = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png";
const GSI_PHOTO = "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg";
const GSI_PALE = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
const GSI_ATTR = "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>国土地理院</a>";

// Sentinel-2 Cloudless タイル (EOX)
const S2_CLOUDLESS = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/{z}/{y}/{x}.jpg";
const S2_ATTR = "<a href='https://s2maps.eu' target='_blank'>Sentinel-2 cloudless by EOX</a>";

// リスクスコアに応じた色分け
function riskColor(score: number): string {
  if (score >= 0.7) return "#d32f2f"; // 赤
  if (score >= 0.4) return "#ed6c02"; // 黄
  return "#1565c0"; // 青
}

function riskLabel(score: number): string {
  if (score >= 0.7) return "高";
  if (score >= 0.4) return "中";
  return "低";
}

const STATUS_LABELS: Record<SiteStatus, string> = {
  new: "新規",
  triaged: "トリアージ済",
  field_check_required: "現地確認要",
  monitoring: "継続監視",
  false_positive: "誤検知",
  linked_to_case: "案件紐付け済",
  closed: "クローズ",
};

// ── FlyTo コンポーネント ──

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 1 });
  }, [map, lat, lng]);
  return null;
}

// ── メインコンポーネント ──

export default function MapPage() {
  const navigate = useNavigate();

  // データ
  const [features, setFeatures] = useState<SiteGeoFeature[]>([]);
  const [satellites, setSatellites] = useState<SatelliteSceneFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [satLoading, setSatLoading] = useState(false);

  // 選択
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // フィルタ
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("");
  const [riskRange, setRiskRange] = useState<[number, number]>([0, 1]);

  // FlyTo座標
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  // NDVI 変化検出
  const [changeResult, setChangeResult] = useState<ChangeDetectionResult | null>(null);
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  // 地域リスト
  const regions = useMemo(() => {
    const set = new Set(features.map((f) => f.properties.region).filter(Boolean));
    return Array.from(set).sort();
  }, [features]);

  // フィルタ済みリスト
  const filtered = useMemo(() => {
    return features.filter((f) => {
      const p = f.properties;
      if (statusFilter && p.status !== statusFilter) return false;
      if (regionFilter && p.region !== regionFilter) return false;
      if (p.risk_score < riskRange[0] || p.risk_score > riskRange[1]) return false;
      return true;
    });
  }, [features, statusFilter, regionFilter, riskRange]);

  // 選択中の地点
  const selectedFeature = useMemo(
    () => filtered.find((f) => f.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  // 疑義地点読み込み
  useEffect(() => {
    setLoading(true);
    fetchSitesGeoJSON()
      .then((data) => setFeatures(data.features))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 衛星データ読み込み
  useEffect(() => {
    setSatLoading(true);
    searchSatelliteScenes({ auto_bbox: "true", limit: 10, max_cloud_cover: 100 })
      .then((data) => setSatellites(data.features))
      .catch(console.error)
      .finally(() => setSatLoading(false));
  }, []);

  // 地点選択
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
    const f = features.find((feat) => feat.id === id);
    if (f) {
      setFlyTarget({
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      });
    }
  }, [features]);

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  // NDVI 変化検出実行
  const handleRunChangeDetection = async () => {
    setChangeLoading(true);
    setChangeError(null);
    try {
      const result = await runChangeDetection({ auto_bbox: "true" });
      if (result.error) {
        setChangeError(result.error);
      } else {
        setChangeResult(result);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "変化検出の実行に失敗しました";
      // axios error の場合レスポンスからメッセージを拾う
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setChangeError(axiosErr?.response?.data?.error ?? msg);
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 115px)" }}>
      {/* 左パネル: フィルタ + テーブル + 衛星データ */}
      <Box
        sx={{
          width: 420,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          overflow: "hidden",
        }}
      >
        {/* フィルタ */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" gutterBottom>
            フィルタ
          </Typography>
          <Stack spacing={1.5}>
            <FormControl size="small" fullWidth>
              <InputLabel>ステータス</InputLabel>
              <Select
                value={statusFilter}
                label="ステータス"
                onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">すべて</MenuItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>地域</InputLabel>
              <Select
                value={regionFilter}
                label="地域"
                onChange={(e: SelectChangeEvent) => setRegionFilter(e.target.value)}
              >
                <MenuItem value="">すべて</MenuItem>
                {regions.map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ px: 1 }}>
              <Typography variant="caption" color="text.secondary">
                リスクスコア: {riskRange[0].toFixed(1)} – {riskRange[1].toFixed(1)}
              </Typography>
              <Slider
                value={riskRange}
                onChange={(_, v) => setRiskRange(v as [number, number])}
                min={0}
                max={1}
                step={0.05}
                size="small"
                valueLabelDisplay="auto"
              />
            </Box>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {filtered.length} / {features.length} 件表示
          </Typography>
        </Box>

        {/* NDVI 変化検出パネル */}
        <Accordion
          disableGutters
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, px: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <RadarIcon fontSize="small" color="secondary" />
              <Typography variant="subtitle2" color="secondary">
                NDVI 変化検出
              </Typography>
              {changeResult && (
                <Chip
                  label={`${changeResult.candidates.length}件`}
                  size="small"
                  color="secondary"
                  sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                />
              )}
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pt: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block", lineHeight: 1.5 }}>
              衛星画像の植生指数 (NDVI) を約1年前と比較し、
              植生が消失した箇所＝盛土・造成の候補を自動検出します。
              処理には 30秒〜2分 かかります。
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={
                changeLoading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <PlayArrowIcon />
                )
              }
              onClick={handleRunChangeDetection}
              disabled={changeLoading}
              fullWidth
            >
              {changeLoading ? "解析中…" : "解析実行"}
            </Button>
            {changeError && (
              <Alert severity="error" sx={{ mt: 1, fontSize: 11 }}>
                {changeError}
              </Alert>
            )}
            {changeResult && !changeError && (
              <Box sx={{ mt: 1.5 }}>
                <Stack spacing={0.5} sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    前期: {new Date(changeResult.before_scene.datetime).toLocaleDateString("ja-JP")}
                    {" "}(雲量 {changeResult.before_scene.cloud_cover?.toFixed(1)}%)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    後期: {new Date(changeResult.after_scene.datetime).toLocaleDateString("ja-JP")}
                    {" "}(雲量 {changeResult.after_scene.cloud_cover?.toFixed(1)}%)
                  </Typography>
                  <Typography variant="caption" fontWeight={700} color="secondary">
                    候補 {changeResult.candidates.length} 件 / {changeResult.stats.processing_time_sec}秒
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    解像度 {changeResult.parameters.resolution_m}m
                    {" "}/ 解析ピクセル {changeResult.stats.total_pixels.toLocaleString()}
                  </Typography>
                </Stack>
                {changeResult.candidates.slice(0, 8).map((c, i) => (
                  <Paper
                    key={i}
                    variant="outlined"
                    sx={{
                      p: 0.75,
                      mb: 0.5,
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                    onClick={() => setFlyTarget({ lat: c.latitude, lng: c.longitude })}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Chip
                        label={`#${i + 1}`}
                        size="small"
                        color="secondary"
                        sx={{ height: 18, fontSize: 10, fontWeight: 700, minWidth: 28 }}
                      />
                      <Typography variant="caption" fontWeight={600}>
                        リスク {(c.risk_score * 100).toFixed(0)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ΔNDVI {c.ndvi_change.toFixed(3)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.area_m2.toFixed(0)}m²
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* テーブル */}
        <TableContainer sx={{ flex: 1, overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>地域</TableCell>
                <TableCell align="center">リスク</TableCell>
                <TableCell>状態</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((f) => (
                  <TableRow
                    key={f.id}
                    hover
                    selected={f.id === selectedId}
                    onClick={() => handleSelect(f.id)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {f.properties.site_id_display}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {f.properties.region}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${riskLabel(f.properties.risk_score)} ${(f.properties.risk_score * 100).toFixed(0)}%`}
                        size="small"
                        sx={{
                          bgcolor: riskColor(f.properties.risk_score),
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {STATUS_LABELS[f.properties.status] ?? f.properties.status}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 衛星データパネル */}
        <Box sx={{ borderTop: 1, borderColor: "divider", p: 1.5, maxHeight: 300, overflow: "auto" }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <SatelliteAltIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2">
              Sentinel-2 最新観測
            </Typography>
            {satLoading && <CircularProgress size={16} />}
          </Stack>
          {satellites.length > 0 && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
              最新撮影: {new Date(satellites[0].properties.datetime).toLocaleDateString("ja-JP")}
              {satellites[0].properties.cloud_cover != null &&
                satellites[0].properties.cloud_cover > 50 &&
                " ⛅ 雲量が高いため地表像は不鮮明です"}
            </Typography>
          )}
          {satellites.length === 0 && !satLoading && (
            <Alert severity="info" variant="outlined" sx={{ fontSize: 12 }}>
              衛星データなし
            </Alert>
          )}
          <Stack spacing={1}>
            {satellites.slice(0, 8).map((scene) => (
              <Card key={scene.id} variant="outlined" sx={{ display: "flex", height: 72 }}>
                {scene.properties.thumbnail_url && (
                  <CardMedia
                    component="img"
                    sx={{ width: 72, objectFit: "cover" }}
                    image={scene.properties.thumbnail_url}
                    alt="Sentinel-2"
                  />
                )}
                <CardContent sx={{ p: 1, "&:last-child": { pb: 1 }, flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" fontWeight={600} noWrap>
                    {scene.properties.platform?.toUpperCase()} – {scene.properties.mgrs_tile}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {new Date(scene.properties.datetime).toLocaleDateString("ja-JP")}
                    {" "}雲量: {scene.properties.cloud_cover?.toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary" noWrap>
                    {scene.id}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* 地図 */}
      <Box sx={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={TOKYO_CENTER}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="国土地理院 標準">
              <TileLayer url={GSI_STD} attribution={GSI_ATTR} maxZoom={18} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="国土地理院 淡色">
              <TileLayer url={GSI_PALE} attribution={GSI_ATTR} maxZoom={18} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="国土地理院 航空写真">
              <TileLayer url={GSI_PHOTO} attribution={GSI_ATTR} maxZoom={18} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Sentinel-2 Cloudless">
              <TileLayer url={S2_CLOUDLESS} attribution={S2_ATTR} maxZoom={14} />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* 疑義地点マーカー */}
          {filtered.map((f) => {
            const [lng, lat] = f.geometry.coordinates;
            const score = f.properties.risk_score;
            return (
              <CircleMarker
                key={f.id}
                center={[lat, lng]}
                radius={score >= 0.7 ? 10 : score >= 0.4 ? 7 : 5}
                pathOptions={{
                  fillColor: riskColor(score),
                  color: f.id === selectedId ? "#000" : riskColor(score),
                  weight: f.id === selectedId ? 3 : 1.5,
                  fillOpacity: 0.8,
                }}
                eventHandlers={{ click: () => handleSelect(f.id) }}
              >
                <Popup>
                  <strong>{f.properties.site_id_display}</strong>
                  <br />
                  {f.properties.region} – リスク {(score * 100).toFixed(0)}%
                  <br />
                  {STATUS_LABELS[f.properties.status]}
                </Popup>
              </CircleMarker>
            );
          })}

          {/* NDVI 変化検出候補マーカー (紫色) */}
          {changeResult?.candidates.map((c, i) => (
            <CircleMarker
              key={`change-${i}`}
              center={[c.latitude, c.longitude]}
              radius={c.risk_score >= 0.7 ? 12 : c.risk_score >= 0.4 ? 9 : 6}
              pathOptions={{
                fillColor: "#9c27b0",
                color: "#4a148c",
                weight: 2.5,
                fillOpacity: 0.75,
              }}
            >
              <Popup>
                <strong>🛰️ 変化検出候補 #{i + 1}</strong>
                <br />
                リスク: {(c.risk_score * 100).toFixed(0)}%
                <br />
                NDVI変化: {c.ndvi_change.toFixed(3)}
                <br />
                前期 NDVI: {c.ndvi_before.toFixed(3)} → 後期: {c.ndvi_after.toFixed(3)}
                <br />
                推定面積: {c.area_m2.toLocaleString()}m²
                <br />
                ({c.pixel_count} ピクセル)
              </Popup>
            </CircleMarker>
          ))}

          {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
        </MapContainer>
      </Box>

      {/* 詳細 Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleDrawerClose}
        variant="persistent"
        sx={{
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, pt: 1 },
        }}
      >
        {selectedFeature && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                {selectedFeature.properties.site_id_display}
              </Typography>
              <IconButton onClick={handleDrawerClose} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={1.5}>
              {/* ステータス */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={STATUS_LABELS[selectedFeature.properties.status]}
                  size="small"
                  color={selectedFeature.properties.status === "new" ? "warning" : "default"}
                />
                <Chip
                  label={`リスク ${riskLabel(selectedFeature.properties.risk_score)} ${(selectedFeature.properties.risk_score * 100).toFixed(0)}%`}
                  size="small"
                  sx={{
                    bgcolor: riskColor(selectedFeature.properties.risk_score),
                    color: "#fff",
                  }}
                />
              </Stack>

              {/* 基本情報 */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  住所
                </Typography>
                <Typography variant="body2">
                  {selectedFeature.properties.address || "–"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  地域
                </Typography>
                <Typography variant="body2">
                  {selectedFeature.properties.region}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  座標
                </Typography>
                <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                  {selectedFeature.geometry.coordinates[1].toFixed(6)},
                  {selectedFeature.geometry.coordinates[0].toFixed(6)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  許認可照合
                </Typography>
                <Typography variant="body2">
                  {selectedFeature.properties.permit_match_status_display}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  検知日
                </Typography>
                <Typography variant="body2">
                  {selectedFeature.properties.detected_at
                    ? new Date(selectedFeature.properties.detected_at).toLocaleDateString("ja-JP")
                    : "–"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  担当者
                </Typography>
                <Typography variant="body2">
                  {selectedFeature.properties.assigned_to_name || "未割当"}
                </Typography>
              </Box>

              {selectedFeature.properties.is_continuous && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ fontSize: 12 }}>
                  継続的に検知されています
                </Alert>
              )}

              <Divider />

              <Button
                variant="contained"
                size="small"
                startIcon={<OpenInNewIcon />}
                onClick={() => navigate(`/sites/${selectedFeature.id}`)}
              >
                詳細ページを開く
              </Button>
            </Stack>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
