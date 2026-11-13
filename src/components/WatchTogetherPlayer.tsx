import { useEffect, useRef, useState } from "react";
import {
  Film,
  Play,
  Pause,
  Maximize,
  RefreshCw,
  Link,
  Check,
} from "lucide-react";
import { SignalingService } from "../services/SignalingService";
import { WatchAction, WatchState, watchPosition } from "../shared/watch";

export function WatchTogetherPlayer({
  signaling,
  roomId,
  userId,
}: {
  signaling: SignalingService | null;
  roomId: string;
  userId: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const [state, setState] = useState<WatchState | null>(null);
  const [host, setHost] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [now, setNow] = useState(Date.now());
  const isHost = host === userId;
  const canControl = connected && !!state && (isHost || state.allowControl);
  const ready = !!state?.ready.includes(userId);
  const send = (action: WatchAction) => {
    setError("");
    if (
      !signaling?.send({
        type: "WATCH_ACTION",
        roomId,
        senderId: userId,
        action,
      })
    )
      setError("Connection interrupted. Please wait while we reconnect.");
  };
  const request = () =>
    signaling?.send({
      type: "WATCH_GET",
      roomId,
      senderId: userId,
      requestTime: Date.now(),
    });
  useEffect(() => {
    if (!signaling) return;
    const offMessage = signaling.onMessage((message) => {
      if (message.roomId !== roomId) return;
      if (message.type === "WATCH_ERROR")
        setError(message.message || "Unable to update playback.");
      if (message.type === "WATCH_STATE" && message.state) {
        if (
          typeof message.requestTime === "number" &&
          typeof message.serverTime === "number"
        )
          offset.current =
            message.serverTime - (message.requestTime + Date.now()) / 2;
        setState((previous) =>
          !previous || message.state!.revision >= previous.revision
            ? message.state!
            : previous,
        );
        setHost(message.hostId || "");
        setMembers(message.members || []);
      }
    });
    const offConnection = signaling.onConnectionChange(setConnected);
    request();
    const poll = window.setInterval(request, 1500);
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      offMessage();
      offConnection();
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [signaling, roomId, userId]);
  useEffect(() => {
    setLoaded(false);
    setBlocked(false);
    setDuration(0);
    setError("");
  }, [state?.url]);
  useEffect(() => {
    const player = video.current;
    if (!player || !state || !loaded) return;
    const serverNow = now + offset.current;
    const target = Math.min(
      watchPosition(state, serverNow),
      Math.max(0, duration - 0.05),
    );
    if (Math.abs(player.currentTime - target) > 0.6)
      player.currentTime = target;
    if (
      connected &&
      state.playing &&
      serverNow >= state.updatedAt &&
      !player.ended
    ) {
      if (player.paused && !blocked)
        player.play().catch(() => setBlocked(true));
    } else player.pause();
  }, [state, now, connected, loaded, duration, blocked]);
  useEffect(() => {
    if (video.current) video.current.volume = volume;
  }, [volume, loaded]);
  const countdown = state?.playing
    ? Math.max(0, Math.ceil((state.updatedAt - now - offset.current) / 1000))
    : 0;
  const time = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const allReady =
    members.length >= 2 && members.every((id) => state?.ready.includes(id));
  return (
    <section
      ref={container}
      className="watch-player"
      aria-label="Watch together"
    >
      <div className="watch-heading">
        <div>
          <span className="night-eyebrow">YOUR SHARED SCREEN</span>
          <h2>Settle in. You’re together.</h2>
        </div>
        <span className="watch-status" role="status">
          {!connected
            ? "Reconnecting…"
            : !state?.url
              ? "Choose a video"
              : countdown
                ? `Starting in ${countdown}`
                : state.playing
                  ? "Playing together"
                  : "Paused"}
        </span>
      </div>
      {isHost && (
        <form
          className="watch-source"
          onSubmit={(event) => {
            event.preventDefault();
            send({ kind: "source", url });
          }}
        >
          <label className="sr-only" htmlFor="video-source">
            Direct HTTPS video link
          </label>
          <Link size={18} />
          <input
            id="video-source"
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste a direct HTTPS video link (.mp4, .webm…)"
          />
          <button className="night-control active" disabled={!connected}>
            Load video
          </button>
        </form>
      )}
      <p className="watch-hint">
        Use a direct, browser-playable video link accessible to both people.
        YouTube and subscription-service page links aren’t supported here. Use
        screen sharing for other supported content.
      </p>
      <div className="watch-canvas">
        {state?.url ? (
          <video
            key={state.url}
            ref={video}
            src={state.url}
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              const d = event.currentTarget.duration;
              if (!Number.isFinite(d) || d <= 0) {
                setError("This player needs a video with a fixed duration.");
                return;
              }
              setDuration(d);
            }}
            onCanPlay={() => setLoaded(true)}
            onTimeUpdate={(event) =>
              setPosition(event.currentTarget.currentTime)
            }
            onError={() => {
              setLoaded(false);
              if (ready) send({ kind: "ready", ready: false });
              setError(
                "The video could not load. Check the link and whether your browser supports its format.",
              );
            }}
            onEnded={() => {
              if (canControl) send({ kind: "pause" });
            }}
          />
        ) : (
          <div className="watch-empty">
            <span>
              <Film size={36} />
            </span>
            <h3>A seat for you. A seat for them.</h3>
            <p>
              {isHost
                ? "Add a video link above, or share your screen from the toolbar."
                : "Your host is choosing something to watch. Get comfortable."}
            </p>
          </div>
        )}
        {!!countdown && (
          <div className="watch-countdown" aria-live="polite">
            {countdown}
          </div>
        )}
        {blocked && (
          <button
            className="night-control active watch-unblock"
            onClick={() => {
              video.current
                ?.play()
                .then(() => setBlocked(false))
                .catch(() =>
                  setError(
                    "Your browser could not play this video. Try another supported source.",
                  ),
                );
            }}
          >
            Enable playback on this device
          </button>
        )}
      </div>
      <div className="watch-playback">
        <button
          className="night-control"
          aria-label={state?.playing ? "Pause for everyone" : "Start together"}
          disabled={!canControl || !loaded || (!state?.playing && !allReady)}
          onClick={() => send({ kind: state?.playing ? "pause" : "start" })}
        >
          {state?.playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span>{time(position)}</span>
        <input
          aria-label="Playback position"
          type="range"
          min="0"
          max={duration || 1}
          step="0.1"
          value={Math.min(position, duration)}
          disabled={!canControl || !loaded}
          onChange={(event) =>
            send({ kind: "seek", position: Number(event.target.value) })
          }
        />
        <span>{time(duration)}</span>
        <button
          className="night-control"
          aria-label="Refresh synchronization"
          disabled={!connected}
          onClick={request}
        >
          <RefreshCw size={17} />
        </button>
        <button
          className="night-control"
          aria-label="Fullscreen player"
          onClick={() => {
            const action = document.fullscreenElement
              ? document.exitFullscreen()
              : container.current?.requestFullscreen();
            action?.catch(() =>
              setError("Fullscreen is unavailable in this browser."),
            );
          }}
        >
          <Maximize size={17} />
        </button>
      </div>
      <div className="watch-lobby">
        <div>
          <h3>Ready when you both are</h3>
          <p>
            {members.length < 2
              ? "Invite your friend using the button above."
              : `${state?.ready.length || 0} of ${members.length} ready · Start together with a 3-second countdown.`}
          </p>
        </div>
        <button
          className={"night-control " + (ready ? "active" : "")}
          aria-pressed={ready}
          disabled={!connected || !loaded}
          onClick={() => send({ kind: "ready", ready: !ready })}
        >
          <Check size={17} />
          {ready ? (state?.playing ? "Take a break" : "Ready ✓") : "I’m ready"}
        </button>
      </div>
      <div className="watch-options">
        <label>
          My volume
          <input
            aria-label="Your volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </label>
        {isHost ? (
          <label>
            <input
              type="checkbox"
              checked={!!state?.allowControl}
              disabled={!connected}
              onChange={(event) =>
                send({ kind: "permission", allowControl: event.target.checked })
              }
            />{" "}
            Let my friend control playback
          </label>
        ) : (
          <span>
            {state?.allowControl
              ? "You both have the remote"
              : "Your host has the remote"}
          </span>
        )}
      </div>
      {error && (
        <p className="night-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
