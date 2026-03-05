/**
 * SCR-007 レポート出力 (MUI + Recharts)
 */
import React, { useEffect, useState } from "react";
import { fetchMonthlyReport, fetchDashboardTimeseries } from "../../api/morido";
import type { MonthlyReport, TimeseriesData } from "../../types/morido";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  new: "新規",
  triaged: "トリアージ済",
  field_check_required: "現地確認要",
  monitoring: "継続監視",
  false_positive: "誤検知",
  linked_to_case: "案件紐付け済",
  closed: "クローズ",
};

const PIE_COLORS = ["#1565c0", "#42a5f5", "#ff6f00", "#ffa726", "#d32f2f", "#66bb6a", "#bdbdbd"];

export default function ReportsPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const weeks = Math.ceil(days / 7);
    Promise.all([
      fetchMonthlyReport(days),
      fetchDashboardTimeseries(weeks),
    ])
      .then(([r, ts]) => { setReport(r); setTimeseries(ts); })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  }
  if (!report) {
    return <Box sx={{ p: 3 }}><Alert severity="error">レポート取得に失敗しました</Alert></Box>;
  }

  const statusData = Object.entries(report.status_breakdown).map(([key, count]) => ({
    name: STATUS_LABELS[key] || key,
    value: count,
  }));

  const regionData = Object.entries(report.region_breakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([region, count]) => ({ region, count }));

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">月次レポート</Typography>
        <ToggleButtonGroup
          value={days}
          exclusive
          size="small"
          onChange={(_, v) => v && setDays(v)}
        >
          {[7, 30, 60, 90].map((d) => (
            <ToggleButton key={d} value={d}>{d}日</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2">
          対象期間: {new Date(report.period_start).toLocaleDateString("ja-JP")} ～{" "}
          {new Date(report.period_end).toLocaleDateString("ja-JP")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ※ 本レポートは意思決定補助を目的としたものであり、法的判定書ではありません。
        </Typography>
      </Paper>

      {/* KPIカード */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "検知地点数", value: report.total_sites_detected, color: "#1565c0" },
          { label: "案件作成数", value: report.total_cases_created, color: "#ff6f00" },
          { label: "高リスク地点", value: report.high_risk_sites, color: "#d32f2f" },
          { label: "誤検知数", value: report.false_positive_count, color: "#9e9e9e" },
        ].map((kpi) => (
          <Grid size={{ xs: 6, md: 3 }} key={kpi.label}>
            <Card sx={{ borderTop: `4px solid ${kpi.color}` }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>{kpi.value}</Typography>
                <Typography variant="body2" color="text.secondary">{kpi.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        {/* 状態別内訳 – PieChart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>状態別内訳</Typography>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={100}
                  paddingAngle={2}
                  label={({ name, value }) => `${name}(${value})`}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* 地域別内訳 – BarChart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>地域別内訳</Typography>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={regionData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="region" width={50} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#1565c0" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* 週次トレンド – LineChart */}
        {timeseries && (
          <Grid size={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>週次トレンド</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timeseries.weeks}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="new_sites" name="新規検知" stroke="#1565c0" strokeWidth={2} />
                  <Line type="monotone" dataKey="inspections_done" name="現地確認" stroke="#ff6f00" strokeWidth={2} />
                  <Line type="monotone" dataKey="cases_created" name="案件作成" stroke="#d32f2f" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
