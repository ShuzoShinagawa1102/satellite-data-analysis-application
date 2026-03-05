import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import { fetchEarthEvents } from "../api";
import { EarthEvent, EarthEventsResponse } from "../types";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const CATEGORY_COLORS: Record<string, string> = {
  wildfires: "#ff4500",
  severeStorms: "#9400d3",
  volcanoes: "#ff6600",
  floods: "#0080ff",
  earthquakes: "#8b4513",
  landslides: "#996633",
  drought: "#daa520",
  dustHaze: "#c0c0c0",
  seaLakeIce: "#00ced1",
  snow: "#87ceeb",
  temperatureExtremes: "#ff1493",
  manmade: "#808080",
};

const getCategoryColor = (categoryId: string): string =>
  CATEGORY_COLORS[categoryId] || "#ff6b6b";

const getCategoryEmoji = (categoryId: string): string => {
  const emojis: Record<string, string> = {
    wildfires: "🔥",
    severeStorms: "⛈️",
    volcanoes: "🌋",
    floods: "🌊",
    earthquakes: "🫨",
    landslides: "⛰️",
    drought: "☀️",
    dustHaze: "🌫️",
    seaLakeIce: "🧊",
    snow: "❄️",
    temperatureExtremes: "🌡️",
    manmade: "🏭",
  };
  return emojis[categoryId] || "⚠️";
};

const EarthEvents: React.FC = () => {
  const [data, setData] = useState<EarthEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<EarthEvent | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchEarthEvents(days, 100)
      .then(setData)
      .catch(() => setError("地球イベントの取得に失敗しました。"))
      .finally(() => setLoading(false));
  }, [days]);

  const categories = data
    ? Array.from(
        new Map(
          data.events.flatMap((e) =>
            e.categories.map((c) => [c.id, c])
          )
        ).values()
      )
    : [];

  const filtered =
    selectedCategory === "all"
      ? data?.events || []
      : data?.events.filter((e) =>
          e.categories.some((c) => c.id === selectedCategory)
        ) || [];

  return (
    <div className="events-container">
      <h2>🌍 地球自然イベントトラッカー (NASA EONET)</h2>

      <div className="events-controls">
        <label>
          期間:
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>過去7日間</option>
            <option value={30}>過去30日間</option>
            <option value={90}>過去90日間</option>
          </select>
        </label>
        <label>
          カテゴリ:
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">すべて</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {getCategoryEmoji(c.id)} {c.title}
              </option>
            ))}
          </select>
        </label>
        {!loading && data && (
          <span className="event-count">
            {filtered.length}件のイベント
          </span>
        )}
      </div>

      {loading && <div className="loading">イベントを取得中...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && data && (
        <div className="events-layout">
          <div className="events-map">
            <MapContainer
              center={[20, 0]}
              zoom={2}
              style={{ height: "500px", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filtered.map((event) => {
                const geo = event.geometry[event.geometry.length - 1];
                if (!geo || geo.type !== "Point") return null;
                const [lon, lat] = geo.coordinates as number[];
                const catId = event.categories[0]?.id || "";
                return (
                  <CircleMarker
                    key={event.id}
                    center={[lat, lon]}
                    radius={8}
                    pathOptions={{
                      color: getCategoryColor(catId),
                      fillColor: getCategoryColor(catId),
                      fillOpacity: 0.7,
                    }}
                    eventHandlers={{ click: () => setSelectedEvent(event) }}
                  >
                    <Popup>
                      <strong>
                        {getCategoryEmoji(catId)} {event.title}
                      </strong>
                      <br />
                      {event.categories.map((c) => c.title).join(", ")}
                      <br />
                      日時: {geo.date.split("T")[0]}
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>

          <div className="events-list">
            <h3>イベント一覧</h3>
            <ul>
              {filtered.slice(0, 30).map((event) => {
                const catId = event.categories[0]?.id || "";
                return (
                  <li
                    key={event.id}
                    className={`event-item ${selectedEvent?.id === event.id ? "selected" : ""}`}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <span className="event-emoji">{getCategoryEmoji(catId)}</span>
                    <div className="event-details">
                      <span className="event-title">{event.title}</span>
                      <span className="event-date">
                        {event.geometry[event.geometry.length - 1]?.date.split("T")[0]}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="event-modal" onClick={() => setSelectedEvent(null)}>
          <div className="event-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedEvent(null)}>✕</button>
            <h3>
              {getCategoryEmoji(selectedEvent.categories[0]?.id || "")}{" "}
              {selectedEvent.title}
            </h3>
            <p><strong>カテゴリ:</strong> {selectedEvent.categories.map((c) => c.title).join(", ")}</p>
            <p><strong>日時:</strong> {selectedEvent.geometry[selectedEvent.geometry.length - 1]?.date.split("T")[0]}</p>
            {selectedEvent.sources.length > 0 && (
              <p>
                <strong>ソース:</strong>{" "}
                <a
                  href={selectedEvent.sources[0].url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selectedEvent.sources[0].id}
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EarthEvents;
