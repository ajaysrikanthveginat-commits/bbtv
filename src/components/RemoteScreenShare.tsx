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
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      setResolution(null);
      setHasAudio(false);
      setIsPlaying(false);
      return;
    }

    console.log(
      `[REMOTE SCREEN SHARE]\n` +
      `stream attached: id=${stream.id}\n` +
      `videoTracks=${stream.getVideoTracks().length}\n` +
      `audioTracks=${stream.getAudioTracks().length}\n` +
      `isLocal=${isLocal}`
    );

    const vTracks = stream.getVideoTracks();
    const aTracks = stream.getAudioTracks();
    setHasAudio(aTracks.length > 0);

    // Diagnostics for remote screen share tracks
    vTracks.forEach((track) => {
      console.log(
        `[REMOTE SCREEN SHARE]\n` +
        `ontrack\n` +
        `track.kind: ${track.kind}\n` +
        `track.id: ${track.id}\n` +
        `stream.id: ${stream.id}\n` +
        `readyState: ${track.readyState}`
      );

      track.onunmute = () => {
        console.log(`[REMOTE SCREEN SHARE] onunmute: track.kind=${track.kind} track.id=${track.id} readyState=${track.readyState}`);
      };
    });

    aTracks.forEach((track) => {
      console.log(
        `[REMOTE SCREEN SHARE]\n` +
        `ontrack\n` +
        `track.kind: ${track.kind}\n` +
        `track.id: ${track.id}\n` +
        `stream.id: ${stream.id}\n` +
        `readyState: ${track.readyState}`
      );

      track.onunmute = () => {
        console.log(`[REMOTE SCREEN SHARE] audio onunmute: track.kind=${track.kind} track.id=${track.id}`);
      };
    });

    video.srcObject = stream;
    video.muted = isLocal || isMuted;

    const onLoadedMetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        setResolution({ width: video.videoWidth, height: video.videoHeight });
      }
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('[SCREEN SHARE PLAY ERROR]', err);
          // If autoplay blocked, mute and retry
          video.muted = true;
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });
    };

    const onResize = () => {
      if (video.videoWidth && video.videoHeight) {
        setResolution({ width: video.videoWidth, height: video.videoHeight });
      }
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('resize', onResize);

    // If metadata already loaded
    if (video.readyState >= 1) {
      onLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('resize', onResize);
    };
  }, [stream, isLocal]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isLocal ? true : isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume, isLocal]);

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
                onClick={() => setIsMuted(!isMuted)}
                className="text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute Screen Audio' : 'Mute Screen Audio'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setIsMuted(false);
                }}
                className="w-14 h-1 bg-zinc-700 rounded-lg accent-[#f4258c] cursor-pointer"
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
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className="w-full h-full object-contain max-h-[80vh]"
        />

        {/* If no stream or video paused */}
        {!stream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[#090a0f] text-zinc-400">
            <Monitor className="w-12 h-12 text-[#f4258c] animate-pulse mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Awaiting Screen Feed...</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Connecting to live display transmission over WebRTC.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="bg-[#0e1017] border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-semibold text-zinc-200">
            {isLocal ? 'Transmitting host display to room' : `Viewing ${ownerName}'s screen in real time`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
          <span>WebRTC Media Plane</span>
          <span>{hasAudio ? 'Audio: Synced' : 'Audio: Display Only'}</span>
        </div>
      </div>
    </div>
  );
}
