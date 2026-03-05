"""
盛土監視Ops – データモデル
仕様書 03_specification §7, 04_architecture §6 に準拠
"""

import uuid

from django.conf import settings
from django.db import models


# ──────────────────────────────────────────────
# 組織・ユーザー関連
# ──────────────────────────────────────────────


class Municipality(models.Model):
    """自治体"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField("自治体名", max_length=120)
    code = models.CharField("自治体コード", max_length=10, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "自治体"
        verbose_name_plural = "自治体"
        ordering = ["code"]

    def __str__(self):
        return self.name


class Department(models.Model):
    """部署"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    municipality = models.ForeignKey(
        Municipality, on_delete=models.CASCADE, related_name="departments"
    )
    name = models.CharField("部署名", max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "部署"
        verbose_name_plural = "部署"

    def __str__(self):
        return f"{self.municipality.name} / {self.name}"


class UserProfile(models.Model):
    """ユーザープロファイル（Django auth.User を拡張）"""

    class Role(models.TextChoices):
        VIEWER = "viewer", "閲覧者"
        OPERATOR = "operator", "監視担当"
        INSPECTOR = "inspector", "現地確認担当"
        MANAGER = "manager", "管理者"
        ADMIN = "admin", "システム管理者"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
    )
    role = models.CharField("ロール", max_length=20, choices=Role.choices, default=Role.VIEWER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ユーザープロファイル"
        verbose_name_plural = "ユーザープロファイル"

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.get_role_display()})"


# ──────────────────────────────────────────────
# 観測・疑義地点
# ──────────────────────────────────────────────


class DetectedSite(models.Model):
    """疑義地点（AI/ルールにより抽出された確認対象）"""

    class Status(models.TextChoices):
        NEW = "new", "新規"
        TRIAGED = "triaged", "トリアージ済"
        FIELD_CHECK_REQUIRED = "field_check_required", "現地確認要"
        MONITORING = "monitoring", "継続監視"
        FALSE_POSITIVE = "false_positive", "誤検知"
        LINKED_TO_CASE = "linked_to_case", "案件紐付け済"
        CLOSED = "closed", "クローズ"

    # 有効な状態遷移マップ
    VALID_TRANSITIONS = {
        "new": ["triaged"],
        "triaged": ["field_check_required", "monitoring", "false_positive"],
        "field_check_required": ["linked_to_case", "monitoring", "false_positive"],
        "monitoring": ["field_check_required", "linked_to_case", "false_positive", "closed"],
        "false_positive": ["new"],  # 再オープン
        "linked_to_case": ["closed"],
        "closed": ["new"],  # 再オープン
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site_id_display = models.CharField(
        "疑義地点ID（表示用）", max_length=30, unique=True, blank=True
    )
    status = models.CharField(
        "状態", max_length=30, choices=Status.choices, default=Status.NEW
    )

    # 位置情報（たたき台段階では float; PostGIS移行時に PointField に変更）
    latitude = models.FloatField("緯度")
    longitude = models.FloatField("経度")
    address = models.CharField("住所/地名", max_length=300, blank=True)
    region = models.CharField("地域（区等）", max_length=120, blank=True)

    # リスク・トリアージ
    risk_score = models.FloatField("リスクスコア", default=0.0)
    is_continuous = models.BooleanField("継続的検知", default=False)
    recommended_action = models.CharField("推奨アクション", max_length=200, blank=True)

    # 許認可照合
    class PermitMatchStatus(models.TextChoices):
        UNMATCHED = "unmatched", "未照合"
        MATCHED = "matched", "一致"
        MISMATCH = "mismatch", "不一致"
        NOT_APPLICABLE = "not_applicable", "対象外"

    permit_match_status = models.CharField(
        "許認可照合状態",
        max_length=20,
        choices=PermitMatchStatus.choices,
        default=PermitMatchStatus.UNMATCHED,
    )

    # 担当・組織
    municipality = models.ForeignKey(
        Municipality, on_delete=models.CASCADE, related_name="detected_sites", null=True, blank=True
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_sites",
        verbose_name="担当者",
    )

    detected_at = models.DateTimeField("検知日時")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "疑義地点"
        verbose_name_plural = "疑義地点"
        ordering = ["-detected_at"]

    def __str__(self):
        return self.site_id_display or str(self.id)[:8]

    def save(self, *args, **kwargs):
        if not self.site_id_display:
            self.site_id_display = f"DS-{str(self.id)[:8].upper()}"
        super().save(*args, **kwargs)

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])


class Observation(models.Model):
    """観測単位（時点ごとの入力/特徴/結果）"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.ForeignKey(
        DetectedSite, on_delete=models.CASCADE, related_name="observations"
    )
    observed_at = models.DateTimeField("観測日時")
    source = models.CharField("データソース", max_length=120, blank=True)
    image_url = models.URLField("観測画像URL", blank=True)
    diff_image_url = models.URLField("差分画像URL", blank=True)
    metadata = models.JSONField("メタデータ", default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "観測"
        verbose_name_plural = "観測"
        ordering = ["-observed_at"]

    def __str__(self):
        return f"{self.site} / {self.observed_at:%Y-%m-%d}"


class SiteScreening(models.Model):
    """トリアージ判定の記録"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.ForeignKey(
        DetectedSite, on_delete=models.CASCADE, related_name="screenings"
    )
    screened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="screenings",
    )
    risk_score_override = models.FloatField("リスクスコア上書き", null=True, blank=True)
    recommended_action = models.CharField("推奨アクション", max_length=200, blank=True)
    judgment = models.CharField("判定", max_length=100)
    reason = models.TextField("判定理由", blank=True)
    screened_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "トリアージ"
        verbose_name_plural = "トリアージ"
        ordering = ["-screened_at"]

    def __str__(self):
        return f"トリアージ {self.site} - {self.judgment}"


class PermitMatch(models.Model):
    """許認可等との照合結果"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.ForeignKey(
        DetectedSite, on_delete=models.CASCADE, related_name="permit_matches"
    )
    permit_number = models.CharField("許可番号", max_length=100, blank=True)
    match_result = models.CharField(
        "照合結果",
        max_length=20,
        choices=DetectedSite.PermitMatchStatus.choices,
    )
    memo = models.TextField("照合メモ", blank=True)
    matched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "許認可照合"
        verbose_name_plural = "許認可照合"

    def __str__(self):
        return f"照合 {self.site} - {self.get_match_result_display()}"


# ──────────────────────────────────────────────
# 現地確認
# ──────────────────────────────────────────────


class FieldInspection(models.Model):
    """現地確認記録"""

    class Result(models.TextChoices):
        MONITORING = "monitoring", "監視継続"
        FALSE_POSITIVE = "false_positive", "誤検知"
        CASE_REQUIRED = "case_required", "案件化要"
        RE_CHECK = "re_check", "要再確認"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.ForeignKey(
        DetectedSite, on_delete=models.CASCADE, related_name="inspections"
    )
    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="inspections",
    )
    inspected_at = models.DateTimeField("実施日時")
    result = models.CharField("確認結果", max_length=30, choices=Result.choices)
    finding = models.TextField("所見メモ", blank=True)
    latitude = models.FloatField("確認地点 緯度", null=True, blank=True)
    longitude = models.FloatField("確認地点 経度", null=True, blank=True)
    next_check_date = models.DateField("次回確認推奨日", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "現地確認"
        verbose_name_plural = "現地確認"
        ordering = ["-inspected_at"]

    def __str__(self):
        return f"現地確認 {self.site} ({self.inspected_at:%Y-%m-%d})"


# ──────────────────────────────────────────────
# 案件
# ──────────────────────────────────────────────


class Case(models.Model):
    """案件（継続管理）"""

    class Status(models.TextChoices):
        OPEN = "open", "オープン"
        UNDER_REVIEW = "under_review", "レビュー中"
        WAITING_FIELD_CHECK = "waiting_field_check", "現地確認待ち"
        MONITORING = "monitoring", "監視中"
        ACTION_IN_PROGRESS = "action_in_progress", "対応中"
        CLOSED = "closed", "クローズ"

    VALID_TRANSITIONS = {
        "open": ["under_review"],
        "under_review": ["waiting_field_check"],
        "waiting_field_check": ["monitoring", "action_in_progress"],
        "monitoring": ["action_in_progress", "closed"],
        "action_in_progress": ["monitoring", "closed"],
        "closed": ["open"],  # 再オープン
    }

    class Priority(models.TextChoices):
        LOW = "low", "低"
        MEDIUM = "medium", "中"
        HIGH = "high", "高"
        CRITICAL = "critical", "緊急"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case_number = models.CharField(
        "案件番号", max_length=30, unique=True, blank=True
    )
    title = models.CharField("件名", max_length=200)
    status = models.CharField(
        "ステータス", max_length=30, choices=Status.choices, default=Status.OPEN
    )
    priority = models.CharField(
        "優先度", max_length=20, choices=Priority.choices, default=Priority.MEDIUM
    )

    # 関連疑義地点
    sites = models.ManyToManyField(
        DetectedSite, related_name="cases", blank=True
    )

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_cases",
        verbose_name="担当者",
    )
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.CASCADE,
        related_name="cases",
        null=True,
        blank=True,
    )
    due_date = models.DateField("期限", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "案件"
        verbose_name_plural = "案件"
        ordering = ["-created_at"]

    def __str__(self):
        return self.case_number or self.title

    def save(self, *args, **kwargs):
        if not self.case_number:
            self.case_number = f"CASE-{str(self.id)[:8].upper()}"
        super().save(*args, **kwargs)

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])

    @property
    def stale_days(self):
        """滞留日数"""
        from django.utils import timezone

        return (timezone.now() - self.updated_at).days


class CaseComment(models.Model):
    """案件コメント"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(
        Case, on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="case_comments",
    )
    body = models.TextField("コメント")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "案件コメント"
        verbose_name_plural = "案件コメント"
        ordering = ["created_at"]

    def __str__(self):
        return f"コメント {self.case} by {self.author}"


# ──────────────────────────────────────────────
# 添付ファイル
# ──────────────────────────────────────────────


class Attachment(models.Model):
    """添付ファイル（疑義地点・現地確認・案件に紐付く）"""

    class TargetType(models.TextChoices):
        DETECTED_SITE = "detected_site", "疑義地点"
        INSPECTION = "inspection", "現地確認"
        CASE = "case", "案件"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    target_type = models.CharField(
        "対象種別", max_length=20, choices=TargetType.choices
    )
    target_id = models.UUIDField("対象ID")

    file = models.FileField("ファイル", upload_to="attachments/%Y/%m/")
    original_filename = models.CharField("元ファイル名", max_length=255)
    content_type = models.CharField("Content-Type", max_length=100, blank=True)
    file_size = models.PositiveIntegerField("ファイルサイズ(bytes)", default=0)

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="attachments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField("削除日時", null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deleted_attachments",
    )

    class Meta:
        verbose_name = "添付ファイル"
        verbose_name_plural = "添付ファイル"
        ordering = ["-created_at"]

    def __str__(self):
        return self.original_filename

    @property
    def is_deleted(self):
        return self.deleted_at is not None


# ──────────────────────────────────────────────
# 監査ログ
# ──────────────────────────────────────────────


class AuditLog(models.Model):
    """操作・変更履歴"""

    class EventType(models.TextChoices):
        STATUS_CHANGE = "status_change", "ステータス変更"
        ASSIGNEE_CHANGE = "assignee_change", "担当変更"
        PRIORITY_CHANGE = "priority_change", "優先度変更"
        SCREENING_SAVED = "screening_saved", "トリアージ保存"
        INSPECTION_CREATED = "inspection_created", "現地確認登録"
        INSPECTION_UPDATED = "inspection_updated", "現地確認更新"
        ATTACHMENT_ADDED = "attachment_added", "添付追加"
        ATTACHMENT_DELETED = "attachment_deleted", "添付削除"
        COMMENT_ADDED = "comment_added", "コメント追加"
        CASE_CREATED = "case_created", "案件作成"
        SETTING_CHANGED = "setting_changed", "設定変更"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(
        "イベント種別", max_length=30, choices=EventType.choices
    )

    # 対象
    target_type = models.CharField("対象種別", max_length=30)
    target_id = models.UUIDField("対象ID")

    # 変更内容
    before_value = models.JSONField("変更前", null=True, blank=True)
    after_value = models.JSONField("変更後", null=True, blank=True)
    description = models.TextField("説明", blank=True)

    # 実行者
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
    )
    acted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField("IPアドレス", null=True, blank=True)

    class Meta:
        verbose_name = "監査ログ"
        verbose_name_plural = "監査ログ"
        ordering = ["-acted_at"]
        indexes = [
            models.Index(fields=["target_type", "target_id"]),
            models.Index(fields=["event_type"]),
            models.Index(fields=["acted_at"]),
        ]

    def __str__(self):
        return f"[{self.get_event_type_display()}] {self.target_type}:{str(self.target_id)[:8]}"


# ──────────────────────────────────────────────
# ジョブ管理
# ──────────────────────────────────────────────


class JobRun(models.Model):
    """ジョブ実行履歴"""

    class JobType(models.TextChoices):
        IMPORT_OBSERVATIONS = "import_observations", "観測取り込み"
        SCORE_SITES = "score_sites", "スコア計算"
        MATCH_PERMITS = "match_permits", "許認可照合"
        GENERATE_REPORT = "generate_report", "レポート生成"
        REBUILD_CACHE = "rebuild_cache", "キャッシュ再構築"

    class Status(models.TextChoices):
        QUEUED = "queued", "待機中"
        RUNNING = "running", "実行中"
        SUCCEEDED = "succeeded", "成功"
        FAILED = "failed", "失敗"
        RETRYING = "retrying", "再試行中"
        CANCELLED = "cancelled", "キャンセル"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_type = models.CharField(
        "ジョブ種別", max_length=30, choices=JobType.choices
    )
    status = models.CharField(
        "状態", max_length=20, choices=Status.choices, default=Status.QUEUED
    )
    started_at = models.DateTimeField("開始日時", null=True, blank=True)
    finished_at = models.DateTimeField("終了日時", null=True, blank=True)
    error_message = models.TextField("エラーメッセージ", blank=True)
    metadata = models.JSONField("メタデータ", default=dict, blank=True)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="job_runs",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ジョブ実行履歴"
        verbose_name_plural = "ジョブ実行履歴"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_job_type_display()} - {self.get_status_display()}"
