# BBTV · Better together

A two-person movie room with synchronized video playback, chat, and optional video calls. Create a room, send its invitation, choose a direct video link or the built-in preview, and press play when you are both ready.

## Included

- Responsive charcoal and violet interface, invitation dialog, and focused cinema mode.
- Direct HTTPS video playback with server-owned play/pause/seek state and drift correction.
- Two-person readiness check, shared three-second countdown, and take-a-break control.
- Host permission for guest playback controls; volume stays local to each device.
- Real-time chat and quick reactions, camera/microphone toggles, and host screen sharing.
- Session recovery using a per-participant resume token. Playback pauses when someone disconnects.

## Development

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. No Gemini API key is required for these features.

## Production

```sh
npm ci
npm run build
NODE_ENV=production npm start
```

The server uses `PORT` (defaults to 3000) and serves both the built frontend and `/ws`. On Render, use build command `npm ci && npm run build`, start command `npm start`, and set `NODE_ENV=production`. Keep a single server instance: rooms are held in memory and end on restart. HTTPS is required for camera, microphone, and screen-sharing APIs outside localhost.

## Validation

```sh
npm run lint
npm test
npm run test:integration
```

The GitHub Actions workflow installs Chromium, exercises desktop and mobile room flows and two-browser playback, and uploads screenshots and traces. To run locally:

```sh
npx playwright install --with-deps chromium
npm run test:browser
```

## Current boundaries

Use direct, browser-supported video URLs with a finite duration, accessible from both devices. YouTube/Netflix page URLs and local-file transfer are not implemented. Screen sharing depends on browser permissions and content restrictions; tab audio support varies by browser. Playback synchronization is approximate.

Calls currently use STUN servers; restrictive networks may require a TURN relay, which is not configured by this project. Automated browser checks do not replace a two-device camera, microphone, and screen-audio check. See [RELEASE-NOTES.md](RELEASE-NOTES.md) for release scope.
