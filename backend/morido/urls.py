"""
盛土監視Ops – URL routing
仕様書 04_architecture §7.2 APIエンドポイントに準拠
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"detected-sites", views.DetectedSiteViewSet, basename="detected-site")
router.register(r"inspections", views.FieldInspectionViewSet, basename="inspection")
router.register(r"cases", views.CaseViewSet, basename="case")
router.register(r"audit-logs", views.AuditLogViewSet, basename="audit-log")
router.register(r"jobs", views.JobRunViewSet, basename="job")

urlpatterns = [
    # ダッシュボード
    path("dashboard/summary/", views.dashboard_summary, name="dashboard-summary"),
    path("dashboard/timeseries/", views.dashboard_timeseries, name="dashboard-timeseries"),
    # 疑義地点 GeoJSON
    path("detected-sites/geojson/", views.detected_sites_geojson, name="detected-sites-geojson"),
    # 衛星データ (リアルタイム STAC API)
    path("satellite/search/", views.satellite_search, name="satellite-search"),
    path("satellite/scenes/<str:scene_id>/", views.satellite_scene_detail, name="satellite-scene-detail"),
    # レポート
    path("reports/monthly/", views.monthly_report, name="monthly-report"),
    # DRF Router
    path("", include(router.urls)),
]
