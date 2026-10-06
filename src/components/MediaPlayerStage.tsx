import { useState, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  Film,
  Sparkles,
  Info,
  Tv,
} from 'lucide-react';
import { LocalVideo } from './LocalVideo';
import { RemoteVideo } from './RemoteVideo';
import { RemoteScreenShare } from './RemoteScreenShare';
import { Monitor, StopCircle } from 'lucide-react';

interface MediaPlayerStageProps {
  mediaTitle: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteScreenStream?: MediaStream | null;
  localUserId: string;
  localUserName: string;
  remoteUserId: string | null;
  remoteUserName: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isHost?: boolean;
  isScreenSharing?: boolean;
  screenShareOwner?: 'local' | 'remote' | null;
  screenStream?: MediaStream | null;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  onOpenMediaModal: () => void;
  onOpenInviteModal: () => void;
  onEnableMedia: () => void;
}

export function MediaPlayerStage({
  mediaTitle,
  localStream,
  remoteStream,
  remoteScreenStream = null,
  localUserId,
  localUserName,
  remoteUserId,
  remoteUserName,
  videoEnabled,
  audioEnabled,
  isHost = true,
  isScreenSharing = false,
  screenShareOwner = null,
  screenStream = null,
  onStartScreenShare,
  onStopScreenShare,
  onOpenMediaModal,
  onOpenInviteModal,
  onEnableMedia,
}: MediaPlayerStageProps) {
  // Player UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const duration = 765; // 12m 45s demo duration
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('1.0x');
  const [showSyncNotice, setShowSyncNotice] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
    setShowSyncNotice(true);
    setTimeout(() => setShowSyncNotice(false), 3000);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const speeds = ['0.75x', '1.0x', '1.25x', '1.5x', '2.0x'];
  const handleCycleSpeed = () => {
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      {/* If Screen Sharing is active, render the dedicated live screen share stage */}
      {isScreenSharing ? (
        <RemoteScreenShare
          stream={screenShareOwner === 'local' ? screenStream : (remoteScreenStream || remoteStream)}
          ownerName={screenShareOwner === 'local' ? 'You' : remoteUserName}
          isLocal={screenShareOwner === 'local'}
          onStopSharing={onStopScreenShare}
        />
      ) : (
        /* CINEMATIC VIDEO PLAYER CARD */
        <div
          ref={playerContainerRef}
          className="relative w-full rounded-2xl bg-[#090a0f] border border-white/10 overflow-hidden shadow-2xl flex flex-col group"
        >
          {/* Top Floating Overlay (Title & Phase 2 Indicator) */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f4258c] animate-pulse" />
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate max-w-md drop-shadow">
                {mediaTitle}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-[#f4258c] border border-[#f4258c]/30">
                Synced Stage
              </span>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {isHost && onStartScreenShare && (
                <button
                  onClick={onStartScreenShare}
                  className="text-xs font-semibold text-white bg-[#f4258c] hover:bg-[#e01e7e] px-3 py-1.5 rounded-lg shadow-md shadow-[#f4258c]/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Share Screen</span>
                </button>
              )}

              <button
                onClick={onOpenMediaModal}
                className="text-xs font-semibold text-zinc-300 hover:text-white bg-black/60 hover:bg-black/80 border border-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Tv className="w-3.5 h-3.5 text-[#f4258c]" />
                <span>Change Media</span>
              </button>
            </div>
          </div>

        {/* Sync Status Banner */}
        {showSyncNotice && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-black/90 border border-[#f4258c]/40 text-white text-xs px-4 py-2 rounded-xl backdrop-blur-md shadow-2xl flex items-center gap-2 animate-fade-in">
            <Sparkles className="w-4 h-4 text-[#f4258c]" />
            <span>Full video file playback sync activates in Phase 2. WebRTC voice & video is live!</span>
          </div>
        )}

        {/* Video Canvas Viewport */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          {/* Cinematic Backdrop Visual */}
          <img
            src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80"
            alt="Cinematic Screen Canvas"
            className="w-full h-full object-cover opacity-60 group-hover:opacity-75 transition-opacity duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />

          {/* Large Center Play / Pause Indicator */}
          <button
            onClick={handleTogglePlay}
            className="absolute z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#f4258c]/90 hover:bg-[#f4258c] text-white flex items-center justify-center shadow-2xl shadow-[#f4258c]/50 transition-transform active:scale-95 cursor-pointer pl-1"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-white" />
            ) : (
              <Play className="w-8 h-8 fill-white" />
            )}
          </button>

          {/* Quick Notice Pill on Canvas */}
          <div className="absolute bottom-16 left-4 bg-black/70 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-xs text-zinc-300 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#f4258c]" />
            <span>Phase 1 Media Canvas • WebRTC Video Below</span>
          </div>
        </div>

        {/* COMPACT PLAYER CONTROLS BAR */}
        <div className="bg-[#0e1017] border-t border-white/10 px-4 py-3 space-y-2">
          {/* Progress / Scrub Bar */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                setCurrentTime(Math.floor(pos * duration));
                setShowSyncNotice(true);
                setTimeout(() => setShowSyncNotice(false), 3000);
              }}
              className="flex-1 h-2 bg-zinc-800 hover:h-2.5 rounded-full relative cursor-pointer group/bar transition-all"
            >
              <div
                className="h-full bg-gradient-to-r from-[#f4258c] to-[#e01e7e] rounded-full relative"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="text-[11px] font-mono text-zinc-400 w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Left Controls: Play, Volume, Time */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePlay}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              <button
                onClick={() => setCurrentTime(0)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Restart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Volume Slider */}
              <div className="flex items-center gap-1.5 pl-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-16 sm:w-20 h-1 bg-zinc-700 rounded-lg accent-[#f4258c] cursor-pointer"
                />
              </div>
            </div>

            {/* Right Controls: Speed, Sync Room, Fullscreen */}
            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <button
                onClick={handleCycleSpeed}
                title="Change Playback Speed"
                className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-mono font-semibold transition-colors cursor-pointer"
              >
                {playbackSpeed}
              </button>

              {/* Sync Room Button */}
              <button
                onClick={() => {
                  setShowSyncNotice(true);
                  setTimeout(() => setShowSyncNotice(false), 3000);
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#f4258c]/15 hover:bg-[#f4258c]/25 border border-[#f4258c]/30 text-[#f4258c] text-xs font-semibold transition-colors cursor-pointer"
                title="Synchronize room timestamp"
              >
                <span className="w-2 h-2 rounded-full bg-[#f4258c] animate-ping" />
                <span>Sync Room</span>
              </button>

              {/* Fullscreen */}
              <button
                onClick={handleFullscreen}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Fullscreen"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* WEBRTC PARTICIPANT VIDEO GRID (Real Phase 1 Video Feeds) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Live Participants & Calls
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-[#f4258c] border border-[#f4258c]/20">
              WebRTC 1:1
            </span>
          </div>

          {!localStream && (
            <button
              onClick={onEnableMedia}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
            >
              Enable Camera & Microphone
            </button>
          )}
        </div>

        {/* 2-Column Participant Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* REMOTE PARTICIPANT TILE */}
          <RemoteVideo
            stream={remoteStream}
            remoteUserId={remoteUserId}
            localStreamId={localStream ? localStream.id : null}
            userName={remoteUserName}
            onInviteClick={onOpenInviteModal}
          />

          {/* LOCAL CAMERA TILE */}
          <LocalVideo
            stream={localStream}
            videoEnabled={videoEnabled}
            audioEnabled={audioEnabled}
            userId={localUserId}
            userName={localUserName}
          />
        </div>
      </div>
    </div>
  );
}
