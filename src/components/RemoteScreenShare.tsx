import { screenSoundHint } from "../shared/displayMedia";
import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Maximize, Minimize, Volume2, VolumeX, StopCircle, Radio } from 'lucide-react';

interface RemoteScreenShareProps {
  stream: MediaStream | null;
  ownerName: string;
  isLocal?: boolean;
  onStopSharing?: () => void;
}

export function RemoteScreenShare({
  stream,
  ownerName,
  isLocal = false,
  onStopSharing,
}: RemoteScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(isLocal); // Always mute local to prevent audio echo loops
  const [volume, setVolume] = useState(1);
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    const tracks = stream?.getAudioTracks() ?? [];
    const updateAudio = () => setHasAudio(tracks.some(track => track.readyState === 'live'));
    const updateSize = () => {
      if (video.videoWidth) setResolution({ width: video.videoWidth, height: video.videoHeight });
    };
    updateAudio();
    setResolution(null);
    setBlocked(false);
    tracks.forEach(track => track.addEventListener('ended', updateAudio));
    video.addEventListener('resize', updateSize);
    video.srcObject = stream;
    if (stream) {
      video.muted = isLocal || isMuted;
      void video.play().catch(() => {
        if (!active || isLocal || isMuted) return;
        video.muted = true;
        setBlocked(true);
        void video.play().catch(() => {});
      });
    }
    return () => {
      active = false;
      tracks.forEach(track => track.removeEventListener('ended', updateAudio));
      video.removeEventListener('resize', updateSize);
      video.srcObject = null;
    };
  }, [stream, isLocal, isMuted]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  function enableSound() {
    const video = videoRef.current;
    if (!video || isLocal) return;
    video.muted = false;
    setIsMuted(false);
    void video.play().then(() => setBlocked(false)).catch(() => {
      video.muted = true;
      setBlocked(true);
    });
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl bg-[#090a0f] border border-white/10 overflow-hidden shadow-2xl flex flex-col group min-h-[360px] sm:min-h-[460px] max-h-[82vh]"
    >
      {/* Top Overlay Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent z-20 flex items-center justify-between pointer-events-none transition-opacity duration-300">
        {/* Left: Badge & Owner Tag */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 backdrop-blur-md shadow-lg shadow-rose-900/30">
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
              {isLocal ? 'You Are Sharing Screen' : 'Live Screen Share'}
            </span>
          </div>

          <span className="text-xs font-medium text-zinc-300 hidden sm:inline px-2 py-0.5 rounded-md bg-black/50 border border-white/10">
            {isLocal ? 'Host Presentation' : `Shared by ${ownerName}`}
          </span>
        </div>

        {/* Right: Controls (Stop Sharing, Audio, Fullscreen) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {resolution && (
            <span className="text-[10px] font-mono text-zinc-400 bg-black/60 px-2 py-1 rounded-md border border-white/10 hidden md:inline">
              {resolution.width}×{resolution.height}
            </span>
          )}

          {/* Audio Controls for remote viewer if screen stream contains audio */}
          {!isLocal && hasAudio && (
            <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 px-2 py-1 rounded-lg backdrop-blur-md">
              <button
                onClick={() => isMuted || blocked ? enableSound() : setIsMuted(true)}
                className="text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted || blocked ? 'Enable shared sound' : 'Mute shared sound'}
              >
                {isMuted || blocked ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </button>
              <input
                type="range"
                aria-label="Shared sound volume"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setIsMuted(false);
                }}
                className="w-14 h-1 bg-zinc-700 rounded-lg accent-[#8b5cf6] cursor-pointer"
              />
            </div>
          )}

          {/* Stop Sharing Button (active for host / sharer) */}
          {onStopSharing && (
            <button
              onClick={onStopSharing}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg shadow-md shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
              title="Stop Sharing Your Screen"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Stop Sharing</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Video Screen Container */}
      <div className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden min-h-[300px]">
        <video
          ref={videoRef}
          aria-label="Shared screen"
          autoPlay
          playsInline
          muted={isLocal || isMuted || blocked}
          className="w-full h-full object-contain max-h-[80vh]"
        />

        {/* If no stream or video paused */}
        {!stream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[#090a0f] text-zinc-400">
            <Monitor className="w-12 h-12 text-[#8b5cf6] animate-pulse mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Awaiting Screen Feed...</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Connecting to live display transmission over WebRTC.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="bg-[#15121c] border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-semibold text-zinc-200">
            {isLocal ? 'Transmitting host display to room' : `Viewing ${ownerName}'s screen in real time`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
          {blocked && hasAudio && <button onClick={enableSound}>Enable shared sound</button>}
          <span>{hasAudio ? 'Shared sound available' : isLocal ? screenSoundHint : 'Video only'}</span>
        </div>
      </div>
    </div>
  );
}
