/**
 * SCR-008 管理設定（監査ログ・ジョブ管理）(MUI)
 */
import React, { useEffect, useState } from "react";
import { fetchAuditLogs, fetchJobs, retryJob } from "../../api/morido";
import type { AuditLog, JobRun } from "../../types/morido";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CircularProgress from "@mui/material/CircularProgress";
import ReplayIcon from "@mui/icons-material/Replay";

export default function AdminPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>管理設定</Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="監査ログ" />
          <Tab label="ジョブ管理" />
        </Tabs>
      </Paper>

      {tab === 0 && <AuditLogPanel />}
      {tab === 1 && <JobPanel />}
    </Box>
  );
}

function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs()
      .then((res) => setLogs(res.results))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>;
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>日時</TableCell>
            <TableCell>イベント</TableCell>
            <TableCell>対象</TableCell>
            <TableCell>実行者</TableCell>
            <TableCell>説明</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {new Date(log.acted_at).toLocaleString("ja-JP")}
              </TableCell>
              <TableCell>
                <Chip label={log.event_type_display} size="small" variant="outlined" />
              </TableCell>
              <TableCell sx={{ fontFamily: "monospace" }}>
                {log.target_type}:{log.target_id.substring(0, 8)}
              </TableCell>
              <TableCell>{log.actor_name || "—"}</TableCell>
              <TableCell>{log.description || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function jobStatusColor(s: string): "success" | "error" | "warning" | "info" | "default" {
  if (s === "success") return "success";
  if (s === "failed") return "error";
  if (s === "running") return "info";
  if (s === "cancelled") return "warning";
  return "default";
}

function JobPanel() {
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs()
      .then((res) => setJobs(res.results))
      .finally(() => setLoading(false));
  }, []);

  const handleRetry = async (jobId: string) => {
    try {
      const updated = await retryJob(jobId);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "再実行に失敗しました";
      alert(msg);
    }
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>;
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>種別</TableCell>
            <TableCell>状態</TableCell>
            <TableCell>開始</TableCell>
            <TableCell>終了</TableCell>
            <TableCell>エラー</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>{job.job_type_display}</TableCell>
              <TableCell>
                <Chip label={job.status_display} size="small" color={jobStatusColor(job.status)} />
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {job.started_at ? new Date(job.started_at).toLocaleString("ja-JP") : "—"}
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {job.finished_at ? new Date(job.finished_at).toLocaleString("ja-JP") : "—"}
              </TableCell>
              <TableCell sx={{ color: "error.main", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                {job.error_message || "—"}
              </TableCell>
              <TableCell>
                {(job.status === "failed" || job.status === "cancelled") && (
                  <Button
                    size="small"
                    startIcon={<ReplayIcon />}
                    onClick={() => handleRetry(job.id)}
                  >
                    再実行
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
