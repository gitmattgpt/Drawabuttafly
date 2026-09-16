# Drawabuttafly

A camera-based butterfly creator and AR-style swarm prototype.

## Project structure

- `index.html` — application markup and the Three.js CDN dependency.
- `src/styles.css` — styles for the active application.
- `src/main.js` — active application logic.
- `archive/legacy/` — stale scanner-era files retained for reference only; they are not loaded by the application.

## Running locally

Serve the repository over HTTP or HTTPS because camera access requires a secure context (HTTPS, or localhost during local development). For example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/` in a browser that supports camera access and device orientation APIs.
