# Capacitor Android & Google Gemini API Best Practices

## 1. Capacitor 8 & Android APK CI/CD Packaging Rules
- **Java JDK 21 Requirement**: When building Capacitor 8 Android apps via GitHub Actions CI or locally, always use Java JDK 21 (`actions/setup-java@v4` with `java-version: '21'`).
- **Web Assets Bundling Guarantee**:
  - NEVER exclude `android/app/src/main/assets/public/` in `.gitignore`.
  - Always ensure the build script (`build.js`) unconditionally creates and synchronizes all web assets (`index.html`, `css/`, `js/`, `icons/`, `manifest.json`, `sw.js`, `capacitor.config.json`) into `android/app/src/main/assets/public/` prior to running `./gradlew assembleDebug` to prevent `net::ERR_CONNECTION_REFUSED` on mobile devices.
- **Gradle & Clean Configuration**:
  - In root `build.gradle`, register modern clean task syntax: `tasks.register('clean', Delete) { delete rootProject.layout.buildDirectory }`.
  - If no Cordova plugins are used, remove unused `capacitor-cordova-android-plugins` declarations from `settings.gradle` and `app/build.gradle`.
  - Enable `android:usesCleartextTraffic="true"` in `AndroidManifest.xml` for seamless local asset/HTTP compatibility.

## 2. Google Gemini 3.0+ Vision API Integration Rules
- **Active Model Matrix**:
  - Default to latest models: `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.0-flash`, `gemini-2.5-flash`.
  - Implement client-side auto-migration in `getModel()` to transparently upgrade legacy/deprecated model keys (`gemini-1.5-*`, `gemini-2.0-*`) stored in localStorage.
- **Smart Auto-Fallback on Server Congestion (HTTP 503 / 429)**:
  - If the primary model encounters a temporary high-demand spike (503 / `spikes in demand are usually temporary`), automatically attempt the next fallback model in sequence (e.g. `gemini-2.5-flash`) to ensure unbroken user experience.
- **API Key Health Check Tool**:
  - Always provide a dedicated "Test API Key" button in settings that sends a lightweight ping probe (`maxOutputTokens: 5`) and returns exact latency and specific diagnostic feedback (Invalid Key, Quota Exceeded, Server High Demand).
