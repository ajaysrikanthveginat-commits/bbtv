import { useRef, useState } from "react";
import type { FormEvent, PointerEvent } from "react";
import { ArrowDownRight, ArrowRight, AudioLines, Clapperboard, Play, X } from "lucide-react";

interface LandingPageProps {
  wsConnected: boolean;
  error: string | null;
  defaultUserName: string;
  initialRoomCode?: string;
  isSubmitting?: boolean;
  onToggleDiagnostics?: () => void;
  onCreateRoom: (params: { displayName: string; roomName: string; allowControl: boolean; allowShare: boolean }) => void;
  onJoinRoom: (code: string, name: string) => void;
  onClearError: () => void;
}

export function LandingPage(p: LandingPageProps) {
  const [mode, setMode] = useState(p.initialRoomCode ? "join" : "create");
  const [name, setName] = useState(p.defaultUserName);
  const [code, setCode] = useState(p.initialRoomCode ?? "");
  const [room, setRoom] = useState("Movie night");
  const ticket = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLVideoElement>(null);
  function moveProjection(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--projection-tilt", `rotateX(${y * -4}deg) rotateY(${x * 6}deg)`);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!p.wsConnected || p.isSubmitting || !name.trim()) return;
    if (mode === "join") {
      if (code.trim()) p.onJoinRoom(code.trim().toUpperCase(), name.trim());
    } else {
      p.onCreateRoom({ displayName: name.trim(), roomName: room.trim() || "Movie night", allowControl: true, allowShare: false });
    }
  }
  return (
    <div className="cut-home">
      <header className="premiere-nav">
        <a className="premiere-brand" href="/" aria-label="BBTV home"><Clapperboard size={19} /> BBTV<span> / THE SHARED CUT</span></a>
        <span className="premiere-status" role="status"><i data-online={p.wsConnected} />{p.wsConnected ? "Online" : "Connecting"}</span>
      </header>
      <main className="premiere-main">
        <div className="premiere-hero" onPointerMove={moveProjection} onPointerLeave={(event) => event.currentTarget.style.removeProperty("--projection-tilt")}>
          <div className="premiere-image" aria-hidden="true" />
          <div className="premiere-copy">
            <h1>{p.initialRoomCode ? <>Your seat<br /><em>is waiting.</em></> : <>The shared<br /><em>cut.</em></>}</h1>
            <p>{p.initialRoomCode ? "Join your friend’s screening." : "A private screening for two. Roll together, talk through it, and pin the scenes you’ll want to replay."}</p>
            <button type="button" className="premiere-trailer" onClick={() => { dialog.current?.showModal(); preview.current?.play().catch(() => {}); }}><Play size={15} /> Play the preview</button>
          </div>
          <button type="button" className="premiere-jump" aria-label="Go to room setup" onClick={() => { ticket.current?.scrollIntoView({block:"center"}); ticket.current?.querySelector("input")?.focus({preventScroll:true}); }}><ArrowDownRight size={30} /></button>
        </div>
        <section ref={ticket} className="premiere-ticket" aria-labelledby="ticket-title">
          <div className="ticket-tabs" aria-label="Room action">
            <button type="button" aria-pressed={mode === "create"} onClick={() => {setMode("create"); p.onClearError();}}>Create room</button>
            <button type="button" aria-pressed={mode === "join"} onClick={() => {setMode("join"); p.onClearError();}}>Join room</button>
          </div>
          <form onSubmit={submit}>
            <h2 id="ticket-title">{mode === "create" ? "Create a screening" : "Enter your room"}</h2>
            {p.error && <p role="alert">{p.error}</p>}
            <label>Your name<input autoComplete="given-name" required maxLength={40} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Alex" /></label>
            {mode === "create"
              ? <label>Room name<input maxLength={60} value={room} onChange={e=>setRoom(e.target.value)} placeholder="Friday screening" /></label>
              : <label>Room code<input required autoComplete="off" spellCheck={false} maxLength={12} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="e.g. Q6GZ87" /></label>}
            <button className="ticket-submit" disabled={!p.wsConnected || p.isSubmitting || !name.trim() || (mode === "join" && !code.trim())}>
              {p.isSubmitting ? "Opening…" : mode === "create" ? "Start movie night" : "Join movie night"}<ArrowRight size={19} />
            </button>
          </form>
          <p className="ticket-note"><AudioLines size={15} /> Invite one friend. No account needed.</p>
        </section>
      </main>
      <footer className="premiere-footer"><span>BBTV</span>{p.onToggleDiagnostics && <button onClick={p.onToggleDiagnostics}>Connection help</button>}</footer>
      <dialog ref={dialog} aria-label="BBTV preview" className="media-dialog" onClose={() => preview.current?.pause()}>
        <div className="media-dialog-body">
          <button className="night-control media-close" aria-label="Close preview" onClick={() => dialog.current?.close()}><X size={19}/></button>
          <h2>BBTV preview</h2>
          <video ref={preview} src="/bbtv-preview.webm" controls playsInline preload="none" style={{width:"100%"}} />
        </div>
      </dialog>
    </div>
  );
}
