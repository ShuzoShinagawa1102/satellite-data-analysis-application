# 衛星データの種類・用途・API利用に関する調査

## 概要

本ドキュメントは，衛星データを活用したアプリケーション開発に向けた事前調査をまとめたものです．
主要な衛星データプロバイダーについて，データの種類，用途，API利用可否，料金体系，提供国・言語などを整理します．

---

## 1. 主要な衛星データプロバイダー一覧

| プロバイダー名 | 運営組織 | 国 | 主要衛星 | APIあり | 無料枠 |
|---|---|---|---|---|---|
| NASA Earthdata | NASA | 🇺🇸 米国 | Landsat, MODIS, SRTM | ✅ | ✅ |
| ESA Copernicus / Sentinel Hub | ESA | 🇪🇺 EU | Sentinel-1〜6 | ✅ | ✅（制限あり） |
| JAXA EORC | JAXA | 🇯🇵 日本 | ALOS-2, GCOM, GSMaP | ✅（一部） | ✅（一部） |
| Google Earth Engine | Google | 🇺🇸 米国 | 多数（Landsat, Sentinel等） | ✅ | ✅（研究・教育向け） |
| Planet Labs | Planet | 🇺🇸 米国 | PlanetScope, SkySat | ✅ | ❌（有料） |
| Maxar Technologies | Maxar | 🇺🇸 米国 | WorldView, GeoEye | ✅ | ❌（有料） |
| Airbus Defence & Space | Airbus | 🇫🇷 フランス | SPOT, Pléiades | ✅ | ❌（有料） |
| USGS Earth Explorer | USGS | 🇺🇸 米国 | Landsat | ✅ | ✅ |

---

## 2. 各プロバイダー詳細

---

### 2.1 NASA Earthdata

**運営組織:** NASA（アメリカ航空宇宙局）  
**国:** 🇺🇸 米国  
**言語:** 英語  
**公式サイト:** https://earthdata.nasa.gov/

#### 主要な衛星・データ

| 衛星・データセット名 | センサー種別 | 解像度 | データ期間 |
|---|---|---|---|
| Landsat 8 / 9 | 光学（多スペクトル） | 30m | 1972年〜現在 |
| MODIS (Terra/Aqua) | 光学（中解像度） | 250m〜1km | 1999年〜現在 |
| SRTM | SAR（標高） | 30m（1アーク秒） | 2000年（1回のみ） |
| GPM（降水） | マイクロ波 | 0.1度 | 2014年〜現在 |
| VIIRS | 光学 | 375m / 750m | 2012年〜現在 |

#### API・アクセス方法

- **Earthdata Search API:** データの検索・ダウンロード
- **CMR API（Common Metadata Repository）:** メタデータ検索
- **NASA GIBS（Global Imagery Browse Services）:** WMS/WMTS形式のタイルマップ
- **AppEEARS:** 地点・領域指定による時系列データ抽出
- 登録（無料）が必要

#### 料金

- **無料**（Earthdataアカウント登録が必要）
- 商用利用も無料（ただし利用規約に従うこと）

#### 用途

- 農業（作物モニタリング，収量予測）
- 災害監視（洪水，火災，地震）
- 気候変動研究（海面温度，雪氷域変化）
- 土地利用・土地被覆分類
- 水資源管理

---

### 2.2 ESA Copernicus / Sentinel Hub

**運営組織:** ESA（欧州宇宙機関）/ Sinergise（Sentinel Hub）  
**国:** 🇪🇺 EU（欧州）  
**言語:** 英語  
**公式サイト:** https://www.sentinel-hub.com/ / https://dataspace.copernicus.eu/

#### 主要な衛星・データ

| 衛星名 | センサー種別 | 解像度 | 主な用途 |
|---|---|---|---|
| Sentinel-1 (A/B) | SAR（Cバンド） | 5〜20m | 洪水，地盤変動，海氷 |
| Sentinel-2 (A/B) | 光学（多スペクトル） | 10〜60m | 植生，農業，土地被覆 |
| Sentinel-3 | 光学・熱赤外 | 300m〜1km | 海洋，気候 |
| Sentinel-5P | 大気センサー | 7km | 大気汚染（NO₂, CO, O₃） |
| Sentinel-6 | レーダー高度計 | — | 海面高度 |

#### API・アクセス方法

- **Copernicus Data Space Ecosystem API（旧 Open Access Hub）:** REST APIでデータ検索・ダウンロード
- **Sentinel Hub Process API:** カスタムスクリプトによるオンデマンド画像処理
- **OGC Web Services（WMS/WMTS/WCS/WFS）:** 地図サービスとして利用可能
- **Python SDK（sentinelhub-py）:** Pythonライブラリ
- **JavaScript Evalscript:** 独自のバンド演算式（NDVI等）を記述可能

#### 料金（Sentinel Hub）

| プラン | 月額 | 処理ユニット（PU）/ 月 |
|---|---|---|
| Trial | 無料（30日間） | 30,000 PU |
| Exploration | 無料 | 1,000 PU/月 |
| Basic | 約€25/月 | 100,000 PU/月 |
| Enterprise | 要問合せ | カスタム |

- Copernicus Data Space Ecosystem は無料でアクセス可能（EU規則）

#### 用途

- 農業：植生指数（NDVI, EVI），作物判別
- 都市計画：土地利用変化検出
- 環境：大気汚染，海洋汚染監視
- 災害：洪水域抽出，地滑り検出
- インフラ管理：地盤沈下監視（InSAR）

---

### 2.3 JAXA（宇宙航空研究開発機構）

**運営組織:** JAXA（宇宙航空研究開発機構）  
**国:** 🇯🇵 日本  
**言語:** 日本語・英語  
**公式サイト:** https://www.eorc.jaxa.jp/ / https://www.jaxa.jp/

#### 主要な衛星・データ

| 衛星名 | センサー種別 | 解像度 | 主な用途 |
|---|---|---|---|
| ALOS-2（だいち2号） | SAR（Lバンド） | 1〜100m | 災害，地図，森林 |
| ALOS-3（だいち3号） | 光学 | 0.7m | 地形把握，インフラ |
| GCOM-C（しきさい） | 光学・熱赤外 | 250m〜1km | 気候，植生，海洋 |
| GCOM-W（しずく） | マイクロ波 | 3〜62km | 水循環，海氷，土壌水分 |
| GSMaP（降水） | 複合センサー | 0.1度 | 降水量推定 |
| AW3D（全球デジタル3D地図） | ALOS派生 | 5m | 標高モデル（DEM） |

#### API・アクセス方法

- **JAXA Earth API:** 衛星データのオープンAPI（一部データ）
- **G-Portal:** 観測データの検索・ダウンロードポータル（https://gportal.jaxa.jp）
- **J-OFURO3:** 海洋フラックスデータ提供
- **ALOS World 3D（AW3D）API:** 商用利用向けの標高データAPI（有料）
- 登録（無料）が必要なデータあり

#### 料金

- **無料:** GCOM-C, GSMaP, 一部のALOS-2データ（研究・非商用）
- **有料:** AW3D（商用）, ALOS-2一部データ（商用）

#### 用途

- 防災・災害対応（洪水，地震，火山，土砂崩れ）
- 森林管理（違法伐採監視，炭素量推定）
- 農業支援（水田マッピング，作物生育モニタリング）
- 海洋・気候研究
- インフラ監視（地盤沈下）

---

### 2.4 Google Earth Engine（GEE）

**運営組織:** Google  
**国:** 🇺🇸 米国  
**言語:** 英語（UIは一部日本語対応）  
**公式サイト:** https://earthengine.google.com/

#### 特徴

- クラウドベースのジオスペーシャル処理プラットフォーム
- 40年以上の衛星データ（Landsat, Sentinel, MODIS等）をクラウド上で処理
- JavaScriptおよびPython APIを提供

#### 主なデータカタログ

- Landsat Collection 2（USGS）
- Sentinel-1, 2, 5P（ESA）
- MODIS（NASA）
- SRTM（NASA/USGS）
- WorldClim（気候データ）
- OpenStreetMap ベースのデータ

#### API・アクセス方法

- **Earth Engine JavaScript API（Code Editor）:** ブラウザ上でコード実行
- **Earth Engine Python API（`earthengine-api`）:** Pythonから利用
- **Earth Engine REST API:** HTTP経由でのアクセス

#### 料金

| 利用区分 | 料金 |
|---|---|
| 研究・教育・非営利 | **無料** |
| 商用利用（Cloud Project経由） | Google Cloud料金に準ずる |

#### 用途

- 大規模な土地被覆変化検出
- 農業モニタリング・食料安全保障
- 気候変動分析
- 都市化・スプロール検出
- 水体マッピング

---

### 2.5 Planet Labs

**運営組織:** Planet Labs PBC  
**国:** 🇺🇸 米国  
**言語:** 英語  
**公式サイト:** https://www.planet.com/

#### 主要な衛星・データ

| 衛星名 | 解像度 | 再訪頻度 | 特徴 |
|---|---|---|---|
| PlanetScope | 3〜5m | 毎日 | 広域高頻度観測（180機以上） |
| SkySat | 50cm〜1m | 毎日（特定エリア） | 高解像度動画撮影も可能 |
| RapidEye | 5m | 5.5日 | （2020年運用終了、データは引き続き提供） |
| Tanager（CO₂センサー） | — | — | 温室効果ガス検出（新規） |

#### API・アクセス方法

- **Planet API（v1）:** データ検索・注文・ダウンロード（REST API）
- **Planet SDK for Python:** Pythonライブラリ（`planet`パッケージ）
- **Planet QGIS Plugin / ArcGIS Integration**

#### 料金

- **有料**（プランは非公開・要問合せ）
- **Education/Research プログラム:** 申請により無料アクセス可能（Education and Research Program）
- **ニコラス基金（NF）:** NGO・環境研究者向け無料プログラム

#### 用途

- 農業：精密農業，農場モニタリング
- 保険・金融：農作物リスク評価
- 建設・インフラ：進捗管理，変化検出
- 自然災害：被害状況の迅速把握
- 環境：違法伐採，海岸侵食

---

### 2.6 Maxar Technologies

**運営組織:** Maxar Technologies  
**国:** 🇺🇸 米国  
**言語:** 英語  
**公式サイト:** https://www.maxar.com/

#### 主要な衛星・データ

| 衛星名 | 解像度 | 特徴 |
|---|---|---|
| WorldView-3 | 30cm | 超高解像度，多スペクトル |
| WorldView-4 | 30cm | （2019年衛星故障，データは引き続き提供） |
| GeoEye-1 | 50cm | 高解像度，ステレオ撮影 |
| WorldView Legion | 30cm | 高頻度再訪（建設中，2024年〜） |

#### API・アクセス方法

- **Maxar ARD（Analysis-Ready Data）API**
- **GBDX（Geospatial Big Data Platform）API**（廃止されリニューアル）
- **Maxar Geospatial Platform（MGP）API:** 最新プラットフォーム

#### 料金

- **有料**（要問合せ）
- 政府・防衛向けプログラムあり（SecureWatch等）

#### 用途

- 軍事・防衛・インテリジェンス
- 都市インフラ管理
- 高精度地図作成（HD地図）
- 資源探査
- 保険・損害査定

---

### 2.7 Airbus Defence & Space（SPOT / Pléiades）

**運営組織:** Airbus Defence & Space  
**国:** 🇫🇷 フランス  
**言語:** 英語・フランス語  
**公式サイト:** https://www.intelligence-airbusds.com/

#### 主要な衛星・データ

| 衛星名 | 解像度 | 特徴 |
|---|---|---|
| SPOT 6 / 7 | 1.5m | 広域（60km幅） |
| Pléiades 1A / 1B | 50cm | 高解像度，毎日再訪 |
| Pléiades Neo 3 / 4 | 30cm | 最新高解像度シリーズ |

#### API・アクセス方法

- **OneAtlas API:** 衛星画像の検索・注文・ストリーミング
- **Living Library:** アーカイブデータの検索
- OGC標準（WMS/WMTS/WCS）対応

#### 料金

- **有料**（エリア・解像度・用途により異なる）
- 商用・研究・政府向けプランあり

#### 用途

- 精密地図作成
- 都市・インフラ計画
- 農業・保険
- 環境監視
- 防衛・安全保障

---

## 3. データ種別（センサー種別）まとめ

| センサー種別 | 概要 | 主な用途 | 代表的なデータ |
|---|---|---|---|
| **光学（可視〜近赤外）** | 太陽光反射を撮像 | 植生，土地被覆，農業，都市 | Landsat, Sentinel-2, SPOT |
| **SAR（合成開口レーダー）** | 電波を送受信して地表を撮像（夜間・雲天OK） | 洪水，地盤変動，森林 | Sentinel-1, ALOS-2, Radarsat |
| **熱赤外** | 地表の熱放射を撮像 | 都市ヒートアイランド，火山，火災 | Landsat TIR, ASTER |
| **高解像度光学** | 30cm〜1m級の超高解像度 | 地図作成，建物検出，防衛 | WorldView-3, Pléiades Neo |
| **大気センサー** | 大気成分を計測 | 大気汚染，温室効果ガス | Sentinel-5P, GOSAT |
| **マイクロ波放射計** | 受動型マイクロ波観測 | 降水，海氷，土壌水分 | GCOM-W, GPM |
| **標高データ（DEM）** | 地形の高さを計測 | 3D地図，浸水シミュレーション | SRTM, AW3D |

---

## 4. 利用シーン別おすすめデータ

| 用途 | おすすめデータ | 理由 |
|---|---|---|
| 農業モニタリング | Sentinel-2, Landsat | NDVI等の植生指数，無料，高頻度 |
| 災害対応（洪水） | Sentinel-1（SAR） | 雲があっても取得可能 |
| 都市変化検出 | Planet PlanetScope | 毎日撮影，高解像度 |
| 大気汚染モニタリング | Sentinel-5P | NO₂, CO等の濃度データ |
| 精密地図作成 | Pléiades Neo, WorldView | 30〜50cm解像度 |
| 地盤沈下解析 | ALOS-2, Sentinel-1 | InSAR対応，Lバンドは植生下も透過 |
| 気候・海洋研究 | MODIS, GCOM-C | 長期アーカイブ，広域カバレッジ |
| 標高モデル（DEM）作成 | SRTM, AW3D | 全球無料（SRTM），高精度（AW3D） |

---

## 5. API利用まとめ

| プロバイダー | API形式 | 主な言語SDK | 認証 | 無料枠 |
|---|---|---|---|---|
| NASA Earthdata | REST（CMR, GIBS） | Python, R | Earthdataアカウント | ✅ 無料 |
| Sentinel Hub | REST（OGC/Process API） | Python（sentinelhub-py） | OAuth2 | ✅ 1,000PU/月 |
| Copernicus Dataspace | OData, OpenSearch | Python | OAuthアカウント | ✅ 無料 |
| Google Earth Engine | REST / JavaScript / Python | Python（earthengine-api） | Google OAuth | ✅ 非商用無料 |
| JAXA G-Portal | REST / FTP | Python（一部） | 登録アカウント | ✅ 研究用無料 |
| Planet | REST | Python（planet SDK） | APIキー | ❌（要申請） |
| Maxar | REST（MGP API） | Python | APIキー | ❌ |
| Airbus（OneAtlas） | REST（OGC） | Python, JS | APIキー / OAuth | ❌ |

---

## 6. 料金比較まとめ

| プロバイダー | 無料枠 | 有料プラン概算 | 備考 |
|---|---|---|---|
| NASA Earthdata | 完全無料 | — | 登録不要のデータも多数 |
| ESA Copernicus | 完全無料 | — | EU規制により公開義務 |
| Sentinel Hub | 1,000 PU/月 | €25〜/月 | 処理ユニット制 |
| Google Earth Engine | 非商用無料 | Google Cloud料金 | 商用はCloud Project |
| JAXA | 研究用無料 | 商用は有料（要問合せ） | AW3Dは別途商用ライセンス |
| Planet | 教育・研究申請制 | 要問合せ | EducationProgramあり |
| Maxar | なし | 要問合せ | 政府・防衛向けが主 |
| Airbus（OneAtlas） | なし | 要問合せ | アーカイブ購入型 |

---

## 7. 国・言語別まとめ

| プロバイダー | 国・地域 | 主要言語 | 日本語対応 |
|---|---|---|---|
| NASA / USGS | 🇺🇸 米国 | 英語 | ドキュメント一部あり |
| ESA / Copernicus | 🇪🇺 EU（欧州） | 英語・各EU言語 | なし |
| JAXA | 🇯🇵 日本 | 日本語・英語 | ✅ 日本語対応 |
| Google Earth Engine | 🇺🇸 米国 | 英語 | UI一部対応 |
| Planet Labs | 🇺🇸 米国 | 英語 | なし |
| Maxar | 🇺🇸 米国 | 英語 | なし |
| Airbus（OneAtlas） | 🇫🇷 フランス | 英語・フランス語 | なし |

---

## 8. まとめと考察

### 開発用途に適したデータソース（推奨）

1. **無料・API充実・初期開発向け:**
   - **Sentinel-2（ESA）** + **sentinelhub-py** または **Copernicus Dataspace API**
   - **NASA Earthdata（Landsat/MODIS）** + **AppEEARS** or **CMR API**
   - **Google Earth Engine** → 大規模処理・複数データ統合に最適

2. **日本特有のデータ（洪水・地震対応）:**
   - **JAXA ALOS-2** → SAR画像，国内災害対応に最適
   - **JAXA G-Portal** → 多様なセンサーデータを日本語で利用可能

3. **高頻度・高解像度（商用レベル）:**
   - **Planet PlanetScope** → 毎日3〜5m解像度
   - **Pléiades Neo / WorldView-3** → 30cm超高解像度

### 今後の検討事項

- [ ] アプリケーションで使用するデータソースの絞り込み
- [ ] APIキー・アカウント登録の実施
- [ ] 対象とする分析ユースケースの定義
- [ ] ライセンス・利用規約の確認（特に商用利用）
- [ ] データ処理パイプラインのアーキテクチャ設計

---

## 参考リンク

- [NASA Earthdata](https://earthdata.nasa.gov/)
- [ESA Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/)
- [Sentinel Hub Documentation](https://docs.sentinel-hub.com/)
- [Google Earth Engine](https://earthengine.google.com/)
- [JAXA G-Portal](https://gportal.jaxa.jp/)
- [Planet Developers](https://developers.planet.com/)
- [Maxar Geospatial Platform](https://developers.maxar.com/)
- [Airbus OneAtlas](https://api.oneatlas.airbus.com/)
- [sentinelhub-py (Python SDK)](https://sentinelhub-py.readthedocs.io/)
- [earthengine-api (Python SDK)](https://developers.google.com/earth-engine/guides/python_install)
