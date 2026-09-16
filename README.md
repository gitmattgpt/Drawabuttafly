# Drawabuttafly

A camera-based butterfly creator and AR-style swarm prototype.

## Project structure

- `index.html` — application markup and the Three.js CDN dependency.
- `src/styles.css` — styles for the active application.
- `src/main.js` — active application logic.
- `archive/legacy/` — stale scanner-era files retained for reference only; they are not loaded by the application.
- `AR-TRACKING-PLAN.md` — staged plan for image targets, printed markers, hand landmarks, and optional surface placement.

## Local development

Installations are not required for the current static prototype. The development server uses Python's standard library and disables caching so camera and AR changes are immediately testable.

```bash
npm run dev
```

Then open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in a browser. Camera access is allowed on localhost. Stop the server with `Ctrl+C`.

The following commands are also available:

```bash
npm run check   # JavaScript and Python syntax checks
npm run serve   # basic Python static server with caching enabled
```

For testing on a phone, use a Vercel preview deployment. Connect the GitHub repository to Vercel and deploy the `best-version` branch, or run `vercel` from the repository root if the Vercel CLI is configured. Use the preview URL rather than an unsecured LAN IP because camera and WebXR features require a secure context on supported browsers.

## Browser test notes

Allow camera and motion permissions. Test on a physical phone for camera behavior; desktop emulation cannot validate device orientation, camera framing, or hand-tracking performance. Keep the camera image well lit and ensure that the full test marker remains visible when marker tracking is added.

See [AR-TRACKING-PLAN.md](AR-TRACKING-PLAN.md) before adding tracking libraries or changing the capture workflow.

## Live image tracking

After creating a `.mind` file in the capture editor, use the **Load .mind target** control and choose that file. Select **Track Generated Target** and hold the corresponding printed or displayed image in front of the rear camera. The butterfly is attached to MindAR target index `0`. Select **Stop Image Tracking** to return to the original prototype view.

The generated `.mind` file is downloaded by the browser and is not uploaded to the repository. Keep the physical target visually consistent with the crop used to compile it. The browser must grant camera access, and the page must be served from localhost or HTTPS. The current integration uses the browser-ready MindAR 1.1.5 runtime from jsDelivr.
