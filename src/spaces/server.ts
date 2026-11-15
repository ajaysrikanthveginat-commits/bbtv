import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { WebSocket, WebSocketServer } from "ws";
import { changeWatch, newWatchState, watchPosition } from "../shared/watch";
import { capacity, modes, type Chat, type Member, type Note, type RoomEvent, type RoomRequest, type Space } from "./protocol";

type Saved = Pick<Space, "id" | "name" | "mode" | "notes" | "watch">;
type Live = { space: Saved; clients: Map<WebSocket, Member>; presenter: string; chat: Chat[] };
const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const code = /^[a-f0-9]{24}$/;
const trim = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";

export function roomSockets() {
  const filename = process.env.BBTV_DATABASE || "./data/spaces.sqlite";
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, owner TEXT NOT NULL, document TEXT NOT NULL)");
  const load = db.prepare("SELECT owner, document FROM rooms WHERE id = ?");
  const create = db.prepare("INSERT INTO rooms (id, owner, document) VALUES (?, ?, ?)");
  const write = db.prepare("UPDATE rooms SET document = ? WHERE id = ?");
  const live = new Map<string, Live>();
  const server = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  if (process.env.BBTV_TURN_URL && process.env.BBTV_TURN_USER && process.env.BBTV_TURN_PASSWORD) {
    iceServers.push({ urls: process.env.BBTV_TURN_URL, username: process.env.BBTV_TURN_USER, credential: process.env.BBTV_TURN_PASSWORD });
  }
  function send(ws: WebSocket, event: RoomEvent) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1_000_000) { ws.terminate(); return; }
    ws.send(JSON.stringify(event));
  }
  function host(room: Live) {
    const members = [...room.clients.values()];
    return (members.find(m => m.owner) || members[0])?.id ?? "";
  }
  function broadcast(room: Live) {
    const event: RoomEvent = {
      type: "state", now: Date.now(),
      space: { ...room.space, members: [...room.clients.values()], host: host(room), presenter: room.presenter, chat: room.chat },
    };
    room.clients.forEach((_, ws) => send(ws, event));
  }
  function save(room: Live, next: Saved) {
    const watch = next.watch;
    const stable = { ...next, watch: { ...watch, position: watchPosition(watch, Date.now()), playing: false, ready: [], breakUntil: undefined } };
    write.run(JSON.stringify(stable), next.id);
    room.space = next;
  }
  function resetPlayback(room: Live) {
    const watch = room.space.watch;
    if (!watch.playing && !watch.ready.length) return;
    save(room, { ...room.space, watch: { ...watch, playing: false, ready: [], position: watchPosition(watch, Date.now()), revision: watch.revision + 1 } });
  }
  // Limit anonymous room creation and message bursts within a single pilot instance.
  const budgets = new Map<string, { count: number; until: number }>();
  const pinged = new WeakSet<WebSocket>();
  const heartbeat = setInterval(() => {
    for (const [address, budget] of budgets) if (budget.until <= Date.now()) budgets.delete(address);
    server.clients.forEach(ws => {
      if (pinged.has(ws)) { ws.terminate(); return; }
      pinged.add(ws);
      ws.ping();
    });
  }, 25_000);
  heartbeat.unref();
  server.on("close", () => { clearInterval(heartbeat); db.close(); });

  server.on("connection", (ws, request) => {
    let room: Live | undefined;
    let actor: Member | undefined;
    let messages = 0;
    let windowEnds = Date.now() + 1000;
    ws.on("pong", () => pinged.delete(ws));
    ws.on("error", () => ws.terminate());
    ws.on("close", () => {
      if (!room || !actor) return;
      room.clients.delete(ws);
      if (room.presenter === actor.id) room.presenter = "";
      try { resetPlayback(room); } catch (error) { console.error("Failed to save paused room", error); }
      if (room.clients.size) broadcast(room);
      else live.delete(room.space.id);
    });
    ws.on("message", raw => {
      let actionType: string | undefined;
      try {
        const now = Date.now();
        if (now > windowEnds) { messages = 0; windowEnds = now + 1000; }
        if (++messages > 80) { ws.close(1008, "Too many updates"); return; }
        const action = JSON.parse(String(raw)) as RoomRequest;
        if (!action || typeof action.type !== "string") return;
        actionType = action.type;
        if (action.type === "clock" && typeof action.at === "number") {
          send(ws, { type: "clock", at: action.at, now });
          return;
        }
        if (!room || !actor) {
          if (action.type !== "create" && action.type !== "join") return;
          const name = trim(action.name, 32);
          if (!name) throw new Error("Add your name to join.");
          let id: string;
          let ownerKey: string | undefined;
          if (action.type === "create") {
            const title = trim(action.title, 64);
            if (!title || !modes.includes(action.mode)) throw new Error("Choose a room name and activity.");
            const address = request.socket.remoteAddress || "unknown";
            const previous = budgets.get(address);
            const budget = previous && previous.until > now ? previous : { count: 0, until: now + 3600_000 };
            if (budget.count >= 30) throw new Error("Too many new rooms. Join an existing room or try again later.");
            budget.count++;
            budgets.set(address, budget);
            id = randomBytes(12).toString("hex");
            ownerKey = randomBytes(24).toString("hex");
            const space: Saved = { id, name: title, mode: action.mode, notes: [], watch: newWatchState(true) };
            create.run(id, hash(ownerKey), JSON.stringify(space));
          } else {
            id = trim(action.room, 30).toLowerCase();
            if (!code.test(id)) throw new Error("Use a BBTV Spaces invite link.");
          }
          const stored = load.get(id) as { owner: string; document: string } | undefined;
          if (!stored) throw new Error("That room couldn’t be found. Check the invite link.");
          const target = live.get(id) || { space: JSON.parse(stored.document) as Saved, clients: new Map(), presenter: "", chat: [] };
          if (target.clients.size >= capacity) throw new Error("All four seats are taken. Try again when someone leaves.");
          const candidate = ownerKey || (action.type === "join" ? trim(action.ownerKey, 52) : "");
          const owner = !!candidate && hash(candidate) === stored.owner && ![...target.clients.values()].some(member => member.owner);
          resetPlayback(target);
          room = target;
          actor = { id: randomUUID(), name, owner, hand: false, audio: false, video: false };
          room.clients.set(ws, actor);
          live.set(id, room);
          send(ws, { type: "joined", id: actor.id, room: id, ownerKey, iceServers, persistent: !!process.env.BBTV_DATABASE && filename !== ":memory:" });
          broadcast(room);
          return;
        }
        const current = room.space;
        const isHost = host(room) === actor.id;
        const requireHost = () => { if (!isHost) throw new Error("The person hosting this session controls that."); };
        switch (action.type) {
          case "mode":
            requireHost();
            if (!modes.includes(action.mode)) return;
            if (current.mode === action.mode) return;
            save(room, { ...current, mode: action.mode, watch: { ...current.watch, position: watchPosition(current.watch, now), playing: false, ready: [], revision: current.watch.revision + 1 } });
            break;
          case "note": {
            const text = trim(action.text, 500);
            if (!text || !["note", "question", "decision"].includes(action.kind)) throw new Error("Add a note or question first.");
            if (current.notes.length >= 100) throw new Error("This room has reached its 100-note limit.");
            const note: Note = { id: randomUUID(), kind: action.kind, text, author: actor.name, done: false };
            if (action.pin === true && current.mode === "watch" && current.watch.url) {
              note.position = Math.floor(watchPosition(current.watch, now));
              note.source = current.watch.url;
            }
            save(room, { ...current, notes: [...current.notes, note] });
            break;
          }
          case "resolve":
            requireHost();
            if (!current.notes.some(note => note.id === action.id)) return;
            save(room, { ...current, notes: current.notes.map(note => note.id === action.id ? { ...note, done: !note.done } : note) });
            break;
          case "hand":
            if (typeof action.value !== "boolean") return;
            actor.hand = action.value;
            break;
          case "devices":
            if (typeof action.audio !== "boolean" || typeof action.video !== "boolean") return;
            actor.audio = action.audio;
            actor.video = action.video;
            break;
          case "chat": {
            const text = trim(action.text, 600);
            if (!text) return;
            room.chat = [...room.chat.slice(-49), { id: randomUUID(), name: actor.name, text }];
            break;
          }
          case "present":
            if (typeof action.value !== "boolean") return;
            if (action.value && room.presenter && room.presenter !== actor.id) throw new Error("Someone is already sharing. Try again when they stop.");
            if (!action.value && room.presenter !== actor.id) return;
            if (action.value) resetPlayback(room);
            room.presenter = action.value ? actor.id : "";
            break;
          case "watch":
            if (room.presenter || current.mode !== "watch") throw new Error("Switch to Movie night to control the video.");
            save(room, { ...current, watch: changeWatch(current.watch, action.action, actor.id, host(room), [...room.clients.values()].map(member => member.id), now) });
            break;
          case "rtc": {
            if (!action.signal || typeof action.signal !== "object" || typeof action.to !== "string" || action.to === actor.id) return;
            const signal = action.signal;
            if ("sdp" in signal) {
              if (!signal.sdp || !["offer", "answer"].includes(signal.sdp.type) || typeof signal.sdp.sdp !== "string" || signal.sdp.sdp.length > 24_000) return;
            } else if ("candidate" in signal) {
              if (!signal.candidate || typeof signal.candidate.candidate !== "string" || signal.candidate.candidate.length > 2048) return;
            } else if (!("retry" in signal) || signal.retry !== true) return;
            const target = [...room.clients].find(([, member]) => member.id === action.to)?.[0];
            if (target) send(target, { type: "rtc", from: actor.id, signal: action.signal });
            return;
          }
          default: return;
        }
        broadcast(room);
      } catch (error) {
        const message = error instanceof Error && !(error instanceof SyntaxError) && !("code" in error) && !(error instanceof TypeError)
          ? error.message : "BBTV couldn’t complete that update.";
        send(ws, { type: "error", message, action: actionType });
      }
    });
  });
  return server;
}
