import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import type { Express } from "express";
import { WebSocket, WebSocketServer } from "ws";
import { changeWatch, newWatchState, watchPosition } from "../shared/watch";
import { capacity, inkColors, modes, roomReactions, type Chat, type InkPoint, type InkStroke, type Member, type Note, type RoomDocument, type RoomEvent, type RoomRequest, type Space } from "./protocol";
import { defaultAvatar, migrateDocument, restoreContent, validAvatar, validBackup } from "./documents";

type Saved = RoomDocument;
type Live = { space: Saved; clients: Map<WebSocket, Member>; presenter: string; chat: Chat[]; ink: Map<string, InkStroke>; redo: Map<string,{page:string;strokes:InkStroke[]}>; sessions:Map<string,string> };
const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const code = /^[a-f0-9]{24}$/;
const trim = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";

export function roomSockets(app?: Express) {
  const filename = process.env.BBTV_DATABASE || "./data/spaces.sqlite";
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, owner TEXT NOT NULL, document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS room_backups (room TEXT NOT NULL, version INTEGER NOT NULL, at INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(room, version))");
  const load = db.prepare("SELECT owner, document FROM rooms WHERE id = ?");
  const create = db.prepare("INSERT INTO rooms (id, owner, document) VALUES (?, ?, ?)");
  const write = db.prepare("UPDATE rooms SET document = ? WHERE id = ?");
  const keepVersion = db.prepare("INSERT OR REPLACE INTO room_backups(room,version,at,document) VALUES (?,?,?,?)");
  const trimVersions = db.prepare("DELETE FROM room_backups WHERE room = ? AND version NOT IN (SELECT version FROM room_backups WHERE room = ? ORDER BY version DESC LIMIT 3)");
  const versions = db.prepare("SELECT version, at FROM room_backups WHERE room = ? ORDER BY version DESC");
  const oldVersion = db.prepare("SELECT document FROM room_backups WHERE room = ? AND version = ?");
  const live = new Map<string, Live>();
  const server = new WebSocketServer({ noServer: true, maxPayload: 1_500_000 });
  let backingUp = false;
  let closing = false;
  async function backupDatabase() {
    if (filename === ":memory:" || backingUp || !db.isOpen) return;
    backingUp = true;
    const folder = join(dirname(filename),"backups");
    const name = "spaces-" + new Date().toISOString().slice(0,10) + ".sqlite";
    try {
      mkdirSync(folder,{recursive:true});
      await backup(db,join(folder,name+".tmp"));
      renameSync(join(folder,name+".tmp"),join(folder,name));
      for (const old of readdirSync(folder).filter(file => /^spaces-\d{4}-\d{2}-\d{2}\.sqlite$/.test(file)).sort().slice(0,-7)) rmSync(join(folder,old));
    } catch (error) { console.error("Room database backup failed",error); }
    finally { backingUp = false; if(closing&&db.isOpen)db.close(); }
  }
  const backupTimer = setInterval(() => void backupDatabase(),Math.max(1000,Number(process.env.BBTV_BACKUP_INTERVAL_MS)||15*60_000));
  backupTimer.unref();
  app?.post("/api/spaces/summary",(request,response) => {
    const ids:string[] = Array.isArray(request.body?.ids) ? [...new Set<string>(request.body.ids.filter((id:unknown):id is string => typeof id === "string" && code.test(id)))].slice(0,6) : [];
    response.set("Cache-Control","no-store").json(ids.map(id => {
      const record = load.get(id) as {document:string}|undefined;
      if (!record) return {id,exists:false,people:0};
      const document = live.get(id)?.space || migrateDocument(JSON.parse(record.document));
      const unresolved = document.notes.filter(note => note.kind === "question" && !note.done);
      return {id,exists:true,name:document.name,mode:document.mode,people:live.get(id)?.clients.size||0,updatedAt:document.updatedAt,questions:unresolved.length,firstQuestion:unresolved[0]?.text};
    }));
  });
  const iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  if (process.env.BBTV_TURN_URL && process.env.BBTV_TURN_USER && process.env.BBTV_TURN_PASSWORD) {
    iceServers.push({ urls: process.env.BBTV_TURN_URL, username: process.env.BBTV_TURN_USER, credential: process.env.BBTV_TURN_PASSWORD });
  }
  function send(ws: WebSocket, event: RoomEvent) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 4_000_000) { ws.terminate(); return; }
    ws.send(JSON.stringify(event));
  }
  function host(room: Live) {
    const members = [...room.clients.values()];
    return (members.find(m => m.owner) || members[0])?.id ?? "";
  }
  function broadcast(room: Live) {
    const event: RoomEvent = {
      type: "state", now: Date.now(),
      space: { ...room.space, members: [...room.clients.values()], host: host(room), presenter: room.presenter, chat: room.chat, ink: [...room.ink.values()], redo:[...room.redo].filter(([,value])=>value.page===room.space.page&&value.strokes.length).map(([id])=>id) },
    };
    room.clients.forEach((_, ws) => send(ws, event));
  }
  function save(room: Live, next: Saved) {
    next = {...next,version:room.space.version+1,updatedAt:Date.now(),pages:next.pages.map(page=>page.id===next.page?{...page,strokes:next.drawing.strokes}:page)};
    const watch = next.watch;
    const stable = { ...next, watch: { ...watch, position: watchPosition(watch, Date.now()), playing: false, ready: [], breakUntil: undefined } };
    db.exec("BEGIN IMMEDIATE");
    try {
      const previous = load.get(next.id) as {document:string};
      keepVersion.run(next.id,room.space.version,room.space.updatedAt,previous.document);
      trimVersions.run(next.id,next.id);
      write.run(JSON.stringify(stable), next.id);
      db.exec("COMMIT");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    room.space = next;
  }
  function publishInk(room: Live, stroke: InkStroke, finished: boolean) {
    const event: RoomEvent = { type: "ink", revision: room.space.drawing.revision, stroke, finished,version:room.space.version,updatedAt:room.space.updatedAt };
    room.clients.forEach((_, ws) => send(ws, event));
  }
  function finishInk(room: Live, actor: string) {
    const stroke = room.ink.get(actor);
    if (!stroke) return;
    save(room, { ...room.space, drawing: { ...room.space.drawing, strokes: [...room.space.drawing.strokes, stroke] } });
    room.ink.delete(actor);
    room.redo.delete(stroke.author);
    publishInk(room, stroke, true);
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
  server.on("close", () => { closing=true;clearInterval(heartbeat); clearInterval(backupTimer); if (!backingUp) db.close(); });

  server.on("connection", (ws, request) => {
    let room: Live | undefined;
    let actor: Member | undefined;
    let messages = 0;
    let reactedAt = 0;
    let pointedAt = 0;
    let windowEnds = Date.now() + 1000;
    ws.on("pong", () => pinged.delete(ws));
    ws.on("error", () => ws.terminate());
    ws.on("close", () => {
      if (!room || !actor || !room.clients.has(ws)) return;
      room.clients.delete(ws);
      if (room.presenter === actor.id) room.presenter = "";
      try { finishInk(room, actor.id); resetPlayback(room); } catch (error) { room.ink.delete(actor.id); console.error("Failed to save paused room", error); }
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
        if(room&&actor&&!room.clients.has(ws))return;
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
            if (action.restore && !validBackup(action.restore)) throw new Error("Choose a valid BBTV. room backup.");
            const restore = action.restore ? restoreContent(action.restore) : undefined;
            const space: Saved = { id, name: title, mode: action.mode, notes: restore?.notes || [], watch: newWatchState(true),
              drawing: {revision:0,strokes:restore?.pages.find(page=>page.id===restore.page)?.strokes||[]},
              page:restore?.page||"first",pages:restore?.pages||[{id:"first",title:"Page 1",strokes:[]}],version:0,updatedAt:now };
            create.run(id, hash(ownerKey), JSON.stringify(space));
          } else {
            id = trim(action.room, 30).toLowerCase();
            if (!code.test(id)) throw new Error("Use a BBTV Spaces invite link.");
          }
          const stored = load.get(id) as { owner: string; document: string } | undefined;
          if (!stored) throw new Error("That room couldn’t be found. Check the invite link.");
          const saved = migrateDocument(JSON.parse(stored.document) as Saved);
          const target: Live = live.get(id) || { space: saved, clients: new Map(), presenter: "", chat: [], ink: new Map(), redo:new Map(),sessions:new Map() };
          const resumeKey=action.type==="join"&&typeof action.resumeKey==="string"&&/^[a-f0-9]{48}$/.test(action.resumeKey)?action.resumeKey:randomBytes(24).toString("hex");
          const resumed=target.sessions.get(hash(resumeKey));
          if(resumed)for(const [previous,member] of target.clients)if(member.id===resumed){
            finishInk(target,member.id);target.clients.delete(previous);
            if(target.presenter===member.id)target.presenter="";
            previous.close(4001,"Session reconnected");
          }
          if (target.clients.size >= capacity) throw new Error("All four seats are taken. Try again when someone leaves.");
          const candidate = ownerKey || (action.type === "join" ? trim(action.ownerKey, 52) : "");
          const owner = !!candidate && hash(candidate) === stored.owner && ![...target.clients.values()].some(member => member.owner);
          resetPlayback(target);
          room = target;
          const writer = hash("writer:" + id + ":" + resumeKey);
          actor = { id: randomUUID(), writer, name, owner, hand: false, audio: false, video: false,avatar:validAvatar(action.avatar)?action.avatar:undefined };
          room.clients.set(ws, actor);
          room.sessions.set(hash(resumeKey),actor.id);
          const activeIds=new Set([...room.clients.values()].map(member=>member.id));
          while(room.sessions.size>32){
            const expired=[...room.sessions].find(([,member])=>!activeIds.has(member));
            if(!expired)break;
            room.sessions.delete(expired[0]);
          }
          live.set(id, room);
          send(ws, { type: "joined", id: actor.id, room: id, ownerKey, iceServers, persistent: !!process.env.BBTV_DATABASE && filename !== ":memory:",resumeKey });
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
            for (const author of room.ink.keys()) finishInk(room, author);
            save(room, { ...room.space, mode: action.mode, watch: { ...current.watch, position: watchPosition(current.watch, now), playing: false, ready: [], revision: current.watch.revision + 1 } });
            break;
          case "draw": {
            if (action.revision !== current.drawing.revision) return;
            if (!["study", "meet"].includes(current.mode)) return;
            if (typeof action.stroke !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(action.stroke)) return;
            if (!["start", "move", "end"].includes(action.phase)) return;
            if (!Array.isArray(action.points) || action.points.length > 64 || action.points.some(p =>
              !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || p[0] < 0 || p[0] > 1600 || p[1] < 0 || p[1] > 1000
            )) throw new Error("That drawing update couldn’t be used.");
            const points: InkPoint[] = action.points.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
            const drafts = [...room.ink.values()];
            if (action.phase === "start") {
              if (room.ink.has(actor.id) || current.drawing.strokes.some(s => s.id === action.stroke) || drafts.some(s => s.id === action.stroke)) return;
              if (current.drawing.strokes.length + drafts.length >= 300) throw new Error("This board is full. Undo a stroke or ask the host to clear it.");
              if (!points.length || !inkColors.includes(action.color as typeof inkColors[number]) || ![3, 6, 12, 32].includes(action.width!)) return;
              if (action.style && !["pen", "marker", "calligraphy"].includes(action.style)) return;
            }
            const previous = room.ink.get(actor.id);
            if (action.phase !== "start" && previous?.id !== action.stroke) return;
            const used = [...current.pages.flatMap(page=>page.id===current.page?current.drawing.strokes:page.strokes), ...drafts].reduce((total, stroke) => total + stroke.points.length, 0);
            if (used + points.length > 40_000 || (previous?.points.length || 0) + points.length > 1024) {
              finishInk(room, actor.id);
              throw new Error("That stroke reached the board limit. Lift the pen, then continue or clear the board.");
            }
            const stroke: InkStroke = action.phase === "start"
              ? { id: action.stroke, author: actor.writer, color: action.color!, width: action.width!, points, style: action.style || "pen" }
              : { ...previous!, points: [...previous!.points, ...points] };
            room.ink.set(actor.id, stroke);
            if (action.phase === "end") finishInk(room, actor.id);
            else publishInk(room, { ...stroke, points }, false);
            return;
          }
          case "draw-undo": {
            const index = current.drawing.strokes.map(stroke => stroke.author).lastIndexOf(actor.writer);
            if (index < 0) return;
            const previous = room.redo.get(actor.writer);
            save(room, { ...current, drawing: { ...current.drawing, strokes: current.drawing.strokes.filter((_, i) => i !== index) } });
            room.redo.set(actor.writer,{page:current.page,strokes:[...(previous?.page===current.page?previous.strokes:[]),current.drawing.strokes[index]]});
            break;
          }
          case "draw-redo": {
            const redo = room.redo.get(actor.writer);
            if (!redo || redo.page !== current.page || !redo.strokes.length || current.drawing.strokes.length >= 300) return;
            const stroke = redo.strokes.at(-1)!;
            const count = current.pages.flatMap(page=>page.strokes).reduce((total,item)=>total+item.points.length,0);
            if (count + stroke.points.length > 40_000) throw new Error("This room’s board is full.");
            save(room,{...current,drawing:{...current.drawing,strokes:[...current.drawing.strokes,stroke]}});
            redo.strokes.pop();
            break;
          }
          case "draw-clear":
            requireHost();
            if (action.revision !== current.drawing.revision) return;
            save(room, { ...current, drawing: { revision: current.drawing.revision + 1, strokes: [] } });
            room.ink.clear();
            room.redo.clear();
            break;
          case "page": {
            if (!["study","meet"].includes(current.mode)) return;
            for (const author of room.ink.keys()) finishInk(room,author);
            const latest = room.space;
            let pages = latest.pages;
            let page = pages.find(page=>page.id===action.id);
            if (action.action === "add") {
              if (pages.length >= 6) throw new Error("A room can have up to six whiteboard pages.");
              page = {id:randomUUID(),title:"Page "+(pages.length+1),strokes:[]};
              pages = [...pages,page];
            } else if (action.action !== "select" || !page) return;
            save(room,{...latest,pages,page:page.id,drawing:{revision:latest.drawing.revision+1,strokes:page.strokes}});
            break;
          }
          case "question": {
            if (current.notes.some(note=>note.id===action.id) || current.notes.length>=100 || current.page!==action.page ||
              typeof action.id!=="string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(action.id) || !Number.isFinite(action.x)||!Number.isFinite(action.y)||
              action.x<0||action.x>1600||action.y<0||action.y>1000) return;
            save(room,{...current,notes:[...current.notes,{id:action.id,kind:"question",author:actor.name,done:false,
              text:"Explain this part of "+current.pages.find(page=>page.id===current.page)!.title,x:action.x,y:action.y,page:current.page}]});
            break;
          }
          case "history":
            requireHost();
            send(ws,{type:"history",versions:versions.all(current.id) as {version:number;at:number}[]});
            return;
          case "restore-version":
          case "restore": {
            requireHost();
            const previous = action.type==="restore-version" ? oldVersion.get(current.id,action.version) as {document:string}|undefined : undefined;
            const restored = action.type==="restore" ? action.backup : previous ? {format:"bbtv-room",document:migrateDocument(JSON.parse(previous.document))} : null;
            if (!validBackup(restored)) throw new Error("That room backup couldn’t be restored.");
            const doc = restoreContent(restored);
            save(room,{...current,notes:doc.notes,pages:doc.pages,page:doc.page,drawing:{revision:current.drawing.revision+1,strokes:doc.pages.find(page=>page.id===doc.page)!.strokes}});
            room.ink.clear(); room.redo.clear();
            break;
          }
          case "profile":
            if (!validAvatar(action.avatar)) return;
            actor.avatar = action.avatar;
            break;
          case "pointer": {
            if (now-pointedAt<45 || !Number.isFinite(action.x)||!Number.isFinite(action.y)||action.x<0||action.x>1600||action.y<0||action.y>1000||
              !["board","screen"].includes(action.surface) || (action.surface==="board" && action.page!==current.page) ||
              (action.surface==="screen" && actor.id!==room.presenter&&!isHost)) return;
            pointedAt = now;
            const event:RoomEvent = {type:"pointer",pointer:{id:actor.id,name:actor.name,x:action.x,y:action.y,surface:action.surface,page:current.page}};
            room.clients.forEach((_,viewer)=>send(viewer,event)); return;
          }
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
          case "reaction": {
            if (current.mode !== "family" || (action.expression ? !["smile","laugh","wow","calm"].includes(action.expression) : !roomReactions.includes(action.emoji!)) || now - reactedAt < 650) return;
            reactedAt = now;
            const reaction: RoomEvent = { type: "reaction", id: randomUUID(), emoji: action.expression ? "" : action.emoji!, name: actor.name,
              avatar:action.expression?{...(actor.avatar||defaultAvatar),expression:action.expression}:undefined };
            room.clients.forEach((_, viewer) => send(viewer, reaction));
            return;
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
        if (room && actionType === "draw") broadcast(room);
      }
    });
  });
  return server;
}
