const KEY = "dss.settings.v1";

export const DEFAULT_SETTINGS = {
  branch: "main",
  gradleTask: "assembleDebug",
  retryLimit: 3,
  artifactFilter: "apk",
  vercelProject: "",
};

export function loadSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function textToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function androidWorkflowTemplate(task = "assembleDebug") {
  return `name: Android Build
on:
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up JDK
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"

      - name: Set up Android SDK
        uses: android-actions/setup-android@v3

      - name: Gradle build
        run: |
          chmod +x ./gradlew || true
          if [ -x ./gradlew ]; then ./gradlew ${task} --no-daemon --stacktrace; else gradle ${task} --no-daemon --stacktrace; fi

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-apk
          path: |
            **/build/outputs/**/*.apk
          if-no-files-found: error
`;
}