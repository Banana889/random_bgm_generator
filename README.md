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

## Architecture

The main app has migrated to Vite, React, TypeScript, SCSS, and npm-local Tone.js.

See [docs/migration.md](./docs/migration.md) for migration details.

## Roadmap

See [docs/TODO.md](./docs/TODO.md).

If you enjoy Driftone, consider giving this repo a star.
