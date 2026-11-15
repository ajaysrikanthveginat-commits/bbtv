import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, ArrowRight, Play, X } from "lucide-react";

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
  const [room, setRoom] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLVideoElement>(null);

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
    <div className="salon-home">
      <header className="salon-nav">
        <a href="/" className="salon-wordmark" aria-label="BBTV home">bbtv<span>.</span></a>
        <button type="button" onClick={p.onToggleDiagnostics}>Connection help <ArrowUpRight size={14} /></button>
      </header>
      <main>
        <div className="salon-hero">
          <div className="salon-intro">
            <h1>{p.initialRoomCode ? <>Your seat<br /> <em>is saved.</em></> : <>A night <em>in.</em><br />Together.</>}</h1>
            <p>{p.initialRoomCode ? "Your friend invited you to a private screening." : "A private screening room for you and one friend. Watch in sync and talk whenever you like."}</p>
            <button className="salon-preview" type="button" onClick={() => { dialog.current?.showModal(); preview.current?.play().catch(() => {}); }}><Play size={15} /> Play the preview</button>
          </div>

        </div>
        <section className="salon-booking" aria-label="Room setup">
          <div className="salon-booking-modes" aria-label="Room action">
            {(["create", "join"] as const).map((choice) => (
              <button key={choice} type="button" aria-pressed={mode === choice} onClick={() => { setMode(choice); p.onClearError(); }}>{choice === "create" ? "Create a room" : "Join a room"}</button>
            ))}
          </div>
          <form onSubmit={submit}>
            <label>Your name<input autoComplete="given-name" required maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="Alex" /></label>
            {mode === "create"
              ? <label>Room name<input maxLength={60} value={room} onChange={e => setRoom(e.target.value)} placeholder="Movie night" /></label>
              : <label>Room code<input required autoComplete="off" spellCheck={false} maxLength={12} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Q6GZ87" /></label>}
            <button className="salon-submit" disabled={!p.wsConnected || p.isSubmitting || !name.trim() || (mode === "join" && !code.trim())}>
              {p.isSubmitting ? "Opening…" : mode === "create" ? "Start movie night" : "Join movie night"}<ArrowRight size={18} />
            </button>
          </form>
          {(!p.wsConnected || p.error) && <p role={p.error ? "alert" : "status"}>{p.error || "Connecting to BBTV…"}</p>}
        </section>
      </main>
      <dialog ref={dialog} aria-label="BBTV preview" className="media-dialog salon-preview-dialog" onClose={() => preview.current?.pause()}>
        <div className="media-dialog-body">
          <button type="button" className="night-control media-close" aria-label="Close preview" onClick={() => dialog.current?.close()}><X size={19}/></button>
          <h2>BBTV preview</h2>
          <video ref={preview} src="/bbtv-preview.webm" controls playsInline preload="none" />
        </div>
      </dialog>
    </div>
  );
}
