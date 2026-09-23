# SnapGemini 獨立 Android App (APK) 產生與安裝指南 📱📦

我們已經為您建立好完整的 **Capacitor 原生 Android 工程**，並配置好了相機、麥克風、閃光燈、網路等完整硬體權限。

以下提供您 **3 種最輕鬆獲取 APK 安裝檔的方式**：

---

## 🚀 方式一：GitHub 雲端 0 設定自動編譯（最推薦 ⭐）

專案已內建 `.github/workflows/build-apk.yml` 雲端自動編譯工作流，您完全不需要在電腦上安裝幾十 GB 的 Android SDK 與 Java。

### 操作步驟：
1. 將本專案資料夾上傳/推送到您的 **GitHub Repository**。
2. 進入 GitHub 專案頁面，點選上方的 **「Actions」** 分頁。
3. 點擊 **「Build Android APK (SnapGemini)」** ➔ 點擊 **「Run workflow」**（或只要有 push 就會自動觸發）。
4. 大約 2 分鐘編譯完成後，點進該次執行紀錄，在最下方的 **Artifacts** 即可直接下載 **`SnapGemini-Debug-APK`**！
5. 將下載的 `.apk` 傳到手機上，點擊安裝即可成為獨立原生 App！

---

## 💻 方式二：本機 Android Studio 編譯

如果您的電腦上已經有安裝 **Android Studio**：

1. 打開 Android Studio，點選 **「Open」**。
2. 選擇本專案內的 `android` 資料夾（路徑：`c:\Users\L0865\Desktop\Pei\AIP&CIP\9月課程\0923\android`）。
3. 等待 Gradle 同步完成後，點選頂部選單：
   `Build` ➔ `Build Bundle(s) / APK(s)` ➔ `Build APK(s)`。
4. 編譯完成後點擊右下角的 **`locate`**，即可取得 `app-debug.apk`。

---

## 🌐 方式三：PWABuilder 線上一鍵生成 APK（免寫程式碼）

1. 將本專案部署到免費的 GitHub Pages、Vercel 或 Cloudflare Pages 取得 HTTPS 網址。
2. 打開 [PWABuilder 官方網站](https://www.pwabuilder.com/)。
3. 輸入您的網址，點擊 **「Start」** ➔ 點擊 **「Package for Stores」** ➔ 選擇 **Android**。
4. 點擊 **「Generate APK」** 即可直接下載編譯好的 Android 安裝包！

---

## 📲 安裝到 Android 手機的注意事項

* 首次在 Android 手機上點擊 `.apk` 安裝時，系統可能會提示「允許來自此來源的應用程式」，請點選**「允許/繼續安裝」**。
* 安裝後，手機桌面將擁有專屬的 **SnapGemini** 應用程式圖示，點開即可全螢幕極速拍照並呼叫 Gemini！
