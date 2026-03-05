from django.urls import path
from . import views

urlpatterns = [
    path("iss/position/", views.iss_position, name="iss-position"),
    path("iss/crew/", views.iss_crew, name="iss-crew"),
    path("nasa/apod/", views.apod, name="apod"),
    path("earth/events/", views.earth_events, name="earth-events"),
    path("earth/categories/", views.earth_event_categories, name="earth-categories"),
]
