import React, { useRef, useState } from "react";
import {
  ArrowRight,
  Film,
  Play,
  X,

  Activity,
} from "lucide-react";

interface LandingPageProps {
  wsConnected: boolean;
  error: string | null;
  defaultUserName: string;
  initialRoomCode?: string;
  isSubmitting?: boolean;
  onToggleDiagnostics?: () => void;
  onCreateRoom: (params: {
    displayName: string;
    roomName: string;
    allowControl: boolean;
    allowShare: boolean;
  }) => void;
  onJoinRoom: (targetRoomId: string, displayName: string) => void;
  onClearError: () => void;
}

export function LandingPage({
  wsConnected,
  error,
  defaultUserName,
  initialRoomCode,
  isSubmitting = false,
  onToggleDiagnostics,
  onCreateRoom,
  onJoinRoom,
  onClearError,
}: LandingPageProps) {
  const previewDialog = useRef<HTMLDialogElement>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"create" | "join">(
    initialRoomCode ? "join" : "create",
  );
  const [name, setName] = useState(defaultUserName || "");
  const [roomName, setRoomName] = useState("Movie night");
  const [code, setCode] = useState(initialRoomCode || "");
  const [allowControl, setAllowControl] = useState(true);
  const allowShare = false;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!wsConnected || isSubmitting || !name.trim()) return;
    if (mode === "join") {
      if (code.trim()) onJoinRoom(code.trim().toUpperCase(), name.trim());
    } else
      onCreateRoom({
        displayName: name.trim(),
        roomName: roomName.trim() || "Movie night",
        allowControl,
        allowShare,
      });
  };
  return (
    <div className="night-home listening-home">
      <header className="night-nav">
        <a className="night-brand" href="/" aria-label="BBTV home">
          <span>
            <Film size={22} />
          </span>
          BBTV<span className="night-brand-note">The Listening Room</span>
        </a>
        <div className="night-connection" role="status">
          <i className={wsConnected ? "online" : ""} />
          {wsConnected ? "Connected" : "Connecting…"}
        </div>
      </header>
      <main className="night-main">
        <section className="night-hero">
          <div className="night-intro">
            <h1>{initialRoomCode ? <>Your seat<br /> <em>is saved.</em></> : <>Movie night.<br /><em>In sync.</em></>}</h1>
            <p>{initialRoomCode
              ? "Enter your name to join your friend’s screening."
              : "Watch in sync, talk through the twists, and share the good parts."}</p>
            {!initialRoomCode && <button type="button" className="night-control lobby-preview" onClick={() => {
              previewDialog.current?.showModal();
              previewVideo.current?.play().catch(() => {});
            }}><Play size={15} /> Watch the preview</button>}
          </div>
          <figure className="listening-lobby-art">
            <img src="/listening-poster.webp" alt="A framed forest film poster in a warmly lit cinema alcove" width={1184} height={1029} />
          </figure>
          <dialog className="media-dialog lobby-dialog" ref={previewDialog} aria-labelledby="lobby-preview-title" onClose={() => previewVideo.current?.pause()}>
            <div className="media-dialog-body">
              <button type="button" className="night-control media-close" aria-label="Close preview" onClick={() => previewDialog.current?.close()}><X size={18} /></button>
              <h2 id="lobby-preview-title">BBTV preview</h2>
              <video ref={previewVideo} src="/bbtv-preview.webm" controls playsInline preload="none" />
            </div>
          </dialog>
          <section className="night-entry" aria-labelledby="entry-heading">
            <div className="night-entry-icon">
              <Film size={23} />
            </div>
            <h2 id="entry-heading">
              {mode === "create" ? "Open a screening room" : "Join your friend"}
            </h2>
            <p>
              {mode === "create"
                ? "Create a private screening for two."
                : "Use the room code from your invitation."}
            </p>
            <div className="night-tabs" aria-label="Room action">
              {(["create", "join"] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  aria-pressed={mode === tab}
                  onClick={() => {
                    setMode(tab);
                    onClearError();
                  }}
                >
                  {tab === "create" ? "Start a room" : "Join a room"}
                </button>
              ))}
            </div>
            {error && (
              <div className="night-error" role="alert">
                {error}
                <button onClick={onClearError} type="button">
                  Dismiss
                </button>
              </div>
            )}
            <form onSubmit={submit}>
              <label htmlFor="display-name">Your name</label>
              <input
                id="display-name"
                autoComplete="given-name"
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
              />
              {mode === "create" ? (
                <>
                  <label htmlFor="room-name">
                    Room name <span>optional</span>
                  </label>
                  <input
                    id="room-name"
                    value={roomName}
                    maxLength={60}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Friday night favorites"
                  />
                  <details className="night-permissions">
                    <summary>Room permissions</summary>
                    <label>
                      <input
                        type="checkbox"
                        checked={allowControl}
                        onChange={(e) => setAllowControl(e.target.checked)}
                      />{" "}
                      Let your guest control playback
                    </label>

                  </details>
                </>
              ) : (
                <>
                  <label htmlFor="room-code">Room code</label>
                  <input
                    id="room-code"
                    required
                    autoComplete="off"
                    spellCheck={false}
                    value={code}
                    maxLength={12}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. Q6GZ87"
                  />
                  <p className="night-form-hint">
                    Your friend can find this at the top of their room.
                  </p>
                </>
              )}
              <button
                className="night-primary"
                disabled={
                  !wsConnected ||
                  isSubmitting ||
                  !name.trim() ||
                  (mode === "join" && !code.trim())
                }
              >
                {isSubmitting
                  ? "Getting your room ready…"
                  : mode === "create"
                    ? "Start movie night"
                    : "Join movie night"}
                <ArrowRight size={18} />
              </button>
              
            </form>
          </section>
        </section>
      </main>
      <footer className="night-footer">
        <span>BBTV The Listening Room</span>
        {onToggleDiagnostics && (
          <button onClick={onToggleDiagnostics}>
            <Activity size={14} /> Connection help
          </button>
        )}
      </footer>
    </div>
  );
}
