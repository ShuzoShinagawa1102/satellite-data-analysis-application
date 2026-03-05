"""
盛土監視Ops – API Views
仕様書 §7.2 APIエンドポイントに準拠
"""

from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncWeek
from django.utils import timezone
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import (
    Attachment,
    AuditLog,
    Case,
    CaseComment,
    DetectedSite,
    FieldInspection,
    JobRun,
    Observation,
    PermitMatch,
    SiteScreening,
)
from .satellite_client import (
    build_bbox_from_sites,
    get_scene_detail,
    search_sentinel2_scenes,
)
from .serializers import (
    AttachmentSerializer,
    AuditLogSerializer,
    CaseCommentSerializer,
    CaseDetailSerializer,
    CaseListSerializer,
    CaseStatusUpdateSerializer,
    DashboardSummarySerializer,
    DetectedSiteDetailSerializer,
    DetectedSiteListSerializer,
    DetectedSiteStatusUpdateSerializer,
    FieldInspectionSerializer,
    JobRunSerializer,
    ObservationSerializer,
    PermitMatchSerializer,
    SiteScreeningSerializer,
)
from .services import (
    add_comment_audit,
    create_case_audit,
    create_inspection_audit,
    screening_audit,
    transition_case_status,
    transition_site_status,
)


# ──── ダッシュボード ────


@api_view(["GET"])
@permission_classes([AllowAny])
def dashboard_summary(request):
    """SCR-001 監視統括ダッシュボード集計 API"""
    # 期間フィルタ
    days = int(request.query_params.get("days", 30))
    since = timezone.now() - timedelta(days=days)

    sites = DetectedSite.objects.all()
    cases = Case.objects.all()

    new_sites = sites.filter(detected_at__gte=since, status=DetectedSite.Status.NEW).count()
    high_risk = sites.filter(risk_score__gte=0.7).exclude(
        status__in=[DetectedSite.Status.CLOSED, DetectedSite.Status.FALSE_POSITIVE]
    ).count()
    field_check_pending = sites.filter(
        status=DetectedSite.Status.FIELD_CHECK_REQUIRED
    ).count()

    stale_threshold = 14  # 日
    stale_cutoff = timezone.now() - timedelta(days=stale_threshold)
    stale_cases = cases.exclude(status=Case.Status.CLOSED).filter(
        updated_at__lt=stale_cutoff
    ).count()

    total_sites = sites.count()
    closed_sites = sites.filter(status=DetectedSite.Status.CLOSED).count()
    completion_rate = (closed_sites / total_sites * 100) if total_sites > 0 else 0.0

    false_positive = sites.filter(
        status=DetectedSite.Status.FALSE_POSITIVE, updated_at__gte=since
    ).count()

    # ステータス別件数
    status_breakdown = dict(
        sites.values_list("status").annotate(c=Count("id")).values_list("status", "c")
    )
    # 地域別件数
    region_breakdown = dict(
        sites.exclude(region="")
        .values_list("region")
        .annotate(c=Count("id"))
        .values_list("region", "c")
    )

    data = {
        "new_sites_count": new_sites,
        "high_risk_count": high_risk,
        "field_check_pending_count": field_check_pending,
        "stale_cases_count": stale_cases,
        "completion_rate": round(completion_rate, 1),
        "false_positive_count": false_positive,
        "status_breakdown": status_breakdown,
        "region_breakdown": region_breakdown,
    }
    return Response(DashboardSummarySerializer(data).data)


# ──── 疑義地点 ────


class DetectedSiteViewSet(viewsets.ModelViewSet):
    """疑義地点 CRUD + 状態遷移 + トリアージ"""

    queryset = DetectedSite.objects.all()
    permission_classes = [AllowAny]  # たたき台段階; 後でRBAC

    def get_serializer_class(self):
        if self.action == "list":
            return DetectedSiteListSerializer
        return DetectedSiteDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        # フィルタ
        if s := params.get("status"):
            qs = qs.filter(status=s)
        if r := params.get("region"):
            qs = qs.filter(region__icontains=r)
        if pm := params.get("permit_match_status"):
            qs = qs.filter(permit_match_status=pm)
        if params.get("is_continuous"):
            qs = qs.filter(is_continuous=params["is_continuous"].lower() == "true")
        if min_risk := params.get("min_risk"):
            qs = qs.filter(risk_score__gte=float(min_risk))
        if max_risk := params.get("max_risk"):
            qs = qs.filter(risk_score__lte=float(max_risk))

        # ソート
        ordering = params.get("ordering", "-risk_score")
        qs = qs.order_by(ordering)
        return qs

    @action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request, pk=None):
        """PATCH /api/v1/detected-sites/{id}/status"""
        site = self.get_object()
        ser = DetectedSiteStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            transition_site_status(
                site,
                ser.validated_data["status"],
                actor=request.user if request.user.is_authenticated else None,
                reason=ser.validated_data.get("reason", ""),
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DetectedSiteDetailSerializer(site).data)

    @action(detail=True, methods=["post"], url_path="screenings")
    def add_screening(self, request, pk=None):
        """POST /api/v1/detected-sites/{id}/screenings"""
        site = self.get_object()
        ser = SiteScreeningSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        screening = ser.save(
            site=site,
            screened_by=request.user if request.user.is_authenticated else None,
        )
        screening_audit(screening, actor=request.user if request.user.is_authenticated else None)
        return Response(SiteScreeningSerializer(screening).data, status=status.HTTP_201_CREATED)


# ──── 現地確認 ────


class FieldInspectionViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = FieldInspection.objects.all()
    serializer_class = FieldInspectionSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        if site_id := self.request.query_params.get("site"):
            qs = qs.filter(site_id=site_id)
        return qs

    def perform_create(self, serializer):
        inspection = serializer.save(
            inspector=self.request.user if self.request.user.is_authenticated else None,
        )
        create_inspection_audit(
            inspection,
            actor=self.request.user if self.request.user.is_authenticated else None,
        )


# ──── 案件 ────


class CaseViewSet(viewsets.ModelViewSet):
    queryset = Case.objects.all()
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action == "list":
            return CaseListSerializer
        return CaseDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        if s := params.get("status"):
            qs = qs.filter(status=s)
        if p := params.get("priority"):
            qs = qs.filter(priority=p)
        if assigned := params.get("assigned_to"):
            qs = qs.filter(assigned_to_id=assigned)
        if params.get("overdue") == "true":
            qs = qs.filter(due_date__lt=timezone.now().date()).exclude(
                status=Case.Status.CLOSED
            )
        return qs

    def perform_create(self, serializer):
        case = serializer.save()
        create_case_audit(
            case,
            actor=self.request.user if self.request.user.is_authenticated else None,
        )

    @action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request, pk=None):
        case = self.get_object()
        ser = CaseStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            transition_case_status(
                case,
                ser.validated_data["status"],
                actor=request.user if request.user.is_authenticated else None,
                reason=ser.validated_data.get("reason", ""),
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CaseDetailSerializer(case).data)

    @action(detail=True, methods=["post"])
    def comments(self, request, pk=None):
        case = self.get_object()
        ser = CaseCommentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = ser.save(
            case=case,
            author=request.user if request.user.is_authenticated else None,
        )
        add_comment_audit(
            comment,
            actor=request.user if request.user.is_authenticated else None,
        )
        return Response(CaseCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


# ──── 監査ログ ────


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        if et := params.get("event_type"):
            qs = qs.filter(event_type=et)
        if tt := params.get("target_type"):
            qs = qs.filter(target_type=tt)
        if tid := params.get("target_id"):
            qs = qs.filter(target_id=tid)
        return qs


# ──── ジョブ ────


class JobRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = JobRun.objects.all()
    serializer_class = JobRunSerializer
    permission_classes = [AllowAny]

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        job = self.get_object()
        if job.status not in ("failed", "cancelled"):
            return Response(
                {"error": "failed / cancelled 状態のジョブのみ再実行できます"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # たたき台: 実際のジョブキュー投入はTODO
        job.status = JobRun.Status.QUEUED
        job.error_message = ""
        job.save(update_fields=["status", "error_message"])
        return Response(JobRunSerializer(job).data)


# ──── レポート（スタブ）────


@api_view(["GET"])
@permission_classes([AllowAny])
def monthly_report(request):
    """GET /api/v1/reports/monthly – 月次レポートデータ"""
    days = int(request.query_params.get("days", 30))
    since = timezone.now() - timedelta(days=days)

    sites = DetectedSite.objects.filter(detected_at__gte=since)
    cases = Case.objects.filter(created_at__gte=since)

    data = {
        "period_start": since.isoformat(),
        "period_end": timezone.now().isoformat(),
        "total_sites_detected": sites.count(),
        "status_breakdown": dict(
            sites.values("status").annotate(c=Count("id")).values_list("status", "c")
        ),
        "region_breakdown": dict(
            sites.exclude(region="").values("region").annotate(c=Count("id")).values_list("region", "c")
        ),
        "total_cases_created": cases.count(),
        "high_risk_sites": sites.filter(risk_score__gte=0.7).count(),
        "false_positive_count": sites.filter(status=DetectedSite.Status.FALSE_POSITIVE).count(),
    }
    return Response(data)


# ──── GeoJSON ────


@api_view(["GET"])
@permission_classes([AllowAny])
def detected_sites_geojson(request):
    """GET /api/v1/detected-sites/geojson – 疑義地点 GeoJSON"""
    qs = DetectedSite.objects.all()

    params = request.query_params
    if s := params.get("status"):
        qs = qs.filter(status=s)
    if r := params.get("region"):
        qs = qs.filter(region__icontains=r)
    if pm := params.get("permit_match_status"):
        qs = qs.filter(permit_match_status=pm)
    if min_risk := params.get("min_risk"):
        qs = qs.filter(risk_score__gte=float(min_risk))
    if max_risk := params.get("max_risk"):
        qs = qs.filter(risk_score__lte=float(max_risk))

    features = []
    for site in qs.select_related("assigned_to"):
        features.append({
            "type": "Feature",
            "id": str(site.id),
            "geometry": {
                "type": "Point",
                "coordinates": [site.longitude, site.latitude],
            },
            "properties": {
                "site_id_display": site.site_id_display,
                "status": site.status,
                "status_display": site.get_status_display(),
                "risk_score": site.risk_score,
                "region": site.region,
                "address": site.address,
                "is_continuous": site.is_continuous,
                "permit_match_status": site.permit_match_status,
                "permit_match_status_display": site.get_permit_match_status_display(),
                "assigned_to_name": (
                    site.assigned_to.get_full_name() or site.assigned_to.username
                    if site.assigned_to else ""
                ),
                "detected_at": site.detected_at.isoformat() if site.detected_at else None,
                "updated_at": site.updated_at.isoformat() if site.updated_at else None,
            },
        })

    return Response({
        "type": "FeatureCollection",
        "features": features,
    })


# ──── 衛星データ検索 (リアルタイム STAC API) ────


@api_view(["GET"])
@permission_classes([AllowAny])
def satellite_search(request):
    """
    GET /api/v1/satellite/search – Sentinel-2 衛星シーン検索

    Query params:
        bbox: lon_min,lat_min,lon_max,lat_max (カンマ区切り)
        date_from: 開始日 (YYYY-MM-DD)
        date_to: 終了日
        max_cloud_cover: 最大雲量 (%, default=30)
        limit: 件数 (default=20)
        auto_bbox: "true" の場合、登録疑義地点の bbox を自動計算
    """
    params = request.query_params

    bbox = None
    if params.get("auto_bbox", "").lower() == "true":
        bbox = build_bbox_from_sites(DetectedSite.objects.all())
    elif bbox_str := params.get("bbox"):
        try:
            bbox = [float(x) for x in bbox_str.split(",")]
        except (ValueError, TypeError):
            return Response(
                {"error": "bbox は lon_min,lat_min,lon_max,lat_max 形式で指定してください"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    result = search_sentinel2_scenes(
        bbox=bbox,
        date_from=params.get("date_from"),
        date_to=params.get("date_to"),
        max_cloud_cover=float(params.get("max_cloud_cover", 30)),
        limit=int(params.get("limit", 20)),
    )

    if "error" in result:
        return Response(result, status=status.HTTP_502_BAD_GATEWAY)

    return Response(result)


@api_view(["GET"])
@permission_classes([AllowAny])
def satellite_scene_detail(request, scene_id: str):
    """GET /api/v1/satellite/scenes/<scene_id> – 個別シーンの詳細"""
    detail = get_scene_detail(scene_id)
    if detail is None:
        return Response(
            {"error": "シーンが見つかりません"},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response(detail)


# ──── 時系列集計 ────


@api_view(["GET"])
@permission_classes([AllowAny])
def dashboard_timeseries(request):
    """
    GET /api/v1/dashboard/timeseries – 週次推移データ (KPIグラフ用)

    Query params:
        weeks: 何週間分 (default=12)
    """
    weeks = int(request.query_params.get("weeks", 12))
    since = timezone.now() - timedelta(weeks=weeks)

    # 週別・新規疑義地点
    new_sites_weekly = (
        DetectedSite.objects.filter(detected_at__gte=since)
        .annotate(week=TruncWeek("detected_at"))
        .values("week")
        .annotate(count=Count("id"))
        .order_by("week")
    )

    # 週別・現地確認完了
    inspections_weekly = (
        FieldInspection.objects.filter(inspected_at__gte=since)
        .annotate(week=TruncWeek("inspected_at"))
        .values("week")
        .annotate(count=Count("id"))
        .order_by("week")
    )

    # 週別・案件作成
    cases_weekly = (
        Case.objects.filter(created_at__gte=since)
        .annotate(week=TruncWeek("created_at"))
        .values("week")
        .annotate(count=Count("id"))
        .order_by("week")
    )

    # 全週を生成してマージ
    week_map: dict[str, dict] = {}
    for i in range(weeks):
        wk = since + timedelta(weeks=i)
        wk_key = wk.strftime("%Y-%m-%d")
        week_map[wk_key] = {
            "week": wk_key,
            "new_sites": 0,
            "inspections_done": 0,
            "cases_created": 0,
        }

    for entry in new_sites_weekly:
        key = entry["week"].strftime("%Y-%m-%d")
        if key in week_map:
            week_map[key]["new_sites"] = entry["count"]

    for entry in inspections_weekly:
        key = entry["week"].strftime("%Y-%m-%d")
        if key in week_map:
            week_map[key]["inspections_done"] = entry["count"]

    for entry in cases_weekly:
        key = entry["week"].strftime("%Y-%m-%d")
        if key in week_map:
            week_map[key]["cases_created"] = entry["count"]

    # 未対応数（現在の累計）
    pending_count = DetectedSite.objects.filter(
        status__in=[
            DetectedSite.Status.NEW,
            DetectedSite.Status.TRIAGED,
            DetectedSite.Status.FIELD_CHECK_REQUIRED,
        ]
    ).count()

    return Response({
        "weeks": sorted(week_map.values(), key=lambda x: x["week"]),
        "pending_count": pending_count,
    })
