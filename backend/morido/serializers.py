"""
盛土監視Ops – シリアライザ
"""

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    Attachment,
    AuditLog,
    Case,
    CaseComment,
    Department,
    DetectedSite,
    FieldInspection,
    JobRun,
    Municipality,
    Observation,
    PermitMatch,
    SiteScreening,
    UserProfile,
)


# ──── 組織・ユーザー ────


class MunicipalitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Municipality
        fields = "__all__"


class DepartmentSerializer(serializers.ModelSerializer):
    municipality_name = serializers.CharField(
        source="municipality.name", read_only=True
    )

    class Meta:
        model = Department
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", read_only=True)
    department_name = serializers.CharField(
        source="profile.department.name", read_only=True, default=""
    )

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role", "department_name"]


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = "__all__"

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


# ──── 観測・疑義地点 ────


class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observation
        fields = "__all__"


class SiteScreeningSerializer(serializers.ModelSerializer):
    screened_by_name = serializers.CharField(
        source="screened_by.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = SiteScreening
        fields = "__all__"
        read_only_fields = ["screened_by", "screened_at"]


class PermitMatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = PermitMatch
        fields = "__all__"


class DetectedSiteListSerializer(serializers.ModelSerializer):
    """一覧用（軽量）"""

    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True, default=""
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    permit_match_status_display = serializers.CharField(
        source="get_permit_match_status_display", read_only=True
    )

    class Meta:
        model = DetectedSite
        fields = [
            "id",
            "site_id_display",
            "status",
            "status_display",
            "latitude",
            "longitude",
            "address",
            "region",
            "risk_score",
            "is_continuous",
            "recommended_action",
            "permit_match_status",
            "permit_match_status_display",
            "assigned_to",
            "assigned_to_name",
            "detected_at",
            "updated_at",
        ]


class DetectedSiteDetailSerializer(serializers.ModelSerializer):
    """詳細用"""

    observations = ObservationSerializer(many=True, read_only=True)
    screenings = SiteScreeningSerializer(many=True, read_only=True)
    permit_matches = PermitMatchSerializer(many=True, read_only=True)
    inspections = serializers.SerializerMethodField()
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True, default=""
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    case_ids = serializers.SerializerMethodField()

    class Meta:
        model = DetectedSite
        fields = "__all__"

    def get_inspections(self, obj):
        qs = obj.inspections.all()
        return FieldInspectionSerializer(qs, many=True).data

    def get_case_ids(self, obj):
        return list(obj.cases.values_list("id", flat=True))


class DetectedSiteStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=DetectedSite.Status.choices)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


# ──── 現地確認 ────


class FieldInspectionSerializer(serializers.ModelSerializer):
    inspector_name = serializers.CharField(
        source="inspector.get_full_name", read_only=True, default=""
    )
    result_display = serializers.CharField(
        source="get_result_display", read_only=True
    )

    class Meta:
        model = FieldInspection
        fields = "__all__"
        read_only_fields = ["inspector", "created_at", "updated_at"]


# ──── 案件 ────


class CaseCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(
        source="author.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = CaseComment
        fields = "__all__"
        read_only_fields = ["author", "created_at"]


class CaseListSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True, default=""
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    priority_display = serializers.CharField(
        source="get_priority_display", read_only=True
    )
    related_site_count = serializers.IntegerField(
        source="sites.count", read_only=True
    )
    stale_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = Case
        fields = [
            "id",
            "case_number",
            "title",
            "status",
            "status_display",
            "priority",
            "priority_display",
            "assigned_to",
            "assigned_to_name",
            "related_site_count",
            "due_date",
            "stale_days",
            "created_at",
            "updated_at",
        ]


class CaseDetailSerializer(serializers.ModelSerializer):
    comments = CaseCommentSerializer(many=True, read_only=True)
    sites = DetectedSiteListSerializer(many=True, read_only=True)
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True, default=""
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    priority_display = serializers.CharField(
        source="get_priority_display", read_only=True
    )
    stale_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = Case
        fields = "__all__"


class CaseStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Case.Status.choices)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


# ──── 添付 ────


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = Attachment
        fields = "__all__"
        read_only_fields = ["uploaded_by", "created_at", "file_size", "content_type"]


# ──── 監査ログ ────


class AuditLogSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(
        source="get_event_type_display", read_only=True
    )
    actor_name = serializers.CharField(
        source="actor.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = AuditLog
        fields = "__all__"


# ──── ジョブ ────


class JobRunSerializer(serializers.ModelSerializer):
    job_type_display = serializers.CharField(
        source="get_job_type_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = JobRun
        fields = "__all__"


# ──── ダッシュボード集計 ────


class DashboardSummarySerializer(serializers.Serializer):
    new_sites_count = serializers.IntegerField()
    high_risk_count = serializers.IntegerField()
    field_check_pending_count = serializers.IntegerField()
    stale_cases_count = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    false_positive_count = serializers.IntegerField()
    status_breakdown = serializers.DictField()
    region_breakdown = serializers.DictField()
