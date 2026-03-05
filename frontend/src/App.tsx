import React, { useState } from "react";
import ISSTracker from "./components/ISSTracker";
import APODViewer from "./components/APODViewer";
import EarthEvents from "./components/EarthEvents";
import "./App.css";

type Tab = "iss" | "apod" | "events";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("iss");

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>🛰️ 衛星データ分析アプリケーション</h1>
          <p className="header-subtitle">リアルタイム宇宙・地球観測データ</p>
        </div>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === "iss" ? "active" : ""}`}
          onClick={() => setActiveTab("iss")}
        >
          🛸 ISSトラッカー
        </button>
        <button
          className={`tab-btn ${activeTab === "apod" ? "active" : ""}`}
          onClick={() => setActiveTab("apod")}
        >
          🌌 宇宙写真
        </button>
        <button
          className={`tab-btn ${activeTab === "events" ? "active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          🌍 地球イベント
        </button>
      </nav>

      <main className="main-content">
        {activeTab === "iss" && <ISSTracker />}
        {activeTab === "apod" && <APODViewer />}
        {activeTab === "events" && <EarthEvents />}
      </main>

      <footer className="app-footer">
        <p>
          データソース:{" "}
          <a href="http://open-notify.org" target="_blank" rel="noreferrer">Open-Notify</a>
          {" | "}
          <a href="https://api.nasa.gov" target="_blank" rel="noreferrer">NASA APIs</a>
          {" | "}
          <a href="https://eonet.gsfc.nasa.gov" target="_blank" rel="noreferrer">NASA EONET</a>
        </p>
      </footer>
    </div>
  );
}

export default App;

