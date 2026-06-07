<h1 align="center">
  <img src="public/static/driftone-icon-1024.svg" alt="Driftone icon" width="64" align="absmiddle" /> Driftone
</h1>

<p align="center"><strong>Generative ambient music and white noise, anchored in a tranquil harbor.</strong></p>

<p align="center">
  <a href="https://banana889.github.io/Driftone/"><img src="https://img.shields.io/badge/Demo-GitHub%20Pages-263238?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Pages demo" /></a>
  <img src="https://img.shields.io/badge/Status-Developing-F57C00?style=for-the-badge" alt="Project status: developing" />
  <img src="https://img.shields.io/badge/App-PWA-5E35B1?style=for-the-badge&logo=pwa&logoColor=white" alt="Progressive web app" />
  <img src="https://img.shields.io/badge/Audio-Tone.js-00ACC1?style=for-the-badge" alt="Tone.js audio engine" />
</p>

> Based on Tone.js, ~~Gemini~~, and my poor music theory...
>
> Developing...

Driftone is a browser-based experiment in generative ambient music.
It combines simple harmony rules, evolving melody logic, selectable instruments, and environmental noise to create an endless soundscape.

![Screenshot](./docs/assets/screenshot.png)

## Run

Try it online on my [GitHub Pages site](https://banana889.github.io/Driftone/).

For development:

```bash
npm install
npm run dev
```

For production verification:

```bash
npm run build
npm test
```

Running it directly via `file://` is not recommended. The app uses Web Audio, a worker-backed scheduler, and audio assets such as `public/res/rain.mp3`, which browsers often restrict outside a local server context.

## Mobile App

Driftone ships an Android app shell through Capacitor. The native project lives in `android/`; the UI, visualizer, and Tone.js audio engine are still built from the same Vite app in `dist/`.

Sync the latest web build into the Android project:

```bash
npm run cap:sync
```

Open the Android project in Android Studio:

```bash
npm run cap:android
```

For easy device testing, GitHub Actions can build a downloadable debug APK and attach it to a GitHub Release:

1. Open this repository on GitHub.
2. Go to `Actions` -> `Android APK Release`.
3. Run the workflow with a tag such as `v0.1.0-test`.
4. Download `driftone-debug.apk` from the generated GitHub Release.

Inside CI, the APK is built from:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The generated APK is a debug build for personal testing and direct installation. It is not a signed store release.

Before publishing, prepare these items:

- App icon PNG assets for Android. The current app icon is enough for development, but stores expect platform-specific icon sizes.
- Android signing key and Play Console account for release builds.
- Store metadata: app description, screenshots, privacy policy, and audio/background-playback notes if background audio is added later.
- Device testing on real Android hardware, especially Web Audio behavior, screen lock behavior, and long sessions.

## Architecture

The main app has migrated to Vite, React, TypeScript, SCSS, and npm-local Tone.js.

See [docs/migration.md](./docs/migration.md) for migration details.

## Roadmap

See [docs/TODO.md](./docs/TODO.md).

If you enjoy Driftone, consider giving this repo a star.
