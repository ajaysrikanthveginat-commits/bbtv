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

For a durable deployment, set `BBTV_DATABASE` to an absolute SQLite file path on a persistent volume. The default `./data/spaces.sqlite` persists on the same filesystem, which may be replaced during a hosted deployment. The pilot runs as a single application instance. Configure `BBTV_TURN_URL`, `BBTV_TURN_USER`, and `BBTV_TURN_PASSWORD` on a trusted pilot deployment for networks that require relaying. Screen sharing sends the browser-provided display audio separately from the microphone. For movie sound, choose the video’s tab and enable tab audio in the browser picker. Sources without audio remain available as video-only presentations.

Keep the invite URL within the group. Its random ID is the capability required to read or join the room. The room owner's credential is separate and remains in their browser. The host can change activities and moderate questions. If the owner is away, the first connected participant coordinates the live session.

## Daily room tools

The optional device check previews the selected camera and measures microphone input before joining. The Reconnect control rejoins the same room with devices off. Saved work stays on the board while participants reconnect.

Each room supports six shared handwritten pages, undo/redo, local zoom and pan, and shared pointers. Questions can be pinned to a page and resolved by the host. Meeting participants can focus a camera or enlarge the shared presentation. Family avatars are made from original configurable artwork and can be sent as expressions.

The service commits room changes and the three preceding versions in a SQLite transaction. It also writes a consistent database backup under the database directory's `backups` subdirectory every 15 minutes, keeping seven daily files. Configure `BBTV_DATABASE=/var/data/spaces.sqlite` on an attached persistent Render disk so the database and its backups survive deployments. Files on an ephemeral filesystem can still be lost. A Render paid service and disk must be configured through the hosting account.

Browsers keep an independent room recovery copy in IndexedDB. The returning-room cards show local board previews and poll presence for known invite IDs. Downloaded room backups contain pages and saved notes, without the owner's credential. Hosts can import a backup or restore one of the three preceding service versions. If a service room is gone, Restore a copy creates a new room and invitation from the device copy. Browser recovery depends on that device retaining its site data.
