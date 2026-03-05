"""
盛土監視Ops – デモ用シードデータ
python manage.py seed_morido で実行
"""

import random
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from morido.models import (
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


class Command(BaseCommand):
    help = "盛土監視Ops のデモ用シードデータを投入します"

    def handle(self, *args, **options):
        self.stdout.write("シードデータ投入中...")

        # ── 自治体・部署 ──
        muni, _ = Municipality.objects.get_or_create(
            code="131001", defaults={"name": "東京都"}
        )
        dept_monitor, _ = Department.objects.get_or_create(
            municipality=muni, name="都市整備局 監視課"
        )
        dept_inspect, _ = Department.objects.get_or_create(
            municipality=muni, name="都市整備局 現地調査課"
        )

        # ── ユーザー ──
        users_spec = [
            ("operator1", "佐藤", "太郎", UserProfile.Role.OPERATOR, dept_monitor),
            ("inspector1", "鈴木", "花子", UserProfile.Role.INSPECTOR, dept_inspect),
            ("manager1", "田中", "一郎", UserProfile.Role.MANAGER, dept_monitor),
            ("admin1", "高橋", "次郎", UserProfile.Role.ADMIN, dept_monitor),
            ("viewer1", "渡辺", "美咲", UserProfile.Role.VIEWER, dept_monitor),
        ]
        created_users = {}
        for uname, last, first, role, dept in users_spec:
            user, _ = User.objects.get_or_create(
                username=uname,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "email": f"{uname}@example.com",
                },
            )
            if not hasattr(user, "profile"):
                UserProfile.objects.create(user=user, role=role, department=dept)
            user.set_password("demo1234")
            user.save()
            created_users[uname] = user

        operator = created_users["operator1"]
        inspector = created_users["inspector1"]
        manager = created_users["manager1"]

        # ── 疑義地点 ──
        regions = ["千代田区", "港区", "新宿区", "渋谷区", "世田谷区", "杉並区", "練馬区", "板橋区"]
        statuses = [
            DetectedSite.Status.NEW,
            DetectedSite.Status.NEW,
            DetectedSite.Status.TRIAGED,
            DetectedSite.Status.FIELD_CHECK_REQUIRED,
            DetectedSite.Status.MONITORING,
            DetectedSite.Status.FALSE_POSITIVE,
            DetectedSite.Status.LINKED_TO_CASE,
            DetectedSite.Status.CLOSED,
        ]
        permit_statuses = list(DetectedSite.PermitMatchStatus.values)

        sites = []
        for i in range(30):
            lat = 35.65 + random.uniform(-0.08, 0.08)
            lng = 139.70 + random.uniform(-0.10, 0.10)
            region = random.choice(regions)
            site_status = random.choice(statuses)
            risk = round(random.uniform(0.1, 1.0), 2)

            site = DetectedSite.objects.create(
                site_id_display=f"DS-{2024000 + i}",
                status=site_status,
                latitude=lat,
                longitude=lng,
                address=f"東京都{region}丁目{random.randint(1, 20)}-{random.randint(1, 30)}",
                region=region,
                risk_score=risk,
                is_continuous=random.choice([True, False]),
                recommended_action=random.choice([
                    "現地確認推奨", "監視継続", "トリアージ必要", "緊急対応推奨", ""
                ]),
                permit_match_status=random.choice(permit_statuses),
                municipality=muni,
                assigned_to=random.choice([operator, inspector, manager, None]),
                detected_at=timezone.now() - timedelta(days=random.randint(0, 90)),
            )
            sites.append(site)

            # 観測データ
            for j in range(random.randint(1, 4)):
                Observation.objects.create(
                    site=site,
                    observed_at=site.detected_at - timedelta(days=j * 30),
                    source=random.choice(["Sentinel-2", "ALOS-2", "SPOT-7", "WorldView"]),
                    metadata={"resolution": f"{random.choice([10, 5, 1.5, 0.5])}m"},
                )

        # ── トリアージ ──
        triaged_sites = [s for s in sites if s.status != DetectedSite.Status.NEW]
        for site in triaged_sites[:10]:
            SiteScreening.objects.create(
                site=site,
                screened_by=operator,
                judgment=random.choice(["現地確認要", "監視継続", "誤検知の可能性"]),
                reason="リスクスコアおよび継続性から判断",
                recommended_action="現地確認推奨",
            )

        # ── 許認可照合 ──
        for site in random.sample(sites, 10):
            PermitMatch.objects.create(
                site=site,
                permit_number=f"許可-{random.randint(2023001, 2024050)}",
                match_result=random.choice(permit_statuses),
                memo="CSV一括照合結果",
            )

        # ── 現地確認 ──
        inspected_sites = [
            s for s in sites
            if s.status in [
                DetectedSite.Status.FIELD_CHECK_REQUIRED,
                DetectedSite.Status.MONITORING,
                DetectedSite.Status.LINKED_TO_CASE,
            ]
        ]
        for site in inspected_sites[:8]:
            FieldInspection.objects.create(
                site=site,
                inspector=inspector,
                inspected_at=timezone.now() - timedelta(days=random.randint(1, 30)),
                result=random.choice(list(FieldInspection.Result.values)),
                finding="現地にて盛土の状況を確認。周辺住民への聞き取りも実施済み。",
                latitude=site.latitude + random.uniform(-0.001, 0.001),
                longitude=site.longitude + random.uniform(-0.001, 0.001),
            )

        # ── 案件 ──
        case_statuses = list(Case.Status.values)
        priorities = list(Case.Priority.values)
        cases = []
        for i in range(8):
            c = Case.objects.create(
                case_number=f"CASE-{2024100 + i}",
                title=f"{random.choice(regions)}地区 盛土監視案件 #{i+1}",
                status=random.choice(case_statuses),
                priority=random.choice(priorities),
                assigned_to=random.choice([operator, manager]),
                municipality=muni,
                due_date=timezone.now().date() + timedelta(days=random.randint(-10, 60)),
            )
            # 疑義地点を紐付け
            c.sites.add(*random.sample(sites, min(random.randint(1, 4), len(sites))))
            cases.append(c)

            # コメント
            for _ in range(random.randint(1, 3)):
                CaseComment.objects.create(
                    case=c,
                    author=random.choice([operator, manager, inspector]),
                    body=random.choice([
                        "現地確認の結果を踏まえ、引き続き監視対応とします。",
                        "許認可照合の結果、不一致が確認されました。追加調査が必要です。",
                        "優先度を上げました。周辺への影響が懸念されます。",
                        "次回現地確認の日程を調整中です。",
                    ]),
                )

        # ── ジョブ実行履歴 ──
        for jtype in JobRun.JobType.values:
            for _ in range(2):
                started = timezone.now() - timedelta(hours=random.randint(1, 720))
                jstatus = random.choice(["succeeded", "succeeded", "succeeded", "failed"])
                JobRun.objects.create(
                    job_type=jtype,
                    status=jstatus,
                    started_at=started,
                    finished_at=started + timedelta(minutes=random.randint(1, 30)),
                    error_message="タイムアウト" if jstatus == "failed" else "",
                    triggered_by=created_users["admin1"],
                )

        self.stdout.write(self.style.SUCCESS(
            f"完了: 疑義地点 {len(sites)}件, 案件 {len(cases)}件, ユーザー {len(created_users)}名"
        ))
