# BBTV movie-night release candidate

## Implemented
- Responsive charcoal/violet landing page, invitation entry, and call toolbar.
- Actual HTML video playback for direct HTTPS, browser-supported, finite-duration media URLs.
- Server-owned playback state, shared play/pause/seek, periodic drift correction, and client/server clock estimation.
- Both people mark ready; start schedules a shared three-second countdown.
- Guest control permission enforced by the server; either person can request a break by clearing readiness.
- Room playback pauses on disconnect or screen-sharing start. Polling restores current state after reconnect.
- Shared room names and host-role updates, individual device volume, autoplay-unblock action, media errors, quick chat reactions.
- Removed simulated movie-library selections and unsupported upload/streaming-format promises.
- Automated reducer and two-client WebSocket tests, plus GitHub CI for type checking and build.

## Supported scope and release checks
Two-person rooms on a single Node server. This release does not implement local-file transfer, subscription-service integrations, group calls, persistent accounts, queues, or scheduling. Screen-sharing audio depends on browser/device support and the selected source. A URL must be accessible to both browsers and point to playable media, not a provider's webpage. Synchronization is approximate, not frame-perfect. Short buffering interruptions are corrected by periodic synchronization; automatic wait-for-buffering is not implemented.

Before production release, verify desktop/mobile rendering and a two-device session including camera/microphone, screen/tab audio, autoplay recovery, and reconnect. Automated signaling tests do not prove media or WebRTC quality. Existing rooms live in server memory and end on server restart.

Run `npm ci`, `npm run lint`, `npm test`, and `npm run test:integration`. Build and start with `npm run build` and `npm start`.
