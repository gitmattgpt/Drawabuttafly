# AR Tracking Plan

## Direction

The project should use separate tracking modes rather than trying to solve image tracking, hand tracking, and room reconstruction with one algorithm. The first usable milestone is a **camera-generated image target with a reliable printed fallback**. Hand tracking should follow as an independent interaction mode. Generic wall and surface tracking should remain an optional capability with a graceful fallback.

The current browser prototype is a static Vercel-friendly application. Vercel preview deployments provide HTTPS and a unique URL for testing camera permissions on real phones. Vercel supports Git-connected preview deployments and static files can be deployed without a framework or build step [1].

## Phase 0: Development and deployment baseline

The repository now includes a no-cache local server:

```bash
npm run dev
```

Open `http://127.0.0.1:8000/` on the development computer. Camera access works on `localhost` or through an HTTPS deployment. For phone testing, use a Vercel preview deployment from the `best-version` branch.

The first test harness should show camera permission state, device/browser capability checks, frame rate, and tracker status. These diagnostics will make it possible to distinguish an unsupported browser from a tracker that simply lacks visual detail.

## Phase 1: Capture, crop, and target-quality analysis

The existing capture editor should become the input to a target-preparation workflow. The user should crop the butterfly image, adjust the crop in a future editor, and then choose **Create image target**.

The preparation screen should provide two outputs:

1. **Natural image target.** The cropped image is analyzed for trackable detail and compiled for an image-tracking library.
2. **Printable fallback marker.** A high-contrast marker is generated with a machine-readable identity, a clear quiet zone, corner registration marks, and the butterfly artwork placed inside a safe inner area.

The UI should display a warning when the crop has low tracking quality. The warning should identify the likely cause, such as a large flat region, weak contrast, repeated symmetry, blur, glare, or too few corners. It should recommend adding texture and contrast rather than claiming that tracking is impossible.

For the corner idea, use printed registration marks as part of the fallback format. Instructions such as “keep all four corners visible” are safer than requiring a person to draw X marks manually. If manual X marks are retained as an experimental mode, they should be treated as optional hints and never as the only identity signal.

A target record should contain the target ID, image or marker asset, crop settings, quality score, and fallback marker version. The first implementation can keep records in memory; persistence should be added after tracking is stable.

## Phase 2: Natural image tracking with printed fallback

MindAR is the first candidate for browser image tracking because it is open source, supports image tracking, supports direct Three.js integration, and provides a browser-based target compilation path [2]. The target compiler should run as a build or preparation step rather than on every camera frame.

The tracker adapter should expose a small project-level interface:

```text
loadTarget(targetRecord)
start(video)
getPose() -> tracked / lost, transform, confidence
stop()
```

The scene should place the butterfly in marker coordinates supplied by the adapter. This replaces the current fixed `TARGET_CENTER_POS` when image tracking mode is active.

The natural target should not be assumed to work for every captured photo. A low-detail warning and printed fallback are necessary because target quality depends on distinctive visual features. The fallback should be the reliable path for a crop that does not produce a strong natural target.

The first acceptance test is simple: hold a printed fallback marker in front of the camera, move and rotate it, and verify that the butterfly follows its plane without drifting excessively. Only after this works should natural-image targets be added to the same adapter.

## Phase 3: Fingertip landing mode

Use MediaPipe Hand Landmarker instead of generic edge detection. The official web task provides 21 image landmarks and world landmarks, including fingertip coordinates, and supports video inference through `detectForVideo()` [3]. The package can be installed through `@mediapipe/tasks-vision`, or loaded from its documented CDN bundle [3].

The first hand prototype should render landmark debug dots and attach a simple butterfly to the index fingertip. It should then add:

- temporal smoothing to reduce jitter;
- a confidence threshold and a short stability window before landing;
- a tracking-loss timeout before takeoff;
- a choice of fingertip, index finger, or nearest visible fingertip;
- a screen-space mode first, followed by optional depth-informed scaling using the landmark z value.

Hand detection should run at a controlled rate. The MediaPipe documentation notes that synchronous video inference can block the UI thread, so a later optimization should move inference to a worker if frame rate becomes poor [3].

A white background may help in controlled demonstrations, but it should not be required. The hand tracker should be evaluated against varied lighting, skin tones, sleeves, partial occlusion, and fingers crossing each other.

## Phase 4: Surface and wall placement

The preferred free browser route is **WebXR hit testing** where the device and browser support it. Hit testing can return poses for real-world intersections, and anchors can attach virtual objects to those locations. However, WebXR hit testing is experimental, limited in browser availability, and restricted to secure contexts [4]. It must therefore be feature-detected and presented as an optional “Place on surface” mode.

The fallback for unsupported devices should not pretend to reconstruct a room. It should offer one of these simpler behaviors:

- image-marker placement;
- fingertip placement;
- a tap-to-place camera-relative butterfly;
- a visual “landing” effect on a detected high-contrast region without claiming persistent world anchoring.

A classical feature-based approach using corner detection, optical flow, and homography can be investigated for a flat wall or poster, but it is not a general mesh solution. Bright/dark consistency can help reject unstable regions, but it cannot by itself produce reliable 3D surface geometry. The old luminance-derived point cloud should remain archived and should not be used as a real-world mesh tracker.

## Suggested code boundaries

```text
src/
  main.js                 application bootstrap and mode selection
  styles.css              active styling
  tracking/
    tracker-interface.js   shared tracker contract
    image-target.js       MindAR or fallback marker adapter
    hand-landmarks.js     MediaPipe adapter
    surface-hit-test.js   optional WebXR adapter
  targets/
    target-quality.js     crop quality checks and warning reasons
    marker-generator.js   printable fallback marker creation
```

The initial implementation can keep these modules small. The important boundary is that rendering and butterfly behavior should not know whether a pose came from a marker, a fingertip, or WebXR.

## Milestones and acceptance tests

| Milestone | Acceptance test |
|---|---|
| Local/Vercel test harness | Camera permissions, secure-context state, and tracker diagnostics are visible. |
| Printable fallback marker | The marker is printable, has a stable ID, and remains detectable when rotated and partially moved. |
| Marker-anchored butterfly | The butterfly follows the marker plane and returns after brief tracking loss. |
| Natural image target | A high-detail crop tracks; a low-detail crop produces a useful warning and fallback recommendation. |
| Fingertip landing | The butterfly lands on a stable index fingertip and leaves after tracking loss. |
| Surface placement | WebXR is used only when supported; unsupported browsers receive a clear fallback mode. |

## Recommendation

Implement the printed fallback marker and tracker-quality diagnostics first. Then add natural-image tracking through an adapter. Build fingertip tracking as the next independent feature because it can provide a compelling interaction without requiring room-scale reconstruction. Investigate WebXR hit testing only after the marker and hand modes are stable.

## References

[1]: https://vercel.com/docs/deployments/overview "Deploying to Vercel"
[2]: https://hiukim.github.io/mind-ar-js-doc/ "MindAR documentation"
[3]: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js "Hand landmarks detection guide for Web"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/XRHitTestResult "XRHitTestResult - MDN Web Docs"
