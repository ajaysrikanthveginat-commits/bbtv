import React, { useState } from "react";
import {
  ArrowRight,
  Film,
  Monitor,
  Users,
  MessageCircle,
  Sparkles,
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
            <span className="night-eyebrow">
              <Sparkles size={15} /> A LITTLE CLOSER, EVEN FROM AFAR
            </span>
            <h1>
              {initialRoomCode ? (
                <>
                  Your seat is
                  <br />
                  <em>waiting.</em>
                </>
              ) : (
                <>
                  Different places.
                  <br />
                  Same <em>movie night.</em>
                </>
              )}
            </h1>
            <p>
              {initialRoomCode
                ? "Someone saved you a spot. Add your name and join the room."
                : "Press play on a little together time. Share your screen, see their smile, and talk through the best bits."}
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
            <div
              className="night-scene"
              aria-label="Decorative illustration of a movie night"
            >
              <div className="night-orbit" />
              <div className="night-mountain back" />
              <div className="night-mountain front" />
              <div className="night-scene-copy">
                <span>THE BEST PART IS THE COMPANY</span>
                <strong>
                  A whole world.
                  <br />A shared moment.
                </strong>
              </div>
              <span className="night-scene-caption">
                Your next movie night starts here.
              </span>
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
        <section className="night-steps" aria-label="How it works">
          {[
            {
              n: "01",
              title: "Save them a seat",
              text: "Create a room and send your friend the invite link.",
            },
            {
              n: "02",
              title: "Bring something to watch",
              text: "Share your screen and pick something you both love.",
            },
            {
              n: "03",
              title: "Settle in together",
              text: "Keep the conversation going with video, voice, and chat.",
            },
          ].map((step) => (
            <article key={step.n}>
              <span>{step.n}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </section>
      </main>
      <footer className="night-footer">
        <span>BBTV · Good company, wherever you are.</span>
        {onToggleDiagnostics && (
          <button onClick={onToggleDiagnostics}>
            <Activity size={14} /> Connection help
          </button>
        )}
      </footer>
    </div>
  );
}
