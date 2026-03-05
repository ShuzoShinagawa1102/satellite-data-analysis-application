import React, { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { fetchISSPosition, fetchISSCrew } from "../api";
import { ISSPosition, ISSCrew } from "../types";
import "leaflet/dist/leaflet.css";

// Fix default leaflet marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const issIcon = new L.DivIcon({
  html: `<div style="font-size:32px;line-height:1;">🛸</div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const MAX_TRAIL_POINTS = 60;

const ISSTracker: React.FC = () => {
  const [position, setPosition] = useState<ISSPosition | null>(null);
  const [crew, setCrew] = useState<ISSCrew | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [error, setError] = useState<string | null>(null);

  const updatePosition = useCallback(async () => {
    try {
      const data = await fetchISSPosition();
      const lat = parseFloat(data.iss_position.latitude);
      const lon = parseFloat(data.iss_position.longitude);
      setPosition(data);
      setTrail((prev) => {
        const next: [number, number][] = [...prev, [lat, lon]];
        return next.length > MAX_TRAIL_POINTS
          ? next.slice(next.length - MAX_TRAIL_POINTS)
          : next;
      });
    } catch {
      setError("ISSの位置情報の取得に失敗しました。");
    }
  }, []);

  useEffect(() => {
    updatePosition();
    fetchISSCrew()
      .then(setCrew)
      .catch(() => {});
    const interval = setInterval(updatePosition, 5000);
    return () => clearInterval(interval);
  }, [updatePosition]);

  if (error) {
    return <div className="error-box">{error}</div>;
  }

  if (!position) {
    return <div className="loading">ISS位置情報を取得中...</div>;
  }

  const lat = parseFloat(position.iss_position.latitude);
  const lon = parseFloat(position.iss_position.longitude);

  return (
    <div className="tracker-container">
      <div className="tracker-info">
        <h2>🛸 ISSリアルタイムトラッカー</h2>
        <div className="info-cards">
          <div className="info-card">
            <span className="label">緯度</span>
            <span className="value">{parseFloat(position.iss_position.latitude).toFixed(4)}°</span>
          </div>
          <div className="info-card">
            <span className="label">経度</span>
            <span className="value">{parseFloat(position.iss_position.longitude).toFixed(4)}°</span>
          </div>
          {crew && (
            <div className="info-card">
              <span className="label">乗員数</span>
              <span className="value">{crew.number}名</span>
            </div>
          )}
        </div>
        {crew && (
          <div className="crew-list">
            <h3>現在の乗員</h3>
            <ul>
              {crew.people
                .filter((p) => p.craft === "ISS")
                .map((p) => (
                  <li key={p.name}>👨‍🚀 {p.name}</li>
                ))}
            </ul>
          </div>
        )}
        <p className="update-note">5秒ごとに自動更新</p>
      </div>
      <div className="map-wrapper">
        <MapContainer
          center={[lat, lon]}
          zoom={3}
          style={{ height: "480px", width: "100%" }}
          key={`${lat}-${lon}`}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {trail.length > 1 && (
            <Polyline
              positions={trail}
              pathOptions={{ color: "#4fc3f7", weight: 2, dashArray: "6 4" }}
            />
          )}
          <Marker position={[lat, lon]} icon={issIcon}>
            <Popup>
              <strong>ISS現在位置</strong>
              <br />
              緯度: {lat.toFixed(4)}°
              <br />
              経度: {lon.toFixed(4)}°
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
};

export default ISSTracker;
