/**
 * SCR-003 疑義地点詳細 (MUI + ReactFlow 関係図・状態遷移図)
 */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchDetectedSiteDetail, updateSiteStatus } from "../../api/morido";
import type { DetectedSiteDetail, SiteStatus } from "../../types/morido";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import StateFlowDiagram from "../../components/workflow/StateFlowDiagram";
import RelationshipGraph from "../../components/workflow/RelationshipGraph";

const STATUS_LABELS: Record<string, string> = {
  new: "新規",
  triaged: "トリアージ済",
  field_check_required: "現地確認要",
  monitoring: "継続監視",
  false_positive: "誤検知",
  linked_to_case: "案件紐付け済",
  closed: "クローズ",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ["triaged"],
  triaged: ["field_check_required", "monitoring", "false_positive"],
  field_check_required: ["linked_to_case", "monitoring", "false_positive"],
  monitoring: ["field_check_required", "linked_to_case", "false_positive", "closed"],
  false_positive: ["new"],
  linked_to_case: ["closed"],
  closed: ["new"],
};

function riskColor(score: number): string {
  if (score >= 0.7) return "#d32f2f";
  if (score >= 0.4) return "#ed6c02";
  return "#1565c0";
}

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<DetectedSiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDetectedSiteDetail(id)
      .then(setSite)
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !site) return;
    setStatusUpdating(true);
    try {
      const updated = await updateSiteStatus(id, { status: newStatus });
      setSite(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "状態変更に失敗しました";
      alert(msg);
    }
    setStatusUpdating(false);
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  }
  if (!site) {
    return <Box sx={{ p: 3 }}><Alert severity="error">疑義地点が見つかりません</Alert></Box>;
  }

  const transitions = VALID_TRANSITIONS[site.status] || [];

  return (
    <Box sx={{ p: 3 }}>
      {/* ヘッダ */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small">
          戻る
        </Button>
        <Typography variant="h5">{site.site_id_display}</Typography>
        <Chip label={site.status_display} variant="outlined" />
        <Chip
          label={`リスク ${(site.risk_score * 100).toFixed(0)}%`}
          sx={{ bgcolor: riskColor(site.risk_score), color: "#fff" }}
        />
      </Stack>

      {/* アクションバー */}
      {transitions.length > 0 && (
        <Paper sx={{ p: 1.5, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={600}>アクション:</Typography>
            {transitions.map((s) => (
              <Button
                key={s}
                variant="outlined"
                size="small"
                disabled={statusUpdating}
                onClick={() => handleStatusChange(s)}
              >
                → {STATUS_LABELS[s] || s}
              </Button>
            ))}
          </Stack>
        </Paper>
      )}

      {/* タブ: 基本情報 / 状態遷移図 / 関係図 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="基本情報・履歴" />
          <Tab label="状態遷移フロー" />
          <Tab label="関係図" />
        </Tabs>
      </Paper>

      {/* タブ 0: 基本情報 */}
      {tab === 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>基本情報</Typography>
              <InfoRow label="住所" value={site.address || "—"} />
              <InfoRow label="地域" value={site.region || "—"} />
              <InfoRow label="座標" value={`${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}`} mono />
              <InfoRow label="継続性" value={site.is_continuous ? "連続的検知" : "単発検知"} />
              <InfoRow label="許認可照合" value={site.permit_match_status_display} />
              <InfoRow label="検知日時" value={new Date(site.detected_at).toLocaleString("ja-JP")} />
              <InfoRow label="担当者" value={site.assigned_to_name || "未割当"} />
              {site.is_continuous && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1 }}>
                  継続的に検知されています
                </Alert>
              )}
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                時系列観測 ({site.observations.length}件)
              </Typography>
              {site.observations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">観測データなし</Typography>
              ) : (
                <Stack spacing={1}>
                  {site.observations.map((obs) => (
                    <Card key={obs.id} variant="outlined">
                      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" fontWeight={600}>{obs.source}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(obs.observed_at).toLocaleDateString("ja-JP")}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* 許認可照合 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                許認可照合 ({site.permit_matches.length}件)
              </Typography>
              {site.permit_matches.length === 0 ? (
                <Typography variant="body2" color="text.secondary">照合データなし</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>許可番号</TableCell>
                        <TableCell>結果</TableCell>
                        <TableCell>照合日</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {site.permit_matches.map((pm) => (
                        <TableRow key={pm.id}>
                          <TableCell>{pm.permit_number}</TableCell>
                          <TableCell>{pm.match_result}</TableCell>
                          <TableCell>{new Date(pm.matched_at).toLocaleDateString("ja-JP")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          {/* 現地確認 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                現地確認履歴 ({site.inspections.length}件)
              </Typography>
              {site.inspections.length === 0 ? (
                <Typography variant="body2" color="text.secondary">現地確認なし</Typography>
              ) : (
                <Stack spacing={1}>
                  {site.inspections.map((insp) => (
                    <Card key={insp.id} variant="outlined">
                      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={insp.result_display} size="small" variant="outlined" />
                          <Typography variant="caption">
                            {new Date(insp.inspected_at).toLocaleDateString("ja-JP")}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {insp.inspector_name || "—"}
                          </Typography>
                        </Stack>
                        {insp.finding && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>{insp.finding}</Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* 関連案件 */}
          {site.case_ids.length > 0 && (
            <Grid size={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>関連案件</Typography>
                <Stack direction="row" spacing={1}>
                  {site.case_ids.map((cid) => (
                    <Button key={cid} variant="outlined" size="small" onClick={() => navigate(`/cases/${cid}`)}>
                      案件: {cid.substring(0, 8)}…
                    </Button>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* タブ 1: 状態遷移フロー */}
      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            業務フロー（状態遷移）– 現在のステータスがハイライト表示されます
          </Typography>
          <StateFlowDiagram currentStatus={site.status as SiteStatus} entityType="site" height={460} />
        </Paper>
      )}

      {/* タブ 2: 関係図 */}
      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            関係図 – この地点に紐づくデータの全体像
          </Typography>
          <RelationshipGraph site={site} height={520} />
        </Paper>
      )}
    </Box>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack direction="row" spacing={1} sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>{label}</Typography>
      <Typography variant="body2" fontFamily={mono ? "monospace" : undefined}>{value}</Typography>
    </Stack>
  );
}
