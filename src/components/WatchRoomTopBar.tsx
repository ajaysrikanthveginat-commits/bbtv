import { useState } from 'react';
import {
  Film,
  UserPlus,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Tv,
  Activity,
  LogOut,
  Copy,
  Check,
  MessageSquare,
  Users,
  Monitor,
  StopCircle,
} from 'lucide-react';
import { UserRole } from '../types/signaling';

interface WatchRoomTopBarProps {
  roomId: string;
  roomName: string;
  role: UserRole | 'none';
  mediaTitle: string;
  wsConnected: boolean;
  localStreamActive: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isScreenSharing?: boolean;
  isHost?: boolean;
  activeSidebarTab: 'chat' | 'people';
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSelectSidebarTab: (tab: 'chat' | 'people') => void;
  onOpenInviteModal: () => void;
  onOpenMediaModal: () => void;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  onToggleDiagnostics: () => void;
  onEnableMedia: () => void;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onLeaveRoom: () => void;
}

export function WatchRoomTopBar({
  roomId,
  roomName,
  role,
  mediaTitle,
  wsConnected,
  localStreamActive,
  videoEnabled,
  audioEnabled,
  isScreenSharing = false,
  isHost = true,
  activeSidebarTab,
  isSidebarOpen,
  onToggleSidebar,
  onSelectSidebarTab,
  onOpenInviteModal,
  onOpenMediaModal,
  onStartScreenShare,
  onStopScreenShare,
  onToggleDiagnostics,
  onEnableMedia,
  onToggleVideo,
  onToggleAudio,
  onLeaveRoom,
}: WatchRoomTopBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="w-full bg-[#0d0f17]/95 border-b border-white/10 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur-md">
      {/* LEFT: Logo, Room Title, Code Badge */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f4258c] to-[#d01470] flex items-center justify-center shadow-md shadow-[#f4258c]/20 shrink-0">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="font-extrabold text-sm tracking-tight text-white font-sans">
              Watch<span className="text-[#f4258c]">Together</span>
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-white/10 hidden md:block" />

        {/* Room Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="truncate hidden md:block max-w-[130px] lg:max-w-[180px]">
            <span className="text-xs font-semibold text-zinc-200 block truncate" title={roomName}>
              {roomName || 'Watch Room'}
            </span>
          </div>

          {/* Room Code Badge with Copy */}
          <button
            onClick={handleCopyCode}
            title="Click to copy Room Code"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono text-zinc-300 transition-colors cursor-pointer group"
          >
            <span className="text-[10px] uppercase text-zinc-500 font-sans hidden sm:inline">Room:</span>
            <span className="font-bold text-white tracking-wider">{roomId}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3 h-3 text-zinc-400 group-hover:text-white shrink-0" />
            )}
          </button>

          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5 hidden lg:inline-block">
            {role}
          </span>
        </div>
      </div>

      {/* CENTER / LEFT: Media Title */}
      <div className="hidden lg:flex items-center gap-2 max-w-sm px-3 py-1 rounded-lg bg-black/40 border border-white/5 text-xs">
        <Tv className="w-3.5 h-3.5 text-[#f4258c] shrink-0" />
        <span className="text-zinc-400 text-[11px]">Media:</span>
        <span className="font-semibold text-white truncate text-xs">{mediaTitle}</span>
      </div>

      {/* RIGHT: Action Controls & Device Toggles */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Invite Friend CTA */}
        <button
          onClick={onOpenInviteModal}
          className="flex items-center gap-1.5 bg-[#f4258c] hover:bg-[#e01e7e] text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg shadow-md shadow-[#f4258c]/25 transition-all cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Invite Friend</span>
        </button>

        {/* Change Media */}
        <button
          onClick={onOpenMediaModal}
          className="flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-white/10 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <Tv className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden md:inline">Media</span>
        </button>

        {/* Screen Share Action Button */}
        {isScreenSharing ? (
          <button
            onClick={onStopScreenShare}
            title="Stop Screen Sharing"
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg shadow-md shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
          >
            <StopCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stop Sharing</span>
          </button>
        ) : isHost && onStartScreenShare ? (
          <button
            onClick={onStartScreenShare}
            title="Share Screen with Room"
            className="flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-white/10 hover:border-[#f4258c]/50 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5 text-[#f4258c]" />
            <span className="hidden md:inline">Share Screen</span>
          </button>
        ) : null}

        {/* Camera Toggle */}
        {!localStreamActive ? (
          <button
            onClick={onEnableMedia}
            title="Enable Camera & Microphone"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-all shadow-md cursor-pointer animate-pulse"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Start Cam</span>
          </button>
        ) : (
          <button
            onClick={onToggleVideo}
            title={videoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
            className={`flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              videoEnabled
                ? 'bg-zinc-800/80 text-zinc-200 border-white/10 hover:bg-zinc-700'
                : 'bg-amber-950/80 text-amber-300 border-amber-800/80 hover:bg-amber-900'
            }`}
          >
            {videoEnabled ? (
              <Video className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <VideoOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden md:inline">{videoEnabled ? 'Cam On' : 'Cam Off'}</span>
          </button>
        )}

        {/* Mic Toggle */}
        {localStreamActive && (
          <button
            onClick={onToggleAudio}
            title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            className={`flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              audioEnabled
                ? 'bg-zinc-800/80 text-zinc-200 border-white/10 hover:bg-zinc-700'
                : 'bg-rose-950/80 text-rose-300 border-rose-800/80 hover:bg-rose-900'
            }`}
          >
            {audioEnabled ? (
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="hidden md:inline">{audioEnabled ? 'Mic On' : 'Muted'}</span>
          </button>
        )}

        {/* Sidebar Toggle for Tablet/Mobile or Hide/Show */}
        <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-white/10">
          <button
            onClick={() => {
              if (!isSidebarOpen) onToggleSidebar();
              onSelectSidebarTab('chat');
            }}
            title="Open Chat"
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isSidebarOpen && activeSidebarTab === 'chat'
                ? 'bg-[#f4258c] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (!isSidebarOpen) onToggleSidebar();
              onSelectSidebarTab('people');
            }}
            title="Open Members"
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isSidebarOpen && activeSidebarTab === 'people'
                ? 'bg-[#f4258c] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Diagnostics Button */}
        <button
          onClick={onToggleDiagnostics}
          title="Open WebRTC Diagnostics"
          className="flex items-center gap-1 p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 transition-colors cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden xl:inline text-[11px]">Diagnostics</span>
        </button>

        {/* Leave Room Button */}
        <button
          onClick={onLeaveRoom}
          title="Leave Watch Room"
          className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 transition-colors cursor-pointer flex items-center gap-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </header>
  );
}
