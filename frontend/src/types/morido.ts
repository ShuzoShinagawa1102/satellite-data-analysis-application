/**
 * 盛土監視Ops – 型定義
 * 仕様書 §7 データ仕様に準拠
 */

// ──── 共通 ────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ──── 組織・ユーザー ────

export interface Municipality {
  id: string;
  name: string;
  code: string;
}

export interface Department {
  id: string;
  municipality: string;
  municipality_name: string;
  name: string;
}

export interface UserSummary {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  department_name: string;
}

export type UserRole = "viewer" | "operator" | "inspector" | "manager" | "admin";

// ──── 疑義地点 ────

export type SiteStatus =
  | "new"
  | "triaged"
  | "field_check_required"
  | "monitoring"
  | "false_positive"
  | "linked_to_case"
  | "closed";

export type PermitMatchStatus =
  | "unmatched"
  | "matched"
  | "mismatch"
  | "not_applicable";

export interface DetectedSiteListItem {
  id: string;
  site_id_display: string;
  status: SiteStatus;
  status_display: string;
  latitude: number;
  longitude: number;
  address: string;
  region: string;
  risk_score: number;
  is_continuous: boolean;
  recommended_action: string;
  permit_match_status: PermitMatchStatus;
  permit_match_status_display: string;
  assigned_to: number | null;
  assigned_to_name: string;
  detected_at: string;
  updated_at: string;
}

export interface Observation {
  id: string;
  site: string;
  observed_at: string;
  source: string;
  image_url: string;
  diff_image_url: string;
  metadata: Record<string, unknown>;
}

export interface SiteScreening {
  id: string;
  site: string;
  screened_by: number | null;
  screened_by_name: string;
  risk_score_override: number | null;
  recommended_action: string;
  judgment: string;
  reason: string;
  screened_at: string;
}

export interface PermitMatch {
  id: string;
  site: string;
  permit_number: string;
  match_result: PermitMatchStatus;
  memo: string;
  matched_at: string;
}

export interface FieldInspection {
  id: string;
  site: string;
  inspector: number | null;
  inspector_name: string;
  inspected_at: string;
  result: InspectionResult;
  result_display: string;
  finding: string;
  latitude: number | null;
  longitude: number | null;
  next_check_date: string | null;
}

export type InspectionResult =
  | "monitoring"
  | "false_positive"
  | "case_required"
  | "re_check";

export interface DetectedSiteDetail extends DetectedSiteListItem {
  observations: Observation[];
  screenings: SiteScreening[];
  permit_matches: PermitMatch[];
  inspections: FieldInspection[];
  case_ids: string[];
  municipality: string | null;
}

// ──── 案件 ────

export type CaseStatus =
  | "open"
  | "under_review"
  | "waiting_field_check"
  | "monitoring"
  | "action_in_progress"
  | "closed";

export type CasePriority = "low" | "medium" | "high" | "critical";

export interface CaseListItem {
  id: string;
  case_number: string;
  title: string;
  status: CaseStatus;
  status_display: string;
  priority: CasePriority;
  priority_display: string;
  assigned_to: number | null;
  assigned_to_name: string;
  related_site_count: number;
  due_date: string | null;
  stale_days: number;
  created_at: string;
  updated_at: string;
}

export interface CaseComment {
  id: string;
  case: string;
  author: number | null;
  author_name: string;
  body: string;
  created_at: string;
}

export interface CaseDetail extends CaseListItem {
  comments: CaseComment[];
  sites: DetectedSiteListItem[];
  municipality: string | null;
}

// ──── 添付 ────

export interface Attachment {
  id: string;
  target_type: "detected_site" | "inspection" | "case";
  target_id: string;
  file: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  uploaded_by: number | null;
  uploaded_by_name: string;
  created_at: string;
}

// ──── 監査ログ ────

export interface AuditLog {
  id: string;
  event_type: string;
  event_type_display: string;
  target_type: string;
  target_id: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  description: string;
  actor: number | null;
  actor_name: string;
  acted_at: string;
}

// ──── ジョブ ────

export interface JobRun {
  id: string;
  job_type: string;
  job_type_display: string;
  status: string;
  status_display: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string;
  triggered_by: number | null;
  created_at: string;
}

// ──── ダッシュボード ────

export interface DashboardSummary {
  new_sites_count: number;
  high_risk_count: number;
  field_check_pending_count: number;
  stale_cases_count: number;
  completion_rate: number;
  false_positive_count: number;
  status_breakdown: Record<string, number>;
  region_breakdown: Record<string, number>;
}

// ──── レポート ────

export interface MonthlyReport {
  period_start: string;
  period_end: string;
  total_sites_detected: number;
  status_breakdown: Record<string, number>;
  region_breakdown: Record<string, number>;
  total_cases_created: number;
  high_risk_sites: number;
  false_positive_count: number;
}

// ──── GeoJSON ────

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface SiteGeoFeature {
  type: "Feature";
  id: string;
  geometry: GeoJSONPoint;
  properties: {
    site_id_display: string;
    status: SiteStatus;
    status_display: string;
    risk_score: number;
    region: string;
    address: string;
    is_continuous: boolean;
    permit_match_status: PermitMatchStatus;
    permit_match_status_display: string;
    assigned_to_name: string;
    detected_at: string | null;
    updated_at: string | null;
  };
}

export interface SiteGeoJSON {
  type: "FeatureCollection";
  features: SiteGeoFeature[];
}

// ──── 衛星データ (Sentinel-2 STAC) ────

export interface SatelliteSceneProperties {
  scene_id: string;
  collection: string;
  datetime: string;
  cloud_cover: number | null;
  platform: string;
  mgrs_tile: string;
  constellation: string;
  processing_level: string;
  sun_elevation: number | null;
  thumbnail_url: string;
  visual_url: string;
  scl_url: string;
}

export interface SatelliteSceneFeature {
  type: "Feature";
  id: string;
  geometry: GeoJSONPolygon;
  bbox: number[];
  properties: SatelliteSceneProperties;
}

export interface SatelliteSearchResult {
  type: "FeatureCollection";
  numberMatched: number;
  numberReturned: number;
  features: SatelliteSceneFeature[];
  error?: string;
}

// ──── 時系列集計 ────

export interface WeeklyEntry {
  week: string;
  new_sites: number;
  inspections_done: number;
  cases_created: number;
}

export interface TimeseriesData {
  weeks: WeeklyEntry[];
  pending_count: number;
}

// ──── NDVI 変化検出 ────

export interface ChangeCandidate {
  latitude: number;
  longitude: number;
  ndvi_before: number;
  ndvi_after: number;
  ndvi_change: number;
  risk_score: number;
  area_m2: number;
  pixel_count: number;
}

export interface ChangeDetectionSceneInfo {
  scene_id: string;
  datetime: string;
  cloud_cover: number | null;
}

export interface ChangeDetectionResult {
  before_scene: ChangeDetectionSceneInfo;
  after_scene: ChangeDetectionSceneInfo;
  parameters: {
    bbox: number[];
    ndvi_threshold: number;
    overview_factor: number;
    resolution_m: number;
    min_cluster_pixels: number;
  };
  candidates: ChangeCandidate[];
  stats: {
    total_pixels: number;
    changed_pixels: number;
    candidate_clusters: number;
    processing_time_sec: number;
    image_shape: number[];
  };
  error?: string;
}
