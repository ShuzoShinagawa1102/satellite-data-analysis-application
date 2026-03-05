/**
 * SCR-002 疑義地点トリアージ一覧 (MUI)
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchDetectedSites, type SiteFilters } from "../../api/morido";
import type { DetectedSiteListItem } from "../../types/morido";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

const STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "new", label: "新規" },
  { value: "triaged", label: "トリアージ済" },
  { value: "field_check_required", label: "現地確認要" },
  { value: "monitoring", label: "継続監視" },
  { value: "false_positive", label: "誤検知" },
  { value: "linked_to_case", label: "案件紐付け済" },
  { value: "closed", label: "クローズ" },
];

function riskColor(score: number): string {
  if (score >= 0.7) return "#d32f2f";
  if (score >= 0.4) return "#ed6c02";
  return "#1565c0";
}

export default function TriagePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sites, setSites] = useState<DetectedSiteListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const filters: SiteFilters = {
    status: searchParams.get("status") || undefined,
    region: searchParams.get("region") || undefined,
    min_risk: searchParams.get("min_risk") || undefined,
    max_risk: searchParams.get("max_risk") || undefined,
    permit_match_status: searchParams.get("permit_match_status") || undefined,
    ordering: searchParams.get("ordering") || "-risk_score",
    page: Number(searchParams.get("page")) || 1,
  };

  useEffect(() => {
    setLoading(true);
    fetchDetectedSites(filters)
      .then((res) => {
        setSites(res.results);
        setTotalCount(res.count);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) { params.set(key, value); } else { params.delete(key); }
    params.delete("page");
    setSearchParams(params);
  };

  const totalPages = Math.ceil(totalCount / 20);
  const currentPage = filters.page || 1;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">疑義地点トリアージ一覧</Typography>
        <Chip label={`${totalCount} 件`} color="primary" variant="outlined" />
      </Stack>

      {/* フィルタ */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>ステータス</InputLabel>
            <Select value={filters.status || ""} label="ステータス" onChange={(e: SelectChangeEvent) => updateFilter("status", e.target.value)}>
              {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="地域"
            value={filters.region || ""}
            onChange={(e) => updateFilter("region", e.target.value)}
            sx={{ width: 140 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>ソート</InputLabel>
            <Select value={filters.ordering || "-risk_score"} label="ソート" onChange={(e: SelectChangeEvent) => updateFilter("ordering", e.target.value)}>
              <MenuItem value="-risk_score">リスク（高→低）</MenuItem>
              <MenuItem value="risk_score">リスク（低→高）</MenuItem>
              <MenuItem value="-detected_at">検知日（新しい順）</MenuItem>
              <MenuItem value="detected_at">検知日（古い順）</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell align="center">リスク</TableCell>
                  <TableCell>状態</TableCell>
                  <TableCell>地域</TableCell>
                  <TableCell>継続性</TableCell>
                  <TableCell>許認可照合</TableCell>
                  <TableCell>担当</TableCell>
                  <TableCell>検知日</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sites.map((site) => (
                  <TableRow
                    key={site.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/sites/${site.id}`)}
                  >
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{site.site_id_display}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={(site.risk_score * 100).toFixed(0) + "%"}
                        size="small"
                        sx={{ bgcolor: riskColor(site.risk_score), color: "#fff", fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={site.status_display} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{site.region}</TableCell>
                    <TableCell>{site.is_continuous ? "連続" : "単発"}</TableCell>
                    <TableCell>{site.permit_match_status_display}</TableCell>
                    <TableCell>{site.assigned_to_name || "—"}</TableCell>
                    <TableCell>{new Date(site.detected_at).toLocaleDateString("ja-JP")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} sx={{ mt: 2 }}>
            <Button size="small" disabled={currentPage <= 1} onClick={() => updateFilter("page", String(currentPage - 1))}>
              前へ
            </Button>
            <Typography variant="body2">{currentPage} / {totalPages} ページ</Typography>
            <Button size="small" disabled={currentPage >= totalPages} onClick={() => updateFilter("page", String(currentPage + 1))}>
              次へ
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
