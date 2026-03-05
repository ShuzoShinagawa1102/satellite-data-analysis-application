/**
 * 盛土監視Ops – 業務フロー（状態遷移）可視化
 *
 * 検知 → トリアージ → 現地確認待ち → … の状態遷移を
 * ReactFlow でノード/エッジとして描画
 * 選択中の案件/地点がどの状態にあるか強調表示
 */

import React, { useMemo } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import Box from "@mui/material/Box";
import type { SiteStatus, CaseStatus } from "../../types/morido";

// ── 型 ──

interface StateFlowDiagramProps {
  /** 現在の状態 (強調表示) */
  currentStatus: SiteStatus | CaseStatus;
  /** "site" or "case" */
  entityType: "site" | "case";
  /** 高さ */
  height?: number;
}

// ── 状態ノード定義 ──

interface StatusDef {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
}

const SITE_STATUSES: StatusDef[] = [
  { id: "new", label: "新規\n検知", x: 50, y: 200, color: "#1976d2" },
  { id: "triaged", label: "トリアージ\n済", x: 250, y: 200, color: "#7b1fa2" },
  { id: "field_check_required", label: "現地確認\n要", x: 450, y: 120, color: "#ed6c02" },
  { id: "monitoring", label: "継続\n監視", x: 450, y: 280, color: "#0288d1" },
  { id: "false_positive", label: "誤検知", x: 250, y: 380, color: "#757575" },
  { id: "linked_to_case", label: "案件\n紐付け済", x: 650, y: 200, color: "#d32f2f" },
  { id: "closed", label: "クローズ", x: 850, y: 200, color: "#2e7d32" },
];

const SITE_EDGES: [string, string][] = [
  ["new", "triaged"],
  ["triaged", "field_check_required"],
  ["triaged", "monitoring"],
  ["triaged", "false_positive"],
  ["field_check_required", "linked_to_case"],
  ["field_check_required", "monitoring"],
  ["field_check_required", "false_positive"],
  ["monitoring", "field_check_required"],
  ["monitoring", "linked_to_case"],
  ["monitoring", "false_positive"],
  ["monitoring", "closed"],
  ["linked_to_case", "closed"],
  ["false_positive", "new"],
  ["closed", "new"],
];

const CASE_STATUSES: StatusDef[] = [
  { id: "open", label: "オープン", x: 50, y: 200, color: "#1976d2" },
  { id: "under_review", label: "レビュー\n中", x: 250, y: 200, color: "#7b1fa2" },
  { id: "waiting_field_check", label: "現地確認\n待ち", x: 450, y: 200, color: "#ed6c02" },
  { id: "monitoring", label: "監視中", x: 650, y: 120, color: "#0288d1" },
  { id: "action_in_progress", label: "対応中", x: 650, y: 280, color: "#d32f2f" },
  { id: "closed", label: "クローズ", x: 850, y: 200, color: "#2e7d32" },
];

const CASE_EDGES: [string, string][] = [
  ["open", "under_review"],
  ["under_review", "waiting_field_check"],
  ["waiting_field_check", "monitoring"],
  ["waiting_field_check", "action_in_progress"],
  ["monitoring", "action_in_progress"],
  ["monitoring", "closed"],
  ["action_in_progress", "monitoring"],
  ["action_in_progress", "closed"],
  ["closed", "open"],
];

// ── コンポーネント ──

export default function StateFlowDiagram({
  currentStatus,
  entityType,
  height = 440,
}: StateFlowDiagramProps) {
  const { nodes, edges } = useMemo(() => {
    const statuses = entityType === "site" ? SITE_STATUSES : CASE_STATUSES;
    const edgeDefs = entityType === "site" ? SITE_EDGES : CASE_EDGES;

    const nodes: Node[] = statuses.map((s) => ({
      id: s.id,
      position: { x: s.x, y: s.y },
      data: { label: s.label },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: s.id === currentStatus ? s.color : "#fff",
        color: s.id === currentStatus ? "#fff" : s.color,
        border: `2px solid ${s.color}`,
        borderRadius: 10,
        padding: "10px 16px",
        fontWeight: s.id === currentStatus ? 700 : 500,
        fontSize: 13,
        textAlign: "center" as const,
        boxShadow:
          s.id === currentStatus ? `0 0 12px ${s.color}66` : "0 1px 3px rgba(0,0,0,0.1)",
        whiteSpace: "pre-line" as const,
        minWidth: 100,
      },
    }));

    const edges: Edge[] = edgeDefs.map(([src, tgt], i) => ({
      id: `e-${src}-${tgt}`,
      source: src,
      target: tgt,
      animated: src === currentStatus,
      style: {
        stroke: src === currentStatus ? "#1976d2" : "#b0bec5",
        strokeWidth: src === currentStatus ? 2.5 : 1.5,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    }));

    return { nodes, edges };
  }, [currentStatus, entityType]);

  return (
    <Box sx={{ height, border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        attributionPosition="bottom-left"
      >
        <Background gap={20} size={1} color="#f0f0f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </Box>
  );
}
