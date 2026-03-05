/**
 * 盛土監視Ops – API クライアント
 * 仕様書 04_architecture §7.2 に準拠
 */

import axios from "axios";
import type {
  PaginatedResponse,
  DetectedSiteListItem,
  DetectedSiteDetail,
  CaseListItem,
  CaseDetail,
  CaseComment,
  FieldInspection,
  AuditLog,
  JobRun,
  DashboardSummary,
  MonthlyReport,
  SiteScreening,
  SiteGeoJSON,
  SatelliteSearchResult,
  TimeseriesData,
  ChangeDetectionResult,
} from "../types/morido";

const api = axios.create({ baseURL: "/api/v1" });

// ──── ダッシュボード ────

export const fetchDashboardSummary = (days = 30): Promise<DashboardSummary> =>
  api.get("/dashboard/summary/", { params: { days } }).then((r) => r.data);

// ──── 疑義地点 ────

export interface SiteFilters {
  status?: string;
  region?: string;
  permit_match_status?: string;
  is_continuous?: string;
  min_risk?: string;
  max_risk?: string;
  ordering?: string;
  page?: number;
}

export const fetchDetectedSites = (
  filters: SiteFilters = {}
): Promise<PaginatedResponse<DetectedSiteListItem>> =>
  api.get("/detected-sites/", { params: filters }).then((r) => r.data);

export const fetchDetectedSiteDetail = (id: string): Promise<DetectedSiteDetail> =>
  api.get(`/detected-sites/${id}/`).then((r) => r.data);

export const updateSiteStatus = (
  id: string,
  data: { status: string; reason?: string }
): Promise<DetectedSiteDetail> =>
  api.patch(`/detected-sites/${id}/status/`, data).then((r) => r.data);

export const addScreening = (
  siteId: string,
  data: { judgment: string; reason?: string; recommended_action?: string }
): Promise<SiteScreening> =>
  api.post(`/detected-sites/${siteId}/screenings/`, data).then((r) => r.data);

// ──── 現地確認 ────

export const fetchInspections = (
  siteId?: string
): Promise<PaginatedResponse<FieldInspection>> =>
  api
    .get("/inspections/", { params: siteId ? { site: siteId } : {} })
    .then((r) => r.data);

export const createInspection = (
  data: Partial<FieldInspection>
): Promise<FieldInspection> =>
  api.post("/inspections/", data).then((r) => r.data);

// ──── 案件 ────

export interface CaseFilters {
  status?: string;
  priority?: string;
  assigned_to?: string;
  overdue?: string;
  page?: number;
}

export const fetchCases = (
  filters: CaseFilters = {}
): Promise<PaginatedResponse<CaseListItem>> =>
  api.get("/cases/", { params: filters }).then((r) => r.data);

export const fetchCaseDetail = (id: string): Promise<CaseDetail> =>
  api.get(`/cases/${id}/`).then((r) => r.data);

export const createCase = (
  data: Partial<CaseDetail>
): Promise<CaseDetail> =>
  api.post("/cases/", data).then((r) => r.data);

export const updateCaseStatus = (
  id: string,
  data: { status: string; reason?: string }
): Promise<CaseDetail> =>
  api.patch(`/cases/${id}/status/`, data).then((r) => r.data);

export const addCaseComment = (
  caseId: string,
  body: string
): Promise<CaseComment> =>
  api.post(`/cases/${caseId}/comments/`, { body }).then((r) => r.data);

// ──── 監査ログ ────

export const fetchAuditLogs = (params?: {
  event_type?: string;
  target_type?: string;
  target_id?: string;
  page?: number;
}): Promise<PaginatedResponse<AuditLog>> =>
  api.get("/audit-logs/", { params }).then((r) => r.data);

// ──── ジョブ ────

export const fetchJobs = (): Promise<PaginatedResponse<JobRun>> =>
  api.get("/jobs/").then((r) => r.data);

export const retryJob = (jobId: string): Promise<JobRun> =>
  api.post(`/jobs/${jobId}/retry/`).then((r) => r.data);

// ──── レポート ────

export const fetchMonthlyReport = (days = 30): Promise<MonthlyReport> =>
  api.get("/reports/monthly/", { params: { days } }).then((r) => r.data);

// ──── 疑義地点 GeoJSON ────

export const fetchSitesGeoJSON = (filters?: SiteFilters): Promise<SiteGeoJSON> =>
  api.get("/detected-sites/geojson/", { params: filters }).then((r) => r.data);

// ──── 衛星データ (リアルタイム STAC API) ────

export interface SatelliteSearchParams {
  bbox?: string;
  date_from?: string;
  date_to?: string;
  max_cloud_cover?: number;
  limit?: number;
  auto_bbox?: string;
}

export const searchSatelliteScenes = (
  params: SatelliteSearchParams = {}
): Promise<SatelliteSearchResult> =>
  api.get("/satellite/search/", { params }).then((r) => r.data);

export const fetchSatelliteSceneDetail = (sceneId: string): Promise<Record<string, unknown>> =>
  api.get(`/satellite/scenes/${sceneId}/`).then((r) => r.data);

// ──── 時系列集計 ────

export const fetchDashboardTimeseries = (weeks = 12): Promise<TimeseriesData> =>
  api.get("/dashboard/timeseries/", { params: { weeks } }).then((r) => r.data);

// ──── NDVI 変化検出 ────

export interface ChangeDetectionParams {
  auto_bbox?: string;
  bbox?: string;
  before_start?: string;
  before_end?: string;
  after_start?: string;
  after_end?: string;
  ndvi_threshold?: number;
  max_cloud_cover?: number;
  overview_factor?: number;
  min_cluster_pixels?: number;
}

export const runChangeDetection = (
  params: ChangeDetectionParams = {}
): Promise<ChangeDetectionResult> =>
  api
    .post("/change-detection/run/", params, { timeout: 120_000 })
    .then((r) => r.data);
