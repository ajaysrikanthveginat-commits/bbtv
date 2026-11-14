import React, { useState } from "react";
import {
  ArrowRight,
  Film,
  Monitor,
  Users,
  MessageCircle,
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
    <div className="night-home">
      <header className="night-nav">
        <a className="night-brand" href="/" aria-label="BBTV home">
          <span>
            <Film size={22} />
          </span>
          BBTV<span className="night-brand-note">better together</span>
        </a>
        <div className="night-connection" role="status">
          <i className={wsConnected ? "online" : ""} />
          {wsConnected ? "Ready when you are" : "Connecting…"}
        </div>
      </header>
      <main className="night-main">
        <section className="night-hero">
          <div className="night-intro">
            <h1>
              {initialRoomCode ? (
                <>
                  Your seat is
                  <br />
                  <em>waiting.</em>
                </>
              ) : (
                <>
                  The picture house
                  <br />
                  <em>for two.</em>
                </>
              )}
            </h1>
            <p>
              {initialRoomCode
                ? "Someone saved you a spot. Add your name and join the room."
                : "Start a private cinema, invite your favorite person, and press play together."}
            </p>
            <div className="night-perks">
              <span>
                <Users size={16} /> Made for two
              </span>
              <span>
                <Monitor size={16} /> Screen sharing
              </span>
              <span>
                <MessageCircle size={16} /> Chat & calls
              </span>
            </div>
            <div className="picture-marquee" aria-hidden="true">
              <div className="marquee-frame">
                <div className="marquee-rays" />
                <div className="marquee-moon" />
                <div className="marquee-seat first" />
                <div className="marquee-seat second" />
              </div>
            </div>
          </div>
          <section className="night-entry" aria-labelledby="entry-heading">
            <div className="night-entry-icon">
              <Film size={23} />
            </div>
            <h2 id="entry-heading">
              {mode === "create" ? "Make tonight a movie night" : "Come on in"}
            </h2>
            <p>
              {mode === "create"
                ? "A room for you and your favorite person."
                : "One code. One room. Together again."}
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
              <p className="night-form-hint">
                No account needed. Camera and mic are your choice.
              </p>
            </form>
          </section>
        </section>
      </main>
      <footer className="night-footer">
        <span>BBTV Picture House</span>
        {onToggleDiagnostics && (
          <button onClick={onToggleDiagnostics}>
            <Activity size={14} /> Connection help
          </button>
        )}
      </footer>
    </div>
  );
}
