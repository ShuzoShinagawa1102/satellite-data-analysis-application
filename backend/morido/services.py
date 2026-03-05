"""
盛土監視Ops – アプリケーションサービス
状態遷移・監査ログ記録をView層から分離する
"""

from django.utils import timezone

from .models import AuditLog, Case, DetectedSite


def _record_audit(
    event_type: str,
    target_type: str,
    target_id,
    actor=None,
    before=None,
    after=None,
    description: str = "",
    ip_address: str | None = None,
):
    AuditLog.objects.create(
        event_type=event_type,
        target_type=target_type,
        target_id=target_id,
        actor=actor,
        before_value=before,
        after_value=after,
        description=description,
        ip_address=ip_address,
    )


def transition_site_status(site: DetectedSite, new_status: str, actor=None, reason: str = ""):
    """疑義地点の状態遷移（バリデーション＋監査ログ）"""
    old_status = site.status
    if not site.can_transition_to(new_status):
        raise ValueError(
            f"'{site.get_status_display()}'から'{dict(DetectedSite.Status.choices).get(new_status, new_status)}'への遷移は許可されていません"
        )
    site.status = new_status
    site.save(update_fields=["status", "updated_at"])

    _record_audit(
        event_type=AuditLog.EventType.STATUS_CHANGE,
        target_type="detected_site",
        target_id=site.pk,
        actor=actor,
        before={"status": old_status},
        after={"status": new_status},
        description=reason,
    )
    return site


def transition_case_status(case: Case, new_status: str, actor=None, reason: str = ""):
    """案件の状態遷移（バリデーション＋監査ログ）"""
    old_status = case.status
    if not case.can_transition_to(new_status):
        raise ValueError(
            f"'{case.get_status_display()}'から'{dict(Case.Status.choices).get(new_status, new_status)}'への遷移は許可されていません"
        )
    case.status = new_status
    case.save(update_fields=["status", "updated_at"])

    _record_audit(
        event_type=AuditLog.EventType.STATUS_CHANGE,
        target_type="case",
        target_id=case.pk,
        actor=actor,
        before={"status": old_status},
        after={"status": new_status},
        description=reason,
    )
    return case


def create_inspection_audit(inspection, actor=None):
    _record_audit(
        event_type=AuditLog.EventType.INSPECTION_CREATED,
        target_type="field_inspection",
        target_id=inspection.pk,
        actor=actor,
        after={"site": str(inspection.site_id), "result": inspection.result},
    )


def create_case_audit(case, actor=None):
    _record_audit(
        event_type=AuditLog.EventType.CASE_CREATED,
        target_type="case",
        target_id=case.pk,
        actor=actor,
        after={"title": case.title, "status": case.status},
    )


def add_comment_audit(comment, actor=None):
    _record_audit(
        event_type=AuditLog.EventType.COMMENT_ADDED,
        target_type="case",
        target_id=comment.case_id,
        actor=actor,
        after={"body": comment.body[:200]},
    )


def screening_audit(screening, actor=None):
    _record_audit(
        event_type=AuditLog.EventType.SCREENING_SAVED,
        target_type="detected_site",
        target_id=screening.site_id,
        actor=actor,
        after={"judgment": screening.judgment, "reason": screening.reason[:200]},
    )
