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

## BBTV Spaces pilot

Open `/` or `/spaces` to create a reusable four-seat room. Study opens a handwriting desk, Meet uses a meeting workspace, and Family opens a lounge with video and live reactions. Study and Meet have a shared freehand board with pen, highlighter, calligraphy, eraser, and PNG export. The activity picker changes rooms without ending the call. The server saves the room name, activity, handwriting, notes, and paused watch state in SQLite. Chat, reactions, and hand raises are live-session state. Older `?room=` invitations and `/classic` open the classic watch party.

Use Node 24. Run `npm ci` and `npm run dev`, or `npm run build && npm start`. Run `npm run test:integration` for the WebSocket and restart tests, and `npm run test:browser` with Chromium installed for the complete room flows.

For a durable deployment, set `BBTV_DATABASE` to an absolute SQLite file path on a persistent volume. The default `./data/spaces.sqlite` persists on the same filesystem, which may be replaced during a hosted deployment. The pilot runs as a single application instance. Configure `BBTV_TURN_URL`, `BBTV_TURN_USER`, and `BBTV_TURN_PASSWORD` on a trusted pilot deployment for networks that require relaying. Screen sharing sends video plus the existing microphone track, without capturing system audio.

Keep the invite URL within the group. Its random ID is the capability required to read or join the room. The room owner's credential is separate and remains in their browser. The host can change activities and moderate questions. If the owner is away, the first connected participant coordinates the live session.
