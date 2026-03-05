/**
 * SCR-001 監視統括ダッシュボード (MUI + Recharts)
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboardSummary, fetchDashboardTimeseries } from "../../api/morido";
import type { DashboardSummary, TimeseriesData } from "../../types/morido";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import SatelliteAltIcon from "@mui/icons-material/SatelliteAlt";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ── 定数 ──

const STATUS_LABELS: Record<string, string> = {
  new: "新規",
  triaged: "トリアージ済",
  field_check_required: "現地確認要",
  monitoring: "継続監視",
  false_positive: "誤検知",
  linked_to_case: "案件紐付け済",
  closed: "クローズ",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#1976d2",
  triaged: "#7b1fa2",
  field_check_required: "#ed6c02",
  monitoring: "#0288d1",
  false_positive: "#757575",
  linked_to_case: "#c62828",
  closed: "#2e7d32",
};

const KPI_CONFIGS = [
  { key: "new_sites_count", label: "新規疑義地点", color: "#1976d2", link: "/triage?status=new" },
  { key: "high_risk_count", label: "高リスク（未対応）", color: "#d32f2f", link: "/triage?min_risk=0.7" },
  { key: "field_check_pending_count", label: "現地確認待ち", color: "#ed6c02", link: "/triage?status=field_check_required" },
  { key: "stale_cases_count", label: "滞留案件", color: "#c62828", link: "/cases?overdue=true" },
  { key: "completion_rate", label: "対応完了率", color: "#2e7d32", suffix: "%" },
  { key: "false_positive_count", label: "誤検知登録", color: "#757575", link: "/triage?status=false_positive" },
] as const;

// ── メイン ──

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchDashboardSummary(days),
      fetchDashboardTimeseries(12),
    ])
      .then(([s, t]) => {
        setSummary(s);
        setTimeseries(t);
      })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={2}>
          {[...Array(6)].map((_, i) => (
            <Grid key={i} size={{ xs: 6, md: 4, lg: 2 }}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (!summary) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">データ取得に失敗しました</Alert>
      </Box>
    );
  }

  // Recharts 用データ
  const statusData = Object.entries(summary.status_breakdown).map(([key, count]) => ({
    name: STATUS_LABELS[key] ?? key,
    value: count,
    color: STATUS_COLORS[key] ?? "#666",
  }));

  const regionData = Object.entries(summary.region_breakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([region, count]) => ({ name: region, count }));

  return (
    <Box sx={{ p: 3 }}>
      {/* ヘッダー */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <SatelliteAltIcon color="primary" />
          <Typography variant="h5">監視統括ダッシュボード</Typography>
        </Stack>
        <ToggleButtonGroup
          value={days}
          exclusive
          onChange={(_, v) => v && setDays(v)}
          size="small"
        >
          <ToggleButton value={7}>7日</ToggleButton>
          <ToggleButton value={30}>30日</ToggleButton>
          <ToggleButton value={90}>90日</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* KPIカード */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {KPI_CONFIGS.map((kpi) => {
          const val = summary[kpi.key as keyof DashboardSummary];
          const link = "link" in kpi ? kpi.link : undefined;
          const suffix = "suffix" in kpi ? kpi.suffix : undefined;
          return (
            <Grid key={kpi.key} size={{ xs: 6, md: 4, lg: 2 }}>
              <Card sx={{ borderTop: `3px solid ${kpi.color}` }}>
                {link ? (
                  <CardActionArea onClick={() => navigate(link)}>
                    <KPIContent label={kpi.label} value={val} suffix={suffix} color={kpi.color} />
                  </CardActionArea>
                ) : (
                  <KPIContent label={kpi.label} value={val} suffix={suffix} color={kpi.color} />
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* グラフ行 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* 週次推移 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 2, height: 360 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <TrendingUpIcon fontSize="small" color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
                週次推移
              </Typography>
              {timeseries && (
                <Chip
                  label={`未対応: ${timeseries.pending_count} 件`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
            {timeseries && timeseries.weeks.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timeseries.weeks}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                    fontSize={11}
                  />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip
                    labelFormatter={(v) => new Date(String(v)).toLocaleDateString("ja-JP")}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="new_sites"
                    name="新規疑義地点"
                    stroke="#1976d2"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="inspections_done"
                    name="現地確認完了"
                    stroke="#2e7d32"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cases_created"
                    name="案件作成"
                    stroke="#c62828"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280 }}>
                <Typography color="text.secondary">データなし</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* ステータス別 (Pie) */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2, height: 360 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              ステータス別分布
            </Typography>
            <ResponsiveContainer width="100%" height={290}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name ?? ''}: ${value}`}
                  labelLine={false}
                  fontSize={11}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* 地域別 (Bar) */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          地域別件数
        </Typography>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={regionData} layout="vertical" margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} fontSize={11} />
            <YAxis type="category" dataKey="name" fontSize={12} width={70} />
            <Tooltip />
            <Bar dataKey="count" name="件数" fill="#1565c0" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>
    </Box>
  );
}

// ── KPIカード内容 ──

function KPIContent({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: number | string | Record<string, unknown>;
  suffix?: string;
  color: string;
}) {
  const displayVal = typeof value === "object" ? "–" : `${value}${suffix ?? ""}`;
  return (
    <CardContent sx={{ textAlign: "center", py: 2, "&:last-child": { pb: 2 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ color }}>
        {displayVal}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {label}
      </Typography>
    </CardContent>
  );
}
