import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const directory = await mkdtemp(join(tmpdir(), "bbtv-spaces-"));
const sockets = new Set();
let server;
const port = 3146;

async function start() {
  server = spawn(process.execPath, ["dist/server.cjs"], {
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), BBTV_DATABASE: join(directory, "spaces.sqlite"), BBTV_BACKUP_INTERVAL_MS:"1000" },
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
  let host = await client();
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
  const replacement=await client();
  await perform(replacement,{type:"join",room:initial.room,name:"Alex",ownerKey:initial.ownerKey,resumeKey:initial.resumeKey},event=>event.type==="joined");
  host=replacement;
  assert.match((await perform(guest.ws, {type:"mode",mode:"watch"}, event => event.type === "error")).message, /hosting/);
  await perform(host, {type:"mode",mode:"meet"}, event => event.type === "state" && event.space.mode === "meet");
  const written = receive(host, event => event.type === "state" && event.space.notes.length);
  guest.ws.send(JSON.stringify({type:"note",kind:"decision",text:"Review Chapter 3",pin:false}));
  const saved = (await written).space;
  assert.equal(saved.notes[0].author, "Sam");
  assert.equal(saved.members.filter(member=>member.owner).length,1);
  const stroke = {type:"draw",revision:0,stroke:"first",phase:"start",points:[[100,100]],color:"#243f34",width:6,style:"calligraphy"};
  const beginning = receive(host, event => event.type === "ink" && event.stroke.id === "first");
  guest.ws.send(JSON.stringify(stroke));
  assert.equal((await beginning).finished, false);
  await perform(guest.ws,{...stroke,phase:"move",points:[[150,180],[200,140]]}, event => event.type === "ink" && event.stroke.points.length === 2);
  const complete = receive(host, event => event.type === "ink" && event.finished);
  guest.ws.send(JSON.stringify({...stroke,phase:"end",points:[]}));
  assert.equal((await complete).stroke.points.length, 3);
  const boardFull = await perform(host,{type:"hand",value:true},event => event.type === "state" && event.space.drawing.strokes.length === 1);
  assert.equal(boardFull.space.drawing.strokes[0].author,boardFull.space.members.find(member => member.id === guest.joined.id).writer);
  host.send(JSON.stringify({type:"draw-undo"}));
  const untouched = await perform(host,{type:"hand",value:false},event => event.type === "state");
  assert.equal(untouched.space.drawing.strokes.length,1);
  assert.match((await perform(guest.ws,{type:"draw-clear",revision:0},event => event.type === "error")).message,/hosting/);
  assert.match((await perform(guest.ws,{...stroke,stroke:"bad",points:[[Infinity,2]]},event => event.type === "error")).message,/drawing/);
  await perform(host,{...stroke,stroke:"host-stroke"},event => event.type === "ink" && event.stroke.id === "host-stroke");
  await perform(host,{...stroke,stroke:"host-stroke",phase:"end",points:[[140,120]]},event => event.type === "ink" && event.finished && event.stroke.id === "host-stroke");
  const reconnected = await client();
  const resumedState = await perform(reconnected,{type:"join",room:initial.room,name:"Alex",ownerKey:initial.ownerKey,resumeKey:initial.resumeKey},event=>event.type==="state");
  assert.equal(resumedState.space.members.find(member=>member.owner).writer,boardFull.space.members.find(member=>member.owner).writer);
  host = reconnected;
  const undone = await perform(host,{type:"draw-undo"},event => event.type === "state");
  assert.deepEqual(undone.space.drawing.strokes.map(stroke => stroke.id),["first"]);
  await stop();
  const legacy = new DatabaseSync(join(directory,"spaces.sqlite"));
  const old = JSON.parse(legacy.prepare("SELECT document FROM rooms WHERE id = ?").get(initial.room).document);
  delete old.pages; delete old.page; delete old.version; delete old.updatedAt;
  legacy.prepare("UPDATE rooms SET document = ? WHERE id = ?").run(JSON.stringify(old),initial.room);
  legacy.close();
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
  assert.equal(stillEmpty.space.pages.length,1);
  const freshStroke={...stroke,revision:1,stroke:"redo-me",style:"marker"};
  await perform(back,freshStroke,event=>event.type==="ink"&&!event.finished);
  await perform(back,{...freshStroke,phase:"end",points:[[200,200]]},event=>event.type==="ink"&&event.finished);
  const undo=await perform(back,{type:"draw-undo"},event=>event.type==="state");
  assert.equal(undo.space.drawing.strokes.length,0);
  assert.ok(undo.space.redo.includes(reopened.space.members[0].writer));
  const redo=await perform(back,{type:"draw-redo"},event=>event.type==="state");
  assert.equal(redo.space.drawing.strokes[0].id,"redo-me");
  const second=await perform(back,{type:"page",action:"add"},event=>event.type==="state"&&event.space.pages.length===2);
  assert.equal(second.space.drawing.strokes.length,0);
  const first=await perform(back,{type:"page",action:"select",id:"first"},event=>event.type==="state"&&event.space.page==="first");
  assert.equal(first.space.drawing.strokes[0].id,"redo-me");
  await perform(back,{type:"question",id:"question-one",x:300,y:400,page:"first"},event=>event.type==="state"&&event.space.notes.some(note=>note.id==="question-one"));
  const history=await perform(back,{type:"history"},event=>event.type==="history");
  assert.equal(history.versions.length,3);
  const newer=await perform(back,{type:"draw-clear",revision:first.space.drawing.revision},event=>event.type==="state"&&!event.space.drawing.strokes.length);
  assert.equal(newer.space.drawing.strokes.length,0);
  const history2=await perform(back,{type:"history"},event=>event.type==="history");
  const restored=await perform(back,{type:"restore-version",version:history2.versions[0].version},event=>event.type==="state"&&event.space.drawing.strokes.length===1);
  assert.equal(restored.space.drawing.strokes[0].style,"marker");
  const backup={format:"bbtv-room",document:restored.space};
  assert.match((await perform(back,{type:"restore",backup:{...backup,document:{...restored.space,pages:[{id:"bad",title:"Bad",strokes:[{id:"x",color:"url(evil)",points:[]}]}]}}},event=>event.type==="error")).message,/backup/);
  const recovered=await perform(back,{type:"restore",backup},event=>event.type==="state");
  assert.equal(recovered.space.pages.length,2);
  const viewer=await client();
  await perform(viewer,{type:"join",room:initial.room,name:"Sam"},event=>event.type==="joined");
  assert.match((await perform(viewer,{type:"restore",backup},event=>event.type==="error")).message,/hosting/);
  const pointer=receive(viewer,event=>event.type==="pointer");
  back.send(JSON.stringify({type:"pointer",surface:"board",page:"first",x:350,y:250}));
  assert.equal((await pointer).pointer.x,350);
  const profile={skin:3,hair:1,background:2,glasses:true,expression:"smile"};
  const profiled=await perform(back,{type:"profile",avatar:profile},event=>event.type==="state");
  assert.deepEqual(profiled.space.members[0].avatar,profile);
  await perform(back,{type:"mode",mode:"family"},event=>event.type==="state"&&event.space.mode==="family");
  const reaction=receive(viewer,event=>event.type==="reaction");
  back.send(JSON.stringify({type:"reaction",expression:"laugh"}));
  assert.equal((await reaction).avatar.expression,"laugh");
  const summary=await fetch(`http://127.0.0.1:${port}/api/spaces/summary`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:[initial.room,"invalid"]})}).then(response=>response.json());
  assert.equal(summary.length,1);assert.equal(summary[0].people,2);assert.equal(summary[0].questions,1);assert.equal(summary[0].firstQuestion,"Explain this part of Page 1");
  let files=[];
  for(let attempt=0;attempt<25;attempt++){
    try {files=await readdir(join(directory,"backups"));} catch {}
    if(files.some(file=>file.endsWith(".sqlite")))break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  const archive=files.find(file=>file.endsWith(".sqlite"));
  assert.ok(archive,"A database backup should be written");
  const archived=new DatabaseSync(join(directory,"backups",archive));
  assert.equal(archived.prepare("PRAGMA integrity_check").get().integrity_check,"ok");archived.close();
  console.log("PASS: calls, legacy migration, pages, undo/redo, saving, backup/restore, pointers, profiles, reactions, room presence, and database backup integrity");
} finally {
  await stop();
  await rm(directory, {recursive:true, force:true});
}
