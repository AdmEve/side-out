# Building SIDE OUT for Android

The Android project is already generated and configured — `android/` is a real
Gradle project, not a placeholder. What it needs from you is the Android SDK,
which could not be downloaded in the environment this was built in (Google's
servers are blocked there). Everything else is done, including the app
identity (`gg.sideout.pong`).

## One-time setup

1. Install **Android Studio** (it brings the SDK, platform tools and a JDK).
2. Open it once and let it install:
   - Android SDK Platform **36**
   - Android SDK Build-Tools **36**
   - Android SDK Platform-Tools
3. Point Gradle at the SDK — either set `ANDROID_HOME`, or create
   `android/local.properties` containing:

   ```properties
   sdk.dir=/Users/you/Library/Android/sdk      # macOS
   # sdk.dir=C:\\Users\\you\\AppData\\Local\\Android\\Sdk   # Windows
   # sdk.dir=/home/you/Android/Sdk             # Linux
   ```

Java 17 or newer is required; Android Studio's bundled JDK is fine.

## Build and run

```bash
npm install
npm run build          # bundle the game into dist/
npx cap sync android   # copy dist/ into the Android project
```

Then either:

```bash
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

or open the `android/` folder in Android Studio and press Run. To install a
built APK on a plugged-in phone with USB debugging on:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android` does the build + sync + open-in-Android-Studio sequence in one
step. Run `npx cap sync android` at least once after any change to
`capacitor.config.ts` or `public/` — it's what copies the web build and its
config into `android/app/src/main/assets/`.

## What is already configured

| Concern | Where | What was done |
|---|---|---|
| Portrait lock | `AndroidManifest.xml` | `screenOrientation="portrait"`, `resizeableActivity="false"` |
| Immersive fullscreen | `MainActivity.java` | System bars hidden, re-hidden on focus regain, cutout `shortEdges` |
| No white flash | `styles.xml`, `colors.xml`, `capacitor.config.ts` | Window, splash and WebView backgrounds all `#05060F` |
| Screen stays awake | `MainActivity.java` | `FLAG_KEEP_SCREEN_ON` |
| Back button | `src/platform/native.ts` | Pauses mid-match, returns to menu from the pause screen, exits from the menu |
| Auto-pause | `src/platform/native.ts` | Pauses when Android backgrounds the app |
| Haptics | `src/platform/native.ts` | Short buzz on your own return, longer on a miss, a triple when your own wall shatters |
| Game flag | `AndroidManifest.xml` | `android:isGame="true"` so Android applies game-mode scheduling |

## Release build

1. Generate a keystore once:

   ```bash
   keytool -genkey -v -keystore sideout.keystore -alias sideout \
           -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add to `android/gradle.properties` (keep it out of version control):

   ```properties
   SO_STORE_FILE=/absolute/path/sideout.keystore
   SO_STORE_PASSWORD=…
   SO_KEY_ALIAS=sideout
   SO_KEY_PASSWORD=…
   ```

3. Add the signing config to `android/app/build.gradle` inside `android { }`:

   ```groovy
   signingConfigs {
       release {
           storeFile file(SO_STORE_FILE)
           storePassword SO_STORE_PASSWORD
           keyAlias SO_KEY_ALIAS
           keyPassword SO_KEY_PASSWORD
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           minifyEnabled true
           shrinkResources true
       }
   }
   ```

4. `./gradlew assembleRelease` produces a signed APK; `./gradlew bundleRelease`
   produces the `.aab` Google Play wants.

Bundle size is around 1.3 MB of JavaScript (almost all Phaser). There are no
image, font or audio assets to ship: every texture and every sound is
generated at runtime, which is what keeps the APK small and the app fully
offline-capable.

## App identity

- Application id: `gg.sideout.pong` — set in `capacitor.config.ts`,
  `android/app/build.gradle` (namespace + applicationId), the Java package
  folder (`android/app/src/main/java/gg/sideout/pong/`) and `strings.xml`.
  Change it in all four places and re-run `npx cap sync android` **before**
  your first store upload, since it can never be changed afterwards.
- Launcher icons live in `android/app/src/main/res/mipmap-*`. Replace them with
  your own artwork (Android Studio: right-click `res` → New → Image Asset).
  `public/icon-512.png` is a usable starting point.

## Performance notes

The simulation runs at a fixed 120 Hz and costs about 0.01 ms per step; drawing
a full 8-player arena with hazards costs around 0.1 ms per frame (measured via
`npm run browser-test`). The frame budget on a phone is therefore dominated by
the WebView compositor, not by the game, and mid-range hardware should hold
60 fps comfortably.
