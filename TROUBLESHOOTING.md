# SnapGemini 開發與發布問題排除全紀錄 🛠️📖

本文件詳細記錄了從本機開發、推送到 GitHub、GitHub Actions 雲端自動編譯 Android APK、到實際安裝於手機使用過程中遇到的所有錯誤與對應解決方案。

---

## 📑 目錄
1. [問題一：GitHub Actions 首次雲端編譯失敗 (Run #1)](#問題一github-actions-首次雲端編譯失敗-run-1)
2. [問題二：Java 版本不相容與 Gradle 插件衝突 (Run #2 & #3)](#問題二java-版本不相容與-gradle-插件衝突-run-2--3)
3. [問題三：手機開啟 APK 顯示「網頁無法使用 net::ERR_CONNECTION_REFUSED」](#問題三手機開啟-apk-顯示網頁無法使用-neterr_connection_refused)
4. [問題四：Gemini 2.0 模型退役報錯 (Model No Longer Available)](#問題四gemini-20-模型退役報錯-model-no-longer-available)
5. [問題五：Google 伺服器尖峰忙碌 (High Demand 503) 與 API Key 即時測試](#問題五google-伺服器尖峰忙碌-high-demand-503-與-api-key-即時測試)

---

### 問題一：GitHub Actions 首次雲端編譯失敗 (Run #1)

* **錯誤現象**：推送到 GitHub 後，GitHub Actions 執行約 28 秒即拋出紅叉 ❌ 失敗。
* **原因分析**：
  1. 工作流程使用了過時且多餘的 `android-actions/setup-android@v3` Action，在 Ubuntu 環境下產生套件相容問題。
  2. 原先的 `android/.gitignore` 誤將外掛設定檔排除，導致 Gradle 在缺少相依環境下編譯中斷。
* **解決方法**：
  1. 移除多餘的 Action，直接調用 GitHub 官方 Ubuntu Runner 內建的高效 Android SDK 環境。
  2. 解除 `capacitor-cordova-android-plugins` 的忽略規則並加入版本控制。

---

### 問題二：Java 版本不相容與 Gradle 插件衝突 (Run #2 & #3)

* **錯誤現象**：GitHub Actions 執行至 `./gradlew assembleDebug` 時失敗中斷。
* **原因分析**：
  1. 專案採用了最新的 **Capacitor 8** 原生核心，底層 Android 模組要求使用 **Java JDK 21** (`JavaVersion.VERSION_21`)。原工作流程配置了舊版的 Java 17，導致 Java Class 版本不相容。
  2. `settings.gradle` 與 `app/build.gradle` 殘留了未使用的 Cordova 插件引用與 `flatDir` 宣告，導致 Gradle 解析失敗。
* **解決方法**：
  1. 在 `.github/workflows/build-apk.yml` 中將 Java 升級為 **JDK 21** (`actions/setup-java@v4` with `distribution: 'temurin'` and `java-version: '21'`)。
  2. 在 `android/app/build.gradle` 補上 Java 21 編譯選項（`compileOptions { sourceCompatibility JavaVersion.VERSION_21 ... }`）。
  3. 精簡 `settings.gradle` 與 `app/build.gradle`，清理未使用的插件依賴。

---

### 問題三：手機開啟 APK 顯示「網頁無法使用 net::ERR_CONNECTION_REFUSED」

* **錯誤現象**：下載安裝 APK 到 Android 手機後打開，畫面顯示白底黑字：
  `無法載入位於 https://localhost/ 的網頁，原因如下：net::ERR_CONNECTION_REFUSED`。
* **原因分析**：
  1. 原先的 `.gitignore` 將 `android/app/src/main/assets/public/`（前端所有 HTML/CSS/JS/圖示）排除了。
  2. 雲端在全新機器編譯時，產出了一個「**沒有任何網頁程式碼的空殼 APK**」。
  3. 手機 WebView 啟動時找不到本地 `public/index.html`，導致本地伺服器拒絕連線。
* **解決方法**：
  1. 從 `android/.gitignore` 中移除對 `assets/public` 的排除規則。
  2. 改寫 `build.js`，使其在打包前**無條件自動將所有前端網頁資源完整同步至 `android/app/src/main/assets/public/`**。
  3. 在 `AndroidManifest.xml` 加入 `android:usesCleartextTraffic="true"` 以確保網路與本地通訊順暢。

---

### 問題四：Gemini 2.0 模型退役報錯 (Model No Longer Available)

* **錯誤現象**：拍照分析時，介面彈出錯誤：
  `API_ERROR: This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.6-flash...`。
* **原因分析**：Google 官方已將舊版模型退役，推薦全面遷移至新世代 Gemini 3.0+ 系列模型。
* **解決方法**：
  1. 全面升級至 **Gemini 3.6 Flash**（最新旗艦極速推薦）、**Gemini 3.7 Flash**、**Gemini 3.0 Flash**、**Gemini 2.5 Flash**。
  2. 在 `js/gemini.js` 加入 **自動無縫遷移機制（Auto-Migration）**：程式啟動時會自動將手機先前保存的舊版模型快取升級為 `gemini-3.6-flash`，使用者無需手動重新配置。

---

### 問題五：Google 伺服器尖峰忙碌 (High Demand 503) 與 API Key 即時測試

* **錯誤現象**：
  1. 免費 API 在全球熱門時段偶發：`API_ERROR: This model is currently experiencing high demand. (HTTP 503)`。
  2. 使用者在輸入 API Key 時無法即時得知 Key 是否有效或輸入正確。
* **解決方法**：
  1. **新增「⚡ 測試 API Key 可用性」按鈕**：
     * 在設定彈窗中點擊即可發送即時探針測試連線。
     * 即時回報延遲毫秒數（如 `280ms`），並精準診斷是「格式錯誤」、「額度已滿」還是「伺服器忙碌」。
  2. **內建「伺服器尖峰智慧自動降級（Auto-Fallback）」**：
     * 呼叫 Gemini 時，若選定的最新模型遇到 Google 官方 503 尖峰塞車，系統會**自動秒切換至備用穩定模型（Gemini 2.5 Flash / 3.0 Flash）** 繼續完成分析，不再中斷報錯。

---

## 🚀 成果總結
經由上述修復與優化，SnapGemini 已成為具備 **高容錯率、智慧容災降級、全平台 PWA + 原生 Android APK 雙支援** 的成熟 AI 相機工具！
