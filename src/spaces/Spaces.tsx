import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, PointerEvent } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, CircleHelp, Clapperboard, Copy, DoorOpen, Hand, Heart, LayoutGrid, Mic, MicOff, Monitor, Plus, Send, Video, VideoOff, StickyNote, X } from "lucide-react";
import { capacity, modes, roomReactions, type Member, type Mode, type NoteKind, type RoomDocument } from "./protocol";
import { readLocal, useRoom, writeLocal } from "./useRoom";
import { Screen, stamp } from "./Screen";
import { Whiteboard } from "./Whiteboard";
import { RoomPeople } from "./RoomPeople";
import { Avatar, AvatarEditor } from "./Avatar";
import { defaultAvatar } from "./documents";
import { DevicePreview } from "./DevicePreview";
import { RoomCard, type RoomSummary } from "./RoomCard";
import { BackupPanel } from "./BackupPanel";
import "./spaces.css";
import "./rooms.css";
import "./daily.css";

const activities = {
  study: { title: "Study", detail: "Work through questions together", icon: BookOpen, board: "Study board", description: "Save questions and explanations for your next session." },
  meet: { title: "Meet", detail: "Talk, present, and record decisions", icon: LayoutGrid, board: "Meeting notes", description: "Keep decisions and follow-ups where the team can find them." },
  family: { title: "Family", detail: "Make time for the people you miss", icon: Heart, board: "Room notes", description: "Leave a note or a plan for the next catch-up." },
  watch: { title: "Watch", detail: "Press play on the same screen", icon: Clapperboard, board: "Shared moments", description: "Pin scenes while you watch and jump back to them together." },
};
type SavedRoom = { id: string; name: string; mode: Mode };
const savedRooms = (): SavedRoom[] => {
  try { const rooms = JSON.parse(readLocal("bbtv.spaces")); return Array.isArray(rooms) ? rooms : []; } catch { return []; }
};
const getInvite = () => new URLSearchParams(location.search).get("space") || "";

function trackPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse" || !matchMedia("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)").matches) return;
  const target = event.currentTarget;
  const bounds = target.getBoundingClientRect();
  target.style.setProperty("--pointer-x", ((event.clientX - bounds.left) / bounds.width).toFixed(3));
  target.style.setProperty("--pointer-y", ((event.clientY - bounds.top) / bounds.height).toFixed(3));
}

function resetPointer(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty("--pointer-x");
  event.currentTarget.style.removeProperty("--pointer-y");
}

function Player({ stream, muted = false, label, audioOnly = false }: {
  stream?: MediaStream; muted?: boolean; label?: string; audioOnly?: boolean;
}) {
  const element = useRef<HTMLMediaElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const target = element.current;
    if (!target || !stream) return;
    let active = true;
    target.srcObject = stream;
    void target.play().then(() => { if (active) setBlocked(false); }).catch(() => { if (active && !muted) setBlocked(true); });
    return () => { active = false; target.srcObject = null; };
  }, [stream, muted, audioOnly]);
  return <>
    {audioOnly ? <audio ref={node => { element.current = node; }} autoPlay/> : <video ref={node => { element.current = node; }} autoPlay muted={muted} playsInline aria-label={label}/>}
    {blocked && stream && <button className="space-button resume-audio" onClick={() => { void element.current?.play().then(() => setBlocked(false)).catch(() => {}); }}>Enable room audio</button>}
  </>;
}

function Tile({ member, stream, own, focused, onFocus }: { member: Member; stream?: MediaStream; own: boolean; focused?:boolean; onFocus?:()=>void }) {
  return <div className={`space-tile ${member.hand ? "hand-raised" : ""} ${member.video && stream ? "tile-live" : ""} ${focused?"tile-focused":""}`}>
    <div className="space-avatar" aria-hidden="true">{member.avatar?<Avatar profile={member.avatar}/>:member.name.slice(0,1).toUpperCase()}</div>
    {(member.video || member.audio) && stream && <Player stream={stream} muted={own} audioOnly={!member.video} label={`${member.name} camera`}/>}
    <div className="tile-caption"><span>{member.name}{own && <small> · You</small>}</span>{member.hand ? <Hand size={16} aria-label="Hand raised"/> : member.audio ? <Mic size={15} aria-label="Mic on"/> : <MicOff size={15} aria-label="Mic off"/>}</div>
    {onFocus&&<button className="tile-focus" aria-label={`Focus on ${member.name}`} aria-pressed={!!focused} onClick={onFocus}>{focused?"Unpin":"Focus"}</button>}
  </div>;
}

export default function Spaces() {
  const r = useRoom();
  const [invite, setInvite] = useState(getInvite);
  const [name, setName] = useState(() => readLocal("bbtv.name"));
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("study");
  const [joinURL, setJoinURL] = useState("");
  const [saved, setSaved] = useState(savedRooms);
  const [panel, setPanel] = useState<"board" | "chat">("board");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<NoteKind>("note");
  const [chat, setChat] = useState("");
  const [copy, setCopy] = useState(false);
  const [focus, setFocus] = useState(false);
  const [showDrawing, setShowDrawing] = useState(true);
  const [checkDevices,setCheckDevices]=useState(false);
  const [summaries,setSummaries]=useState<RoomSummary[]>([]);
  const [pinned,setPinned]=useState("");
  const [screenPointer,setScreenPointer]=useState(false);
  const pointerTime=useRef(0);
  const avatarDialog=useRef<HTMLDialogElement>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const ownStream = useMemo(() => r.local.camera ? new MediaStream([r.local.camera]) : undefined, [r.local.camera]);
  const ownScreen = useMemo(() => r.local.screen ? new MediaStream([r.local.screen]) : undefined, [r.local.screen]);
  const space = r.space;
  const own = space?.members.find(m => m.id === r.id);
  const host = space?.host === r.id;
  const current = activities[space?.mode ?? mode];
  const inviteURL = space ? `${location.origin}/spaces?space=${space.id}` : "";
  const presenter = space?.members.find(m => m.id === space.presenter);
  const canDraw = space?.mode === "study" || space?.mode === "meet";
  const drawingVisible = canDraw && showDrawing && !presenter;
  useEffect(() => {
    if (!space) return;
    const recent = [{ id: space.id, name: space.name, mode: space.mode }, ...savedRooms().filter(room => room.id !== space.id)].slice(0, 6);
    writeLocal("bbtv.spaces", JSON.stringify(recent));
    setSaved(recent);
  }, [space?.id, space?.mode, space?.name]);
  useEffect(()=>{
    if(space||!saved.length)return;
    let active=true;
    const controller=new AbortController();
    async function refresh() {
      try {
        const response=await fetch("/api/spaces/summary",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ids:saved.map(room=>room.id)}),signal:controller.signal,cache:"no-store"});
        if(response.ok&&active)setSummaries(await response.json());
      } catch {}
    }
    void refresh();const timer=setInterval(()=>void refresh(),12000);
    return ()=>{active=false;controller.abort();clearInterval(timer);};
  },[saved,!!space]);
  useEffect(() => { if (panel === "chat") chatEnd.current?.parentElement?.scrollTo({ top: chatEnd.current.parentElement.scrollHeight }); }, [space?.chat.length, panel]);
  useEffect(() => { setPanel(space?.mode === "family" ? "chat" : "board"); setShowDrawing(true); }, [space?.mode]);

  function pickInvite(value: string) {
    const text = value.trim();
    if (/^[a-f0-9]{24}$/i.test(text)) return text.toLowerCase();
    try {
      const url = new URL(text, location.origin);
      const candidate = url.searchParams.get("space") || "";
      if (url.origin === location.origin && /^[a-f0-9]{24}$/i.test(candidate)) return candidate.toLowerCase();
    } catch { /* report through the form */ }
    return "";
  }
  function openSaved(id: string) {
    if (name.trim()) r.begin({ type: "join", room: id, name, ownerKey: readLocal("bbtv.owner." + id) });
    else { setInvite(id); document.getElementById("space-name")?.focus(); }
  }
  function restoreCopy(snapshot:RoomDocument) {
    if(!name.trim()){r.setError("Add your name before restoring a room.");document.getElementById("space-name")?.focus();return;}
    r.begin({type:"create",title:snapshot.name,name,mode:snapshot.mode,restore:{format:"bbtv-room",document:snapshot}});
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (invite) {
      r.begin({ type: "join", room: invite, name, ownerKey: readLocal("bbtv.owner." + invite) });
    } else {
      r.begin({ type: "create", title, name, mode });
    }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteURL); setCopy(true); }
    catch { setCopy(false); shareDialog.current?.querySelector("input")?.select(); }
  }
  function leave() {
    shareDialog.current?.close();
    history.replaceState({}, "", "/spaces");
    setInvite(""); setPanel("board"); setFocus(false); setNote(""); setChat("");
    r.leave();
  }

  if (!space) return <div className="spaces-home">
    <header className="spaces-nav">
      <a href="/spaces" className="spaces-brand" aria-label="BBTV Spaces home">BBTV<i>.</i></a>
      <a href="/classic" className="spaces-classic">Classic watch party <ArrowDownRight size={15}/></a>
    </header>
    <main className="spaces-home-main">
      <section className="spaces-hero" onPointerMove={trackPointer} onPointerLeave={resetPointer}>
        <div className="spaces-hero-photo" aria-hidden="true"><img src="/spaces-lounge.webp" width={1320} height={880} alt="" fetchPriority="high"/></div>
        <div className="spaces-hero-copy">
          <span className="spaces-overline">BBTV SPACES</span>
          <h1 key={invite ? "invite" : "home"} aria-label={invite ? "You have a seat." : "A place to show up."}>
            <span className="hero-line"><span>{invite ? "You have" : "A place to"}</span></span>
            <span className="hero-line hero-line-serif"><em>{invite ? "a seat." : "show up."}</em></span>
          </h1>
          <p>{invite ? "Join with your name. Your camera and mic start off." : "One room for your group, from the first conversation to whatever you do together next."}</p>
          <a href="#space-setup" className="spaces-hero-action">{invite ? "Join the room" : "Open a room"} <ArrowRight size={18}/></a>
        </div>
      </section>
      <section className="spaces-booking" id="space-setup" tabIndex={-1}>
        <div className="spaces-activities">
          <h2>{invite ? "Your invitation" : "What are you here to do?"}</h2>
          {invite ? <p>Use the same invitation next time to return to this room and its saved notes.</p> : <div className="activity-grid" role="group" aria-label="Room activity">
            {modes.map(key => { const activity = activities[key]; const Icon = activity.icon; return <button key={key} aria-pressed={mode === key} onPointerMove={trackPointer} onPointerLeave={resetPointer} onClick={() => setMode(key)}>
              <span className="activity-icon"><Icon size={19}/></span><span><strong>{activity.title}</strong><small>{activity.detail}</small></span>
            </button>; })}
          </div>}
        </div>
        <form className="space-entry" onSubmit={submit}>
          <label htmlFor="space-name">Your name</label><input id="space-name" required value={name} onChange={event => setName(event.target.value)} maxLength={32} placeholder="e.g. Alex" autoComplete="given-name"/>
          {!invite && <><label htmlFor="space-title">Room name</label><input id="space-title" required value={title} onChange={event => setTitle(event.target.value)} maxLength={64} placeholder="e.g. Friday study group"/></>}
          <button type="button" className="space-text-button device-check-action" onClick={()=>setCheckDevices(true)}><Video size={15}/> Check camera & microphone</button>
          <button className="space-button solid" disabled={r.joining || !name.trim() || (!invite && !title.trim())}>{r.joining ? "Opening…" : invite ? "Join room" : "Create room"}<ArrowRight size={17}/></button>
          {r.error && <p role="alert" className="space-error">{r.error}</p>}
          {invite && <button type="button" className="space-text-button" onClick={() => { setInvite(""); r.leave(); history.replaceState({}, "", "/spaces"); }}>Create your own room instead</button>}
        </form>
      </section>
      <div className="spaces-return">
        <div><h2>Return to a room</h2>{saved.length === 0 && <p>Rooms you open on this device appear here.</p>}{saved.length > 0 && <ul className="recent-rooms">{saved.map(room => <RoomCard key={room.id} room={room} summary={summaries.find(summary=>summary.id===room.id)} disabled={r.joining} onOpen={openSaved} onRestore={restoreCopy}/>)}</ul>}</div>
        <form onSubmit={event => { event.preventDefault(); const id = pickInvite(joinURL); if (id) { r.setError(""); setInvite(id); document.getElementById("space-name")?.focus(); } else r.setError("Paste an invitation link from this BBTV site."); }}>
          <label htmlFor="space-invite-url">Have an invite link?</label>
          <div><input id="space-invite-url" value={joinURL} onChange={event => setJoinURL(event.target.value)} required placeholder="Paste the room link"/><button className="space-button" aria-label="Use invite"><ArrowRight size={18}/></button></div>
        </form>
      </div>
    </main>
    {checkDevices&&<DevicePreview onClose={()=>setCheckDevices(false)}/>}
  </div>;

  return <div className={`spaces-live activity-${space.mode}${focus ? " focus-stage" : ""}`}>
    <header className="room-nav">
      <button className="space-icon" onClick={leave} aria-label="Back to rooms"><ArrowLeft size={20}/></button>
      <div><strong>{space.name}</strong><span><i className={r.online ? "online" : ""}/>{r.online ? `${space.members.length} of ${capacity} seats` : "Reconnecting…"}</span></div>
      <span className="room-mode-label">{space.mode === "study" ? <BookOpen size={14}/> : space.mode === "family" ? <Heart size={14}/> : space.mode === "meet" ? <LayoutGrid size={14}/> : <Clapperboard size={14}/>} {current.title}</span>
      <button className="space-button invite-action" onClick={() => { setCopy(false); shareDialog.current?.showModal(); }}><Copy size={15}/> Invite</button>
      {!r.online&&<button className="space-button solid reconnect-action" onClick={r.reconnect}>Reconnect</button>}
    </header>
    <main className="room-workspace">
      <div className="room-main">
        <div className="stage-heading">
          <div><span className="spaces-overline">{space.mode === "study" ? "A LITTLE SPACE TO LEARN" : space.mode === "meet" ? "ROOM TO THINK TOGETHER" : space.mode === "family" ? "YOUR PEOPLE, ONE PLACE" : "CURRENT ACTIVITY"}</span>
            <h1 key={presenter ? "presentation" : space.mode}>{presenter ? "Presentation" : space.mode === "family" ? "Family lounge" : space.mode === "meet" ? "Meeting room" : current.title}</h1></div>
          <label className="activity-picker"><span>Activity</span>
            <select aria-label="Room activity" value={space.mode} disabled={!host || !r.online} onChange={event => r.send({ type: "mode", mode: event.target.value as Mode })}>
              {modes.map(key => <option key={key} value={key}>{activities[key].title}</option>)}
            </select>
          </label>
        </div>
        {canDraw && !presenter && <div className="whiteboard-switch" role="group" aria-label="Room stage">
          <button aria-pressed={showDrawing} onClick={() => setShowDrawing(true)}>Whiteboard</button>
          <button aria-pressed={!showDrawing} onClick={() => setShowDrawing(false)}>{space.mode === "meet" ? "Discussion" : "Cameras"}</button>
        </div>}
        <div className="media-stage">
          {drawingVisible && <Whiteboard drawing={space.drawing} ink={space.ink} writer={own?.writer || r.id} host={host} online={r.online} error={r.error} send={r.send}
            pages={space.pages} page={space.page} redo={space.redo.includes(own?.writer || r.id)} saving={r.saving} pointers={r.pointers} notes={space.notes}/>}
          {presenter && <div className="room-presentation" onPointerMove={event=>{
            if(!screenPointer||!r.online||(!host&&presenter.id!==r.id)||Date.now()-pointerTime.current<65)return;
            pointerTime.current=Date.now();const bounds=event.currentTarget.getBoundingClientRect();
            r.send({type:"pointer",surface:"screen",page:space.page,x:Math.max(0,Math.min(1600,(event.clientX-bounds.left)/bounds.width*1600)),y:Math.max(0,Math.min(1000,(event.clientY-bounds.top)/bounds.height*1000))});
          }}>
            <Player stream={presenter.id === r.id ? ownScreen : r.remote[presenter.id]?.screen} muted label={`Screen shared by ${presenter.name}`}/>
            <span>{presenter.name} is sharing</span>
            <svg className="presentation-pointers" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
              {r.pointers.filter(pointer=>pointer.surface==="screen").map(pointer=><g key={pointer.id} transform={`translate(${pointer.x} ${pointer.y})`}><circle r="13" fill="#efb267"/><text x="20" y="-12" fill="#fff3dd" fontSize="24">{pointer.name}</text></g>)}
            </svg>
          </div>}
          {presenter&&<div className="presentation-tools">
            <button className="space-button" aria-pressed={focus} onClick={()=>setFocus(!focus)}>Focus presentation</button>
            {(host||presenter.id===r.id)&&<button className="space-button" aria-label="Shared presentation pointer" aria-pressed={screenPointer} onClick={()=>setScreenPointer(!screenPointer)}>Shared pointer</button>}
          </div>}
          {!presenter && space.mode === "watch" && <Screen watch={space.watch} id={r.id} host={space.host} count={space.members.length} offset={r.offset} online={r.online} act={action => r.send({ type: "watch", action })}/>}
          <div className={`space-seats ${presenter || space.mode === "watch" || drawingVisible ? "seat-strip" : ""}`} aria-label="People in the room">
            {space.members.map(member => <Tile key={member.id} member={member} own={member.id === r.id} stream={member.id === r.id ? ownStream : r.remote[member.id]?.call}
              focused={pinned===member.id} onFocus={space.mode==="meet"?()=>setPinned(pinned===member.id?"":member.id):undefined}/>)}
            {space.members.length < capacity && !(presenter || space.mode === "watch" || drawingVisible) && <button className="space-tile empty-seat" onClick={() => { setCopy(false); shareDialog.current?.showModal(); }}><Plus size={23}/> Invite to an open seat</button>}
          </div>
          {space.mode === "family" && <div className="family-reaction-stream" aria-live="polite">
            {r.reactions.map(reaction => <div className="family-reaction" key={reaction.id}>{reaction.avatar?<Avatar profile={reaction.avatar}/>:<span aria-hidden="true">{reaction.emoji}</span>}<small>{reaction.name} sent {reaction.avatar?"an avatar reaction":reaction.emoji}</small></div>)}
          </div>}
        </div>
        {space.mode === "family" && <div className="family-social">
          <div className="family-reactions" role="group" aria-label="Family reactions">
            {roomReactions.map(emoji => <button key={emoji} aria-label={`Send ${emoji} reaction`} disabled={!r.online} onClick={() => r.send({type:"reaction",emoji})}>{emoji}</button>)}
          </div>
          <div className="personal-reactions" role="group" aria-label="Personal avatar reactions">
            {(["smile","laugh","wow"] as const).map(expression=><button key={expression} aria-label={"Send my "+expression} disabled={!r.online} onClick={()=>r.send({type:"reaction",expression})}><Avatar profile={{...(own?.avatar||defaultAvatar),expression}}/></button>)}
            <button className="space-text-button" onClick={()=>avatarDialog.current?.showModal()}>My avatar</button>
          </div>
          {host && <button className="space-button" disabled={!r.online} onClick={() => r.send({type:"mode",mode:"watch"})}><Clapperboard size={16}/> Movie night</button>}
        </div>}
        <nav className="space-dock" aria-label="Call controls">
          <button className="space-button" aria-pressed={!!r.local.audio} disabled={!r.online} onClick={() => void r.toggle("audio")}>{r.local.audio ? <Mic size={17}/> : <MicOff size={17}/>}<span>Mic</span></button>
          <button className="space-button" aria-pressed={!!r.local.camera} disabled={!r.online} onClick={() => void r.toggle("camera")}>{r.local.camera ? <Video size={17}/> : <VideoOff size={17}/>}<span>Camera</span></button>
          <button className="space-button" aria-pressed={!!r.local.screen} disabled={!r.online || (!!presenter && presenter.id !== r.id)} onClick={() => void r.toggle("screen")}><Monitor size={17}/><span>Share</span></button>
          <button className="space-button" aria-pressed={!!own?.hand} disabled={!r.online} onClick={() => r.send({ type: "hand", value: !own?.hand })}><Hand size={17}/><span>Hand</span></button>
          <button className="space-button focus-toggle" aria-pressed={focus} onClick={() => setFocus(!focus)}><LayoutGrid size={17}/><span>{focus ? "Show panel" : "Focus"}</span></button>
          <button className="space-button leave-room" onClick={leave}><DoorOpen size={17}/><span>Leave</span></button>
        </nav>
        {r.online&&<button className="space-text-button repair-call" onClick={r.reconnect}>Reconnect call</button>}
        {r.error && <div className="space-error room-error" role="alert">{r.error}<button className="space-icon" aria-label="Dismiss notice" onClick={() => r.setError("")}><X size={17}/></button></div>}
      </div>
      <aside className="space-board">
        <div className="board-tabs" role="group" aria-label="Room tools">
          <button aria-pressed={panel === "board"} onClick={() => setPanel("board")}><StickyNote size={16}/> {canDraw ? "People" : "Notes"}</button>
          <button aria-pressed={panel === "chat"} onClick={() => setPanel("chat")}><AudioLines size={17}/> Chat</button>
        </div>
        {panel === "board" && canDraw ? <RoomPeople space={space} id={r.id} online={r.online} send={r.send}/> : panel === "board" ? <>
          <div className="board-title" key={space.mode}><h2>{current.board}</h2><p>{current.description}</p></div>
          <form className="note-form" onSubmit={event => { event.preventDefault(); if (note.trim() && r.send({ type: "note", text: note, kind, pin: space.mode === "watch" && !!space.watch.url })) setNote(""); }}>
            <label className="sr-only" htmlFor="board-note">Write to the room board</label>
            <textarea id="board-note" maxLength={500} required value={note} onChange={event => setNote(event.target.value)} placeholder={space.mode === "watch" ? "Name a scene or leave a note…" : "What should the group remember?"}/>
            <div><select aria-label="Note type" value={kind} onChange={event => setKind(event.target.value as NoteKind)}><option value="note">Note</option><option value="question">Question</option><option value="decision">Decision</option></select>
              <button className="space-button solid" disabled={!r.online || !note.trim()}><Plus size={16}/> {space.mode === "watch" && space.watch.url ? "Pin moment" : "Save to room"}</button></div>
          </form>
          <ol className="board-items">
            {space.notes.length === 0 && <li className="board-empty"><CircleHelp size={18}/><span>Notes stay here when everyone leaves.</span></li>}
            {[...space.notes].reverse().map(item => <li key={item.id} data-done={item.done}>
              <div className="board-item-meta"><span>{item.kind} · {item.author}</span>{item.done && <Check size={15} aria-label="Resolved"/>}</div>
              <p>{item.text}</p>
              <div className="board-item-actions">
                {item.position !== undefined && item.source === space.watch.url && space.mode === "watch" && <button className="space-text-button" disabled={!r.online || !!presenter || (!host && !space.watch.allowControl)} onClick={() => r.send({ type: "watch", action: { kind: "seek", position: item.position! } })}>Jump to {stamp(item.position)}</button>}
                {host && item.kind === "question" && <button className="space-text-button" disabled={!r.online} onClick={() => r.send({ type: "resolve", id: item.id })}>{item.done ? "Reopen" : "Mark resolved"}</button>}
              </div>
            </li>)}
          </ol>
        </> : <>
          <div className="board-title"><h2>{space.mode === "family" ? "Family chat" : "Conversation"}</h2><p>Chat stays with this live session.</p></div>
          <div className="space-chat-list" aria-label="Room messages">{space.chat.map(message => <div key={message.id}><strong>{message.name}</strong><p>{message.text}</p></div>)}<div ref={chatEnd}/></div>
          <form className="space-chat-form" onSubmit={event => { event.preventDefault(); if (chat.trim() && r.send({type:"chat",text:chat})) setChat(""); }}>
            <input aria-label="Message the room" placeholder="Message the room" maxLength={600} required value={chat} onChange={event => setChat(event.target.value)}/>
            <button className="space-icon" aria-label="Send message" disabled={!r.online || !chat.trim()}><Send size={18}/></button>
          </form>
        </>}
        <BackupPanel space={space} host={host} online={r.online} persistent={r.persistent} deviceBackup={r.deviceBackup} history={r.history} send={r.send}/>
      </aside>
    </main>
    <dialog ref={shareDialog} className="space-invite" aria-labelledby="space-invite-heading">
      <button className="space-icon invite-close" aria-label="Close invite" onClick={() => shareDialog.current?.close()}><X size={19}/></button>
      <span className="spaces-overline">ROOM INVITATION</span><h2 id="space-invite-heading">Pull up a seat.</h2>
      <p>Anyone with this link can join the room and read its board. Keep this link within your group.</p>{!r.persistent && <p className="space-pilot-note">Pilot rooms may reset when the site restarts.</p>}
      <label>Room invite link<input readOnly value={inviteURL} onFocus={event => event.target.select()}/></label>
      <button className="space-button solid" onClick={() => void copyInvite()}>{copy ? <Check size={17}/> : <Copy size={17}/>} {copy ? "Copied" : "Copy invite link"}</button>
    </dialog>
    <dialog ref={avatarDialog} className="space-invite avatar-dialog" aria-labelledby="avatar-title">
      <button className="space-icon invite-close" aria-label="Close avatar editor" onClick={()=>avatarDialog.current?.close()}><X size={18}/></button>
      <h2 id="avatar-title">Make it yours.</h2>
      <AvatarEditor key={JSON.stringify(own?.avatar)} profile={own?.avatar} onSave={avatar=>{
        writeLocal("bbtv.avatar",JSON.stringify(avatar));r.send({type:"profile",avatar});avatarDialog.current?.close();
      }}/>
    </dialog>
  </div>;
}
