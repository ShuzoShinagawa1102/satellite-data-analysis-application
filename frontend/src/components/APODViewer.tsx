import React, { useEffect, useState } from "react";
import { fetchAPOD } from "../api";
import { APODData } from "../types";

const APODViewer: React.FC = () => {
  const [apod, setApod] = useState<APODData | null>(null);
  const [inputDate, setInputDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAPOD = async (d?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAPOD(d);
      setApod(data);
    } catch {
      setError("APODの取得に失敗しました。しばらくしてから再試行してください。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAPOD();
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputDate(e.target.value);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadAPOD(inputDate);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="apod-container">
      <h2>🌌 NASA 今日の天文写真 (APOD)</h2>
      <form className="date-picker" onSubmit={handleSearch}>
        <input
          type="date"
          value={inputDate}
          max={today}
          min="1995-06-16"
          onChange={handleDateChange}
          placeholder="日付を選択"
        />
        <button type="submit">表示</button>
        <button
          type="button"
          onClick={() => {
            setInputDate("");
            loadAPOD();
          }}
        >
          今日
        </button>
      </form>

      {loading && <div className="loading">画像を取得中...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && apod && (
        <div className="apod-card">
          <h3>{apod.title}</h3>
          <p className="apod-date">{apod.date}</p>
          {apod.copyright && (
            <p className="apod-copyright">© {apod.copyright}</p>
          )}
          {apod.media_type === "image" ? (
            <a href={apod.hdurl || apod.url} target="_blank" rel="noreferrer">
              <img
                src={apod.url}
                alt={apod.title}
                className="apod-image"
              />
            </a>
          ) : apod.media_type === "video" ? (
            <div className="apod-video-wrapper">
              <iframe
                src={apod.url}
                title={apod.title}
                allowFullScreen
                className="apod-video"
              />
            </div>
          ) : null}
          <p className="apod-explanation">{apod.explanation}</p>
        </div>
      )}
    </div>
  );
};

export default APODViewer;
