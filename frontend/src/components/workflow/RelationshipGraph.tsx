/**
 * 盛土監視Ops – 地点の関係図（関係性可視化）
 *
 * 選択中の疑義地点を中心に、関連する観測・許認可・現地確認・案件を
 * ノード/エッジで表示し、「この地点がなぜ案件化されたか」を視覚的に追える
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
import type { DetectedSiteDetail } from "../../types/morido";

// ── 型 ──

interface RelationshipGraphProps {
  site: DetectedSiteDetail;
  height?: number;
}

// ── ノード色 ──
const COLORS = {
  site: "#1565c0",
  observation: "#7b1fa2",
  screening: "#00838f",
  permit: "#e65100",
  inspection: "#2e7d32",
  case: "#c62828",
  person: "#546e7a",
};

function makeNodeStyle(bg: string, isCentral = false): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: `2px solid ${bg}`,
    borderRadius: isCentral ? 16 : 8,
    padding: isCentral ? "14px 20px" : "8px 14px",
    fontWeight: isCentral ? 700 : 500,
    fontSize: isCentral ? 14 : 12,
    textAlign: "center",
    boxShadow: isCentral ? `0 0 16px ${bg}55` : "0 1px 3px rgba(0,0,0,0.15)",
    whiteSpace: "pre-line" as const,
    minWidth: isCentral ? 120 : 90,
  };
}

// ── コンポーネント ──

export default function RelationshipGraph({ site, height = 500 }: RelationshipGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const cx = 400;
    const cy = 250;

    // 中心ノード: 疑義地点
    nodes.push({
      id: "site",
      position: { x: cx, y: cy },
      data: { label: `📍 ${site.site_id_display}\n${site.region}` },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: makeNodeStyle(COLORS.site, true),
    });

    // 観測データ
    const obsCount = site.observations.length;
    site.observations.slice(0, 5).forEach((obs, i) => {
      const id = `obs-${i}`;
      const angle = (-Math.PI / 3) + (i * Math.PI / 6);
      nodes.push({
        id,
        position: {
          x: cx + 250 * Math.cos(angle) - 100,
          y: cy + 180 * Math.sin(angle) - 200,
        },
        data: {
          label: `🛰 ${obs.source || "観測"}\n${new Date(obs.observed_at).toLocaleDateString("ja-JP")}`,
        },
        style: makeNodeStyle(COLORS.observation),
      });
      edges.push({
        id: `e-site-${id}`,
        source: "site",
        target: id,
        label: "観測",
        style: { stroke: COLORS.observation, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      });
    });
    if (obsCount > 5) {
      nodes.push({
        id: "obs-more",
        position: { x: cx - 200, y: cy - 280 },
        data: { label: `… 他 ${obsCount - 5} 件` },
        style: { ...makeNodeStyle(COLORS.observation), opacity: 0.6 },
      });
    }

    // 許認可照合
    site.permit_matches.slice(0, 3).forEach((pm, i) => {
      const id = `permit-${i}`;
      nodes.push({
        id,
        position: { x: cx + 280, y: cy - 120 + i * 80 },
        data: { label: `📋 ${pm.permit_number || "許認可"}\n${pm.match_result}` },
        style: makeNodeStyle(COLORS.permit),
      });
      edges.push({
        id: `e-site-${id}`,
        source: "site",
        target: id,
        label: "照合",
        style: { stroke: COLORS.permit, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      });
    });

    // トリアージ
    site.screenings.slice(0, 3).forEach((sc, i) => {
      const id = `scr-${i}`;
      nodes.push({
        id,
        position: { x: cx - 300, y: cy - 60 + i * 80 },
        data: { label: `🔍 ${sc.judgment}\n${sc.screened_by_name || ""}` },
        style: makeNodeStyle(COLORS.screening),
      });
      edges.push({
        id: `e-site-${id}`,
        source: "site",
        target: id,
        label: "判定",
        style: { stroke: COLORS.screening, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      });
    });

    // 現地確認
    site.inspections.slice(0, 3).forEach((insp, i) => {
      const id = `insp-${i}`;
      nodes.push({
        id,
        position: { x: cx - 250, y: cy + 120 + i * 80 },
        data: {
          label: `🏗 ${insp.result_display}\n${new Date(insp.inspected_at).toLocaleDateString("ja-JP")}`,
        },
        style: makeNodeStyle(COLORS.inspection),
      });
      edges.push({
        id: `e-site-${id}`,
        source: "site",
        target: id,
        label: "確認",
        style: { stroke: COLORS.inspection, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      });
    });

    // 案件
    site.case_ids.forEach((caseId, i) => {
      const id = `case-${i}`;
      nodes.push({
        id,
        position: { x: cx + 300, y: cy + 100 + i * 80 },
        data: { label: `📁 案件\n${caseId.slice(0, 8)}` },
        style: makeNodeStyle(COLORS.case),
      });
      edges.push({
        id: `e-site-${id}`,
        source: "site",
        target: id,
        label: "紐付け",
        animated: true,
        style: { stroke: COLORS.case, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      });
    });

    // 担当者
    if (site.assigned_to_name) {
      nodes.push({
        id: "assignee",
        position: { x: cx + 180, y: cy + 220 },
        data: { label: `👤 ${site.assigned_to_name}` },
        style: makeNodeStyle(COLORS.person),
      });
      edges.push({
        id: "e-site-assignee",
        source: "site",
        target: "assignee",
        label: "担当",
        style: { stroke: COLORS.person, strokeWidth: 1.5, strokeDasharray: "5 3" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      });
    }

    return { nodes, edges };
  }, [site]);

  return (
    <Box sx={{ height, border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        nodesDraggable
        nodesConnectable={false}
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
