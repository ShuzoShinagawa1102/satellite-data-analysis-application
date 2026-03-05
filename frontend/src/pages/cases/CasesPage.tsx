/**
 * SCR-005 案件一覧 (MUI)
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchCases, type CaseFilters } from "../../api/morido";
import type { CaseListItem } from "../../types/morido";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import type { SelectChangeEvent } from "@mui/material/Select";

const STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "open", label: "オープン" },
  { value: "under_review", label: "レビュー中" },
  { value: "waiting_field_check", label: "現地確認待ち" },
  { value: "monitoring", label: "監視中" },
  { value: "action_in_progress", label: "対応中" },
  { value: "closed", label: "クローズ" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "critical", label: "緊急" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

function priorityChipColor(p: string): "error" | "warning" | "info" | "default" {
  if (p === "critical") return "error";
  if (p === "high") return "warning";
  if (p === "medium") return "info";
  return "default";
}

export default function CasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const filters: CaseFilters = {
    status: searchParams.get("status") || undefined,
    priority: searchParams.get("priority") || undefined,
    overdue: searchParams.get("overdue") || undefined,
    page: Number(searchParams.get("page")) || 1,
  };

  useEffect(() => {
    setLoading(true);
    fetchCases(filters)
      .then((res) => {
        setCases(res.results);
        setTotalCount(res.count);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    setSearchParams(params);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">案件一覧</Typography>
        <Chip label={`${totalCount}件`} size="small" />
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={filters.status || ""}
              label="ステータス"
              onChange={(e: SelectChangeEvent) => updateFilter("status", e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>優先度</InputLabel>
            <Select
              value={filters.priority || ""}
              label="優先度"
              onChange={(e: SelectChangeEvent) => updateFilter("priority", e.target.value)}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={filters.overdue === "true"}
                onChange={(e) => updateFilter("overdue", e.target.checked ? "true" : "")}
              />
            }
            label="期限超過のみ"
          />
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>案件番号</TableCell>
                <TableCell>件名</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>優先度</TableCell>
                <TableCell align="center">地点数</TableCell>
                <TableCell>担当</TableCell>
                <TableCell>期限</TableCell>
                <TableCell>滞留</TableCell>
                <TableCell>更新日</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/cases/${c.id}`)}
                >
                  <TableCell sx={{ fontFamily: "monospace" }}>{c.case_number}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell><Chip label={c.status_display} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    <Chip label={c.priority_display} size="small" color={priorityChipColor(c.priority)} />
                  </TableCell>
                  <TableCell align="center">{c.related_site_count}</TableCell>
                  <TableCell>{c.assigned_to_name || "—"}</TableCell>
                  <TableCell>
                    {c.due_date ? new Date(c.due_date).toLocaleDateString("ja-JP") : "—"}
                  </TableCell>
                  <TableCell sx={{ color: c.stale_days > 14 ? "error.main" : undefined }}>
                    {c.stale_days}日
                  </TableCell>
                  <TableCell>{new Date(c.updated_at).toLocaleDateString("ja-JP")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
