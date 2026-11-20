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
  const stroke = {type:"draw",revision:0,stroke:"first",phase:"start",points:[[100,100]],color:"#243f34",width:6,style:"calligraphy"};
  const beginning = receive(host, event => event.type === "ink" && event.stroke.id === "first");
  guest.ws.send(JSON.stringify(stroke));
  assert.equal((await beginning).finished, false);
  await perform(guest.ws,{...stroke,phase:"move",points:[[150,180],[200,140]]}, event => event.type === "ink" && event.stroke.points.length === 2);
  const complete = receive(host, event => event.type === "ink" && event.finished);
  guest.ws.send(JSON.stringify({...stroke,phase:"end",points:[]}));
  assert.equal((await complete).stroke.points.length, 3);
  const boardFull = await perform(host,{type:"hand",value:true},event => event.type === "state" && event.space.drawing.strokes.length === 1);
  assert.equal(boardFull.space.drawing.strokes[0].author,guest.joined.id);
  host.send(JSON.stringify({type:"draw-undo"}));
  const untouched = await perform(host,{type:"hand",value:false},event => event.type === "state");
  assert.equal(untouched.space.drawing.strokes.length,1);
  assert.match((await perform(guest.ws,{type:"draw-clear",revision:0},event => event.type === "error")).message,/hosting/);
  assert.match((await perform(guest.ws,{...stroke,stroke:"bad",points:[[Infinity,2]]},event => event.type === "error")).message,/drawing/);
  await perform(host,{...stroke,stroke:"host-stroke"},event => event.type === "ink" && event.stroke.id === "host-stroke");
  await perform(host,{...stroke,stroke:"host-stroke",phase:"end",points:[[140,120]]},event => event.type === "ink" && event.finished && event.stroke.id === "host-stroke");
  const undone = await perform(host,{type:"draw-undo"},event => event.type === "state");
  assert.deepEqual(undone.space.drawing.strokes.map(stroke => stroke.id),["first"]);
  await stop();
  await start();
  const back = await client();
  const reopened = await perform(back, {type:"join",room:initial.room,name:"Alex",ownerKey:initial.ownerKey}, event => event.type === "state");
  assert.equal(reopened.space.mode, "meet");
  assert.equal(reopened.space.notes[0].text, "Review Chapter 3");
  assert.equal(reopened.space.members.length, 1);
  assert.equal(reopened.space.members[0].owner, true);
  assert.equal(reopened.space.drawing.strokes[0].points.length,3);
  assert.equal(reopened.space.drawing.strokes[0].style,"calligraphy");
  const cleared = await perform(back,{type:"draw-clear",revision:0},event => event.type === "state" && event.space.drawing.revision === 1);
  assert.equal(cleared.space.drawing.strokes.length,0);
  back.send(JSON.stringify({...stroke,stroke:"stale"}));
  const stillEmpty = await perform(back,{type:"hand",value:true},event => event.type === "state");
  assert.equal(stillEmpty.space.ink.length,0);
  assert.equal(stillEmpty.space.drawing.strokes.length,0);
  console.log("PASS: four seats, controls, shared notes and handwriting, undo, clear, stale updates, return after restart");
} finally {
  await stop();
  await rm(directory, {recursive:true, force:true});
}
