/**
 * SCR-006 案件詳細 (MUI + ReactFlow 状態遷移図)
 */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchCaseDetail,
  updateCaseStatus,
  addCaseComment,
} from "../../api/morido";
import type { CaseDetail, CaseStatus } from "../../types/morido";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
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
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Divider from "@mui/material/Divider";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";

import StateFlowDiagram from "../../components/workflow/StateFlowDiagram";

const STATUS_LABELS: Record<string, string> = {
  open: "オープン",
  under_review: "レビュー中",
  waiting_field_check: "現地確認待ち",
  monitoring: "監視中",
  action_in_progress: "対応中",
  closed: "クローズ",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["under_review"],
  under_review: ["waiting_field_check"],
  waiting_field_check: ["monitoring", "action_in_progress"],
  monitoring: ["action_in_progress", "closed"],
  action_in_progress: ["monitoring", "closed"],
  closed: ["open"],
};

function priorityChipColor(p: string): "error" | "warning" | "info" | "default" {
  if (p === "critical") return "error";
  if (p === "high") return "warning";
  if (p === "medium") return "info";
  return "default";
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchCaseDetail(id)
      .then(setCaseData)
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    try {
      const updated = await updateCaseStatus(id, { status: newStatus });
      setCaseData(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "状態変更に失敗しました";
      alert(msg);
    }
  };

  const handleAddComment = async () => {
    if (!id || !commentText.trim()) return;
    setSubmitting(true);
    try {
      await addCaseComment(id, commentText);
      const updated = await fetchCaseDetail(id);
      setCaseData(updated);
      setCommentText("");
    } catch {
      alert("コメント追加に失敗しました");
    }
    setSubmitting(false);
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  }
  if (!caseData) {
    return <Box sx={{ p: 3 }}><Alert severity="error">案件が見つかりません</Alert></Box>;
  }

  const transitions = VALID_TRANSITIONS[caseData.status] || [];

  return (
    <Box sx={{ p: 3 }}>
      {/* ヘッダ */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small">
          戻る
        </Button>
        <Typography variant="h5">{caseData.case_number}</Typography>
        <Typography variant="h6" color="text.secondary">{caseData.title}</Typography>
        <Chip label={caseData.status_display} variant="outlined" />
        <Chip label={caseData.priority_display} color={priorityChipColor(caseData.priority)} />
      </Stack>

      {/* 補足情報 */}
      <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
        <Typography variant="body2">担当: {caseData.assigned_to_name || "未割当"}</Typography>
        <Typography variant="body2">
          期限: {caseData.due_date ? new Date(caseData.due_date).toLocaleDateString("ja-JP") : "未設定"}
        </Typography>
        <Typography variant="body2" color={caseData.stale_days > 14 ? "error" : undefined}>
          滞留: {caseData.stale_days}日
        </Typography>
      </Stack>

      {/* アクションバー */}
      {transitions.length > 0 && (
        <Paper sx={{ p: 1.5, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={600}>アクション:</Typography>
            {transitions.map((s) => (
              <Button key={s} variant="outlined" size="small" onClick={() => handleStatusChange(s)}>
                → {STATUS_LABELS[s] || s}
              </Button>
            ))}
          </Stack>
        </Paper>
      )}

      {/* タブ */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="詳細・コメント" />
          <Tab label="状態遷移フロー" />
        </Tabs>
      </Paper>

      {/* タブ 0: 詳細 */}
      {tab === 0 && (
        <Grid container spacing={2}>
          {/* 関連疑義地点 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                関連疑義地点 ({caseData.sites.length}件)
              </Typography>
              {caseData.sites.length === 0 ? (
                <Typography variant="body2" color="text.secondary">紐付け地点なし</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>リスク</TableCell>
                        <TableCell>状態</TableCell>
                        <TableCell>地域</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {caseData.sites.map((site) => (
                        <TableRow
                          key={site.id}
                          hover
                          sx={{ cursor: "pointer" }}
                          onClick={() => navigate(`/sites/${site.id}`)}
                        >
                          <TableCell sx={{ fontFamily: "monospace" }}>{site.site_id_display}</TableCell>
                          <TableCell>{site.risk_score.toFixed(2)}</TableCell>
                          <TableCell><Chip label={site.status_display} size="small" variant="outlined" /></TableCell>
                          <TableCell>{site.region}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          {/* コメント */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                コメント ({caseData.comments.length}件)
              </Typography>
              <Stack spacing={1} sx={{ maxHeight: 350, overflowY: "auto", mb: 2 }}>
                {caseData.comments.map((c) => (
                  <Card key={c.id} variant="outlined">
                    <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={600}>{c.author_name || "Unknown"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(c.created_at).toLocaleString("ja-JP")}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{c.body}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
              <Divider sx={{ mb: 1 }} />
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  placeholder="コメントを入力..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <Button
                  variant="contained"
                  disabled={submitting || !commentText.trim()}
                  onClick={handleAddComment}
                  sx={{ alignSelf: "flex-end" }}
                  endIcon={<SendIcon />}
                >
                  送信
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* タブ 1: 状態遷移フロー */}
      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            案件の業務フロー（状態遷移）– 現在のステータスがハイライト表示されます
          </Typography>
          <StateFlowDiagram currentStatus={caseData.status as CaseStatus} entityType="case" height={460} />
        </Paper>
      )}
    </Box>
  );
}
