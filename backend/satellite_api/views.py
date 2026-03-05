import requests
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status


NASA_DEMO_KEY = "DEMO_KEY"


@api_view(["GET"])
def iss_position(request):
    """Return the current ISS position from Open-Notify API."""
    try:
        resp = requests.get("http://api.open-notify.org/iss-now.json", timeout=5)
        resp.raise_for_status()
        return Response(resp.json())
    except requests.RequestException as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["GET"])
def iss_crew(request):
    """Return the current ISS crew from Open-Notify API."""
    try:
        resp = requests.get("http://api.open-notify.org/astros.json", timeout=5)
        resp.raise_for_status()
        return Response(resp.json())
    except requests.RequestException as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["GET"])
def apod(request):
    """Return NASA Astronomy Picture of the Day."""
    date = request.query_params.get("date", "")
    params = {"api_key": NASA_DEMO_KEY}
    if date:
        params["date"] = date
    try:
        resp = requests.get(
            "https://api.nasa.gov/planetary/apod", params=params, timeout=10
        )
        resp.raise_for_status()
        return Response(resp.json())
    except requests.RequestException as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["GET"])
def earth_events(request):
    """Return natural events from NASA EONET."""
    limit = request.query_params.get("limit", "20")
    days = request.query_params.get("days", "30")
    status_param = request.query_params.get("status", "open")
    try:
        resp = requests.get(
            "https://eonet.gsfc.nasa.gov/api/v3/events",
            params={"limit": limit, "days": days, "status": status_param},
            timeout=10,
        )
        resp.raise_for_status()
        return Response(resp.json())
    except requests.RequestException as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["GET"])
def earth_event_categories(request):
    """Return event categories from NASA EONET."""
    try:
        resp = requests.get(
            "https://eonet.gsfc.nasa.gov/api/v3/categories", timeout=10
        )
        resp.raise_for_status()
        return Response(resp.json())
    except requests.RequestException as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
