---
description: How to build the Android APK
---

To build your Android APK, follow these steps:

1.  **Prerequisites**:
    *   Ensure **Android Studio** is installed on your machine.
    *   Ensure the **Android SDK** and **Command Line Tools** are configured.

2.  **Run the Build Command**:
    Execute the following in your terminal:
    ```bash
    npm run build:android
    ```
    This will:
    *   Build the React production assets.
    *   Sync them to the `android/` folder.
    *   Open a prompt to build the APK via Capacitor.

3.  **Manual Build via Android Studio** (Optional/Recommended for Debugging):
    If the CLI build fails or you want to sign the APK, run:
    ```bash
    npx cap open android
    ```
    *   Once Android Studio opens, wait for Gradle to sync.
    *   Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
    *   The path to the generated APK will be shown in a notification once complete.

4.  **Install on Phone**:
    *   Copy the `.apk` file to your phone.
    *   Enable "Install from Unknown Sources" in your phone's settings.
    *   Open the file and install!
