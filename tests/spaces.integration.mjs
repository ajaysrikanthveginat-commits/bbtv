import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const directory = await mkdtemp(join(tmpdir(), "bbtv-spaces-"));
const sockets = new Set();
let server;
const port = 3146;

async function start() {
  server = spawn(process.execPath, ["dist/server.cjs"], {
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), BBTV_DATABASE: join(directory, "spaces.sqlite") },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not start")), 5000);
    server.stdout.on("data", bytes => {
      if (String(bytes).includes("Server listening")) { clearTimeout(timer); resolve(); }
    });
    server.once("error", error => { clearTimeout(timer); reject(error); });
  });
}

async function stop() {
  sockets.forEach(socket => socket.terminate());
  sockets.clear();
  if (server && server.exitCode === null && server.signalCode === null) {
    const ended = once(server, "exit");
    server.kill();
    await ended;
  }
}

async function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/spaces-ws`);
  sockets.add(ws);
  await once(ws, "open");
  return ws;
}
function receive(ws, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off("message", message); reject(new Error("Room did not emit the expected update")); }, 4000);
    function message(raw) {
      const event = JSON.parse(raw);
      if (predicate(event)) { clearTimeout(timer); ws.off("message", message); resolve(event); }
    }
    ws.on("message", message);
  });
}
function perform(ws, action, predicate) {
  const result = receive(ws, predicate);
  ws.send(JSON.stringify(action));
  return result;
}
try {
  await start();
  const host = await client();
  const initial = await perform(host, { type:"create", title:"Study group", name:"Alex", mode:"study" }, event => event.type === "joined");
  assert.match(initial.room, /^[a-f0-9]{24}$/);
  assert.ok(initial.ownerKey);
  const joinRoom = async (name) => {
    const ws = await client();
    const joined = await perform(ws, {type:"join", room:initial.room, name}, event => event.type === "joined");
    return { ws, joined };
  };
  const guest = await joinRoom("Sam");
  await joinRoom("Noa");
  const joined4 = receive(host, event => event.type === "state" && event.space.members.length === 4);
  await joinRoom("Priya");
  await joined4;
  const overflow = await client();
  assert.match((await perform(overflow, {type:"join",room:initial.room,name:"Extra"}, event => event.type === "error")).message, /four seats/);
  assert.match((await perform(guest.ws, {type:"mode",mode:"watch"}, event => event.type === "error")).message, /hosting/);
  await perform(host, {type:"mode",mode:"meet"}, event => event.type === "state" && event.space.mode === "meet");
  const written = receive(host, event => event.type === "state" && event.space.notes.length);
  guest.ws.send(JSON.stringify({type:"note",kind:"decision",text:"Review Chapter 3",pin:false}));
  const saved = (await written).space;
  assert.equal(saved.notes[0].author, "Sam");
  assert.equal(saved.members[0].owner, true);
  await stop();
  await start();
  const back = await client();
  const reopened = await perform(back, {type:"join",room:initial.room,name:"Alex",ownerKey:initial.ownerKey}, event => event.type === "state");
  assert.equal(reopened.space.mode, "meet");
  assert.equal(reopened.space.notes[0].text, "Review Chapter 3");
  assert.equal(reopened.space.members.length, 1);
  assert.equal(reopened.space.members[0].owner, true);
  console.log("PASS: four-seat capacity, host controls, shared notes, return after restart");
} finally {
  await stop();
  await rm(directory, {recursive:true, force:true});
}
