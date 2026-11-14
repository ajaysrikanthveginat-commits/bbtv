import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
const server = spawn(process.execPath, ["dist/server.cjs"], {
  env: { ...process.env, NODE_ENV: "production", PORT: "3137" },
  stdio: ["ignore", "pipe", "pipe"],
});
const sockets = [];
const timeout = setTimeout(() => {
  console.error("Integration test timed out");
  server.kill();
  process.exit(1);
}, 15000);
function request(socket, payload, type) {
  payload.requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", receive);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 3000);
    const receive = (raw) => {
      const m = JSON.parse(raw);
      if (
        m.type === type &&
        (!type.startsWith("WATCH_") || m.requestId === payload.requestId)
      ) {
        clearTimeout(timer);
        socket.off("message", receive);
        resolve(m);
      }
    };
    socket.on("message", receive);
    socket.send(JSON.stringify(payload));
  });
}
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => {
      if (String(d).includes("Server listening")) resolve();
    });
    server.once("exit", (code) => reject(new Error(`Server exited ${code}`)));
    server.stderr.on("data", (d) => process.stderr.write(d));
  });
  const health = await fetch("http://127.0.0.1:3137/api/health");
  assert.equal(health.status, 200);
  const connect = async () => {
    const ws = new WebSocket("ws://127.0.0.1:3137/ws");
    sockets.push(ws);
    await once(ws, "open");
    return ws;
  };
  const host = await connect(),
    guest = await connect();
  const joined = await request(
    host,
    { type: "CREATE_ROOM", senderId: "host", allowControl: true },
    "ROOM_JOINED",
  );
  const roomId = joined.roomId;
  assert.equal(typeof joined.resumeToken, 'string');
  const intruder = await connect();
  const rejected = await request(intruder, {type:'JOIN_ROOM', roomId, senderId:'host'}, 'ROOM_ERROR');
  assert.match(rejected.message, /another browser/);
  intruder.close();

  await request(
    guest,
    { type: "JOIN_ROOM", roomId, senderId: "guest" },
    "ROOM_JOINED",
  );
  const action = (ws, senderId, a, type = "WATCH_STATE") =>
    request(ws, { type: "WATCH_ACTION", roomId, senderId, action: a }, type);
  await action(host, "host", {
    kind: "source",
    url: "https://example.com/movie.mp4",
  });
  const before = await action(host, "host", { kind: "start" }, "WATCH_ERROR");
  assert.match(before.message, /ready/);
  await action(host, "host", { kind: "ready", ready: true });
  await action(guest, "guest", { kind: "ready", ready: true });
  const start = await action(host, "host", { kind: "start" });
  assert.equal(start.state.playing, true);
  assert.ok(start.state.updatedAt > start.serverTime);
  await action(guest, "guest", { kind: "seek", position: 42 });
  const sync = await request(
    host,
    { type: "WATCH_GET", roomId, senderId: "host", requestTime: Date.now() },
    "WATCH_STATE",
  );
  assert.equal(sync.state.position, 42);
  await action(host, "host", { kind: "permission", allowControl: false });
  const denied = await action(
    guest,
    "guest",
    { kind: "seek", position: 100 },
    "WATCH_ERROR",
  );
  assert.match(denied.message, /host/);
  const pause = await action(guest, "guest", { kind: "ready", ready: false });
  assert.equal(pause.state.playing, false);
  guest.close();
  await once(guest, "close");
  const remaining = await request(
    host,
    { type: "WATCH_GET", roomId, senderId: "host" },
    "WATCH_STATE",
  );
  assert.equal(remaining.members.length, 1);
  assert.equal(remaining.state.playing, false);
  console.log(
    "PASS: HTTP health, room join, shared source, readiness gate, countdown, seek propagation, permissions, break, disconnect pause",
  );
} finally {
  clearTimeout(timeout);
  for (const ws of sockets) ws.terminate();
  server.kill();
}
