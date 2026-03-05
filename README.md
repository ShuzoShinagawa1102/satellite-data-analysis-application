# 衛星データ分析アプリケーション

宇宙・地球観測データをリアルタイムで可視化するWebアプリケーションです。

## 機能

| 機能 | 説明 |
|------|------|
| 🛸 ISSリアルタイムトラッカー | 国際宇宙ステーションの現在位置を地図上に表示（5秒ごと更新）・軌跡表示・乗員情報 |
| 🌌 NASA 天文写真 (APOD) | NASAが毎日公開する宇宙の天文写真を日付指定で閲覧 |
| 🌍 地球自然イベント | NASA EONETから火災・嵐・火山噴火などの自然現象をリアルタイムに地図表示 |

## 使用API（すべて無料）

- [Open-Notify ISS API](http://open-notify.org/) - ISS位置情報・乗員情報
- [NASA APOD API](https://api.nasa.gov/) - 今日の天文写真（DEMO_KEY使用）
- [NASA EONET API](https://eonet.gsfc.nasa.gov/) - 地球自然イベントデータ

## 技術スタック

- **フロントエンド**: React + TypeScript, Leaflet.js（地図表示）
- **バックエンド**: Django + Django REST Framework

## 起動方法

### 方法1: 手動起動（推奨）

#### バックエンド (Django)

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
# → http://localhost:8000 で起動
```

#### フロントエンド (React)

```bash
cd frontend
npm install
npm start
# → http://localhost:3000 で起動
```

ブラウザで http://localhost:3000 を開くとアプリが使えます。

### 方法2: Docker Compose

```bash
docker-compose up --build
# → http://localhost:3000 で起動
```

## API エンドポイント

| エンドポイント | 説明 |
|--------------|------|
| `GET /api/iss/position/` | ISSの現在位置 |
| `GET /api/iss/crew/` | ISSの現在乗員 |
| `GET /api/nasa/apod/?date=YYYY-MM-DD` | NASAの天文写真 |
| `GET /api/earth/events/?days=30&limit=50` | 地球自然イベント |
| `GET /api/earth/categories/` | イベントカテゴリ一覧 |

## ドキュメント

- [衛星データを活用した既存サービス・アプリケーション調査](docs/satellite_services_survey.md)
