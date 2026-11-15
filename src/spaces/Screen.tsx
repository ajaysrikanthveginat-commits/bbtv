import { useEffect, useRef, useState } from "react";
import { Film, Pause, Play, Link2, Maximize2, Clapperboard } from "lucide-react";
import { watchPosition, type WatchAction, type WatchState } from "../shared/watch";

export const stamp = (value?: number) => {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export function Screen({ watch, id, host, count, offset, online, act }: {
  watch: WatchState; id: string; host: string; count: number; offset: number; online: boolean;
  act: (action: WatchAction) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [readySource, setReadySource] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const loaded = !!watch.url && readySource === watch.url;
  const canControl = host === id || watch.allowControl;
  const ready = watch.ready.includes(id);
  const countdown = watch.playing ? Math.max(0, Math.ceil((watch.updatedAt - now - offset) / 1000)) : 0;
  const breakTime = Math.max(0, Math.ceil(((watch.breakUntil || 0) - now - offset) / 1000));
  const everyone = count >= 2 && watch.ready.length === count;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 180);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setReadySource(""); setDuration(0); setPosition(0); setBlocked(false); setError("");
  }, [watch.url]);
  useEffect(() => {
    const player = video.current;
    if (!player || !loaded) return;
    const target = Math.min(watchPosition(watch, now + offset), duration);
    if (Math.abs(player.currentTime - target) > 0.75 && !player.seeking) player.currentTime = target;
    if (online && watch.playing && !countdown && !player.ended && !blocked) {
      if (player.paused) void player.play().catch(() => setBlocked(true));
    } else player.pause();
  }, [watch, now, offset, duration, online, blocked, loaded, countdown]);

  return <section className="space-screen" aria-label="Shared video">
    <div className="screen-projection" ref={stage}>
      {watch.url ? <video key={watch.url} ref={video} aria-label="Room video" src={watch.url} playsInline preload="auto"
        onCanPlay={event => {
          const length = event.currentTarget.duration;
          if (Number.isFinite(length) && length > 0) { setReadySource(watch.url); setDuration(length); }
          else setError("Choose a video with a fixed duration.");
        }}
        onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
        onError={() => { setReadySource(""); setError("The video couldn’t load. Use a direct MP4 or WebM link."); if (ready) act({ kind: "ready", ready: false }); }}
        onEnded={() => { if (canControl && watch.playing) act({ kind: "pause" }); }}
      /> : <div className="screen-welcome">
        <Film size={28} /><h3>Set up the screening</h3>
        <p>{host === id ? "Bring a direct video link or try the BBTV preview." : "Your host can choose what’s playing."}</p>
        {host === id && <button className="space-button" disabled={!online} onClick={() => act({ kind: "preview" })}><Clapperboard size={16}/> Load demo film</button>}
      </div>}
      {countdown > 0 && <div className="space-countdown" key={countdown} role="status">{countdown}</div>}
      {breakTime > 0 && !watch.playing && <div className="space-intermission" role="status"><strong>Intermission</strong><span>{stamp(breakTime)}</span></div>}
      {blocked && watch.playing && !countdown && <button className="space-button space-autoplay" onClick={() => { void video.current?.play().then(() => setBlocked(false)).catch(() => setError("This device couldn’t play the video.")); }}>Enable playback</button>}
    </div>
    {watch.url && <div className="space-player-controls">
      <button className="space-icon" aria-label={watch.playing ? "Pause for everyone" : "Start together"} disabled={!online || !loaded || !canControl || (!watch.playing && !everyone)}
        onClick={() => act({ kind: watch.playing ? "pause" : "start" })}>{watch.playing ? <Pause size={19} /> : <Play size={19} />}</button>
      <span>{stamp(position)}</span>
      <input type="range" aria-label="Shared playback position" value={Math.min(position, duration)} min={0} max={duration || 1} step={0.1} disabled={!online || !canControl || !loaded} onChange={event => { const value = Number(event.target.value); setPosition(value); act({ kind: "seek", position: value }); }} />
      <span>{stamp(duration)}</span>
      {typeof document.documentElement.requestFullscreen === "function" && <button className="space-icon" aria-label="Full screen" onClick={() => { void stage.current?.requestFullscreen().catch(() => setError("Full screen is unavailable right now.")); }}><Maximize2 size={17} /></button>}
    </div>}
    {watch.url && <div className="space-ready">
      <span>{watch.title || "Shared video"} · {watch.ready.length} of {count} ready</span>
      <button className={`space-button ${ready ? "" : "solid"}`} disabled={!loaded || !online} onClick={() => act({ kind: "ready", ready: !ready })}>{ready ? watch.playing ? "Pause and step away" : "Ready ✓" : "I’m ready"}</button>
    </div>}
    {host === id && <form className="space-source" onSubmit={event => { event.preventDefault(); act({ kind: "source", url }); }}>
      <Link2 size={17} aria-hidden="true"/><input type="url" required aria-label="Direct video URL" placeholder="https://example.com/film.mp4" value={url} onChange={event => setUrl(event.target.value)} maxLength={4096}/><button className="space-button" disabled={!online}>Load video</button>
    </form>}
    {error && <p className="space-error" role="alert">{error}</p>}
  </section>;
}
