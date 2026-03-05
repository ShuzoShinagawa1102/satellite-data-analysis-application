from django.contrib import admin

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


@admin.register(Municipality)
class MunicipalityAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "created_at")
    search_fields = ("name", "code")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "municipality", "created_at")
    list_filter = ("municipality",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "department", "created_at")
    list_filter = ("role",)


@admin.register(DetectedSite)
class DetectedSiteAdmin(admin.ModelAdmin):
    list_display = (
        "site_id_display",
        "status",
        "risk_score",
        "region",
        "permit_match_status",
        "detected_at",
    )
    list_filter = ("status", "permit_match_status", "region")
    search_fields = ("site_id_display", "address", "region")


@admin.register(Observation)
class ObservationAdmin(admin.ModelAdmin):
    list_display = ("site", "observed_at", "source")
    list_filter = ("source",)


@admin.register(SiteScreening)
class SiteScreeningAdmin(admin.ModelAdmin):
    list_display = ("site", "screened_by", "judgment", "screened_at")


@admin.register(PermitMatch)
class PermitMatchAdmin(admin.ModelAdmin):
    list_display = ("site", "permit_number", "match_result", "matched_at")


@admin.register(FieldInspection)
class FieldInspectionAdmin(admin.ModelAdmin):
    list_display = ("site", "inspector", "result", "inspected_at")
    list_filter = ("result",)


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = (
        "case_number",
        "title",
        "status",
        "priority",
        "assigned_to",
        "due_date",
        "updated_at",
    )
    list_filter = ("status", "priority")
    search_fields = ("case_number", "title")


@admin.register(CaseComment)
class CaseCommentAdmin(admin.ModelAdmin):
    list_display = ("case", "author", "created_at")


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "target_type", "uploaded_by", "created_at")
    list_filter = ("target_type",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("event_type", "target_type", "actor", "acted_at")
    list_filter = ("event_type", "target_type")
    readonly_fields = (
        "event_type",
        "target_type",
        "target_id",
        "before_value",
        "after_value",
        "description",
        "actor",
        "acted_at",
        "ip_address",
    )


@admin.register(JobRun)
class JobRunAdmin(admin.ModelAdmin):
    list_display = ("job_type", "status", "started_at", "finished_at", "triggered_by")
    list_filter = ("job_type", "status")
