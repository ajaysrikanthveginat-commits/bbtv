import React, { useState } from 'react';
import {
  Film,
  Sparkles,
  Users,
  Play,
  Volume2,
  Tv,
  ArrowRight,
  Shield,
  Wifi,
  Lock,
  Globe,
  Radio,
  Activity,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(
    initialRoomCode ? 'join' : 'create'
  );
  const [displayName, setDisplayName] = useState(defaultUserName || 'Ajay');
  const [roomName, setRoomName] = useState('Movie Night');
  const [inputRoomId, setInputRoomId] = useState(initialRoomCode || '');
  const [allowControl, setAllowControl] = useState(true);
  const [allowShare, setAllowShare] = useState(true);

  const handleTabChange = (tab: 'create' | 'join') => {
    setActiveTab(tab);
    onClearError();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsConnected || isSubmitting) return;
    onCreateRoom({
      displayName: displayName.trim() || 'Ajay',
      roomName: roomName.trim() || 'Watch Party',
      allowControl,
      allowShare,
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsConnected || !inputRoomId.trim() || isSubmitting) return;
    onJoinRoom(inputRoomId.trim().toUpperCase(), displayName.trim() || 'Guest');
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col justify-between selection:bg-[#f4258c]/30 selection:text-[#f4258c]">
      {/* Background Ambience Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#f4258c]/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[400px] bg-indigo-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-[#f4258c]/5 rounded-full blur-[120px]" />
      </div>

      {/* Header / Brand Nav */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f4258c] to-[#e01e7e] flex items-center justify-center shadow-lg shadow-[#f4258c]/25">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white font-sans">
                Watch<span className="text-[#f4258c]">Together</span>
              </span>
              <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
                v1.0
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onToggleDiagnostics && (
            <button
              type="button"
              onClick={onToggleDiagnostics}
              title="Open Diagnostics"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-white/10 transition-colors cursor-pointer"
            >
              <Activity className="w-3 h-3 text-cyan-400" />
              <span className="text-[11px]">Diagnostics</span>
            </button>
          )}

          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md ${
              wsConnected
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : 'bg-rose-950/60 text-rose-300 border-rose-800/60 animate-pulse'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span className="text-[11px] font-mono">
              Signaling: {wsConnected ? 'Online' : 'Connecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col items-center">
        {/* Error Banner */}
        {error && (
          <div className="w-full max-w-2xl mb-6 bg-rose-950/90 border border-rose-800/80 text-rose-200 px-4 py-3 rounded-xl text-xs flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-rose-300">Notice:</span>
              <span>{error}</span>
            </div>
            <button
              onClick={onClearError}
              className="text-rose-400 hover:text-rose-100 font-semibold cursor-pointer text-xs ml-4 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center max-w-3xl space-y-4 mb-10">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md text-xs font-medium text-zinc-300 shadow-sm">
            <Radio className="w-3.5 h-3.5 text-[#f4258c] animate-pulse" />
            <span>Real-Time Watch Party & Calls</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
            Watch Movies Together,{' '}
            <span className="text-[#f4258c] relative inline-block">
              Anywhere.
              <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#f4258c] to-transparent opacity-60 rounded-full" />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Synchronize video playback, crystal clear voice/video chat, and instant
            screen sharing. Experience movie night as if you are sitting on the same couch.
          </p>
        </div>

        {/* Cinematic Media Preview Card */}
        <div className="w-full max-w-4xl mb-12 rounded-2xl p-1 bg-gradient-to-b from-white/10 to-transparent shadow-2xl shadow-black/80">
          <div className="relative aspect-video w-full rounded-xl bg-[#0e1017] border border-white/10 overflow-hidden group">
            {/* Movie Backdrop Artwork */}
            <img
              src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1600&q=80"
              alt="Cinematic Movie Preview"
              className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-black/40 to-transparent" />

            {/* Centered Play Prompt Mockup */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-[#f4258c]/90 text-white flex items-center justify-center shadow-xl shadow-[#f4258c]/40 border border-white/20 pl-1">
                <Play className="w-7 h-7 fill-white" />
              </div>
              <span className="mt-3 text-xs font-semibold text-white/90 tracking-wide">
                Synced Ultra-HD Stage
              </span>
            </div>

            {/* Top Overlay Badges */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-white flex items-center gap-1.5">
                <Tv className="w-3 h-3 text-[#f4258c]" />
                Cosmos Laundromat (4K)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#f4258c]/20 border border-[#f4258c]/40 text-[10px] font-bold text-[#f4258c] tracking-wider uppercase">
                Synced
              </span>
            </div>

            {/* Floating Participant Badges Preview */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <div className="flex items-center -space-x-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-black flex items-center justify-center text-xs font-bold text-white shadow">
                  A
                </div>
                <div className="w-8 h-8 rounded-full bg-[#f4258c] border-2 border-black flex items-center justify-center text-xs font-bold text-white shadow">
                  F
                </div>
              </div>
              <span className="text-[11px] text-zinc-300 font-medium bg-black/60 px-2 py-1 rounded-md border border-white/10">
                2 Connected
              </span>
            </div>

            {/* Bottom Mock Timeline */}
            <div className="absolute bottom-4 left-4 right-4 space-y-2">
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden backdrop-blur-md">
                <div className="bg-[#f4258c] h-full w-1/3 rounded-full" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>04:12</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Wifi className="w-3 h-3" /> 0ms drift
                </span>
                <span>12:45</span>
              </div>
            </div>
          </div>
        </div>

        {/* Room Action Center: Create or Join */}
        <div className="w-full max-w-xl bg-[#11131c] border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/80 backdrop-blur-xl">
          {/* Switcher Tabs */}
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 mb-6">
            <button
              type="button"
              onClick={() => handleTabChange('create')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-[#f4258c] text-white shadow-md shadow-[#f4258c]/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Create Watch Room
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('join')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'join'
                  ? 'bg-[#f4258c] text-white shadow-md shadow-[#f4258c]/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Join Existing Room
            </button>
          </div>

          {activeTab === 'create' ? (
            /* CREATE ROOM FORM */
            <form onSubmit={handleCreateSubmit} className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name (e.g., Ajay)..."
                    className="w-full bg-[#090a10] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f4258c] focus:border-[#f4258c] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Room Name <span className="text-zinc-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g., Friday Movie Night..."
                    className="w-full bg-[#090a10] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f4258c] focus:border-[#f4258c] transition-all"
                  />
                </div>
              </div>

              {/* Room Permissions */}
              <div className="pt-2 border-t border-white/5 space-y-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                  Room Permissions
                </span>

                {/* Permission 1: Playback control */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 cursor-pointer hover:bg-black/50 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Anyone can control playback
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      Allow participants to play, pause, and seek
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowControl}
                    onChange={(e) => setAllowControl(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f4258c] focus:ring-[#f4258c] bg-zinc-900 border-zinc-700 cursor-pointer accent-[#f4258c]"
                  />
                </label>

                {/* Permission 2: Share media / screen */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 cursor-pointer hover:bg-black/50 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Anyone can share media / screen
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      Allow invited guests to change the stream
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowShare}
                    onChange={(e) => setAllowShare(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f4258c] focus:ring-[#f4258c] bg-zinc-900 border-zinc-700 cursor-pointer accent-[#f4258c]"
                  />
                </label>
              </div>

              {/* Primary CTA */}
              <button
                type="submit"
                disabled={!wsConnected || isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-[#f4258c] hover:bg-[#e01e7e] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-lg shadow-[#f4258c]/30 cursor-pointer disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Creating Room...' : 'Create Watch Room'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </form>
          ) : (
            /* JOIN ROOM FORM */
            <form onSubmit={handleJoinSubmit} className="space-y-5">
              {initialRoomCode && (
                <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-700/60 text-[11px] text-indigo-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                  <span>
                    You have an invite link to join room <strong className="text-white font-mono">{initialRoomCode}</strong>. Enter your name and click Join Room below.
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name..."
                    className="w-full bg-[#090a10] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f4258c] focus:border-[#f4258c] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Room Code
                  </label>
                  <input
                    type="text"
                    required
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                    placeholder="e.g., ABC123"
                    maxLength={10}
                    className="w-full bg-[#090a10] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 font-mono tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-[#f4258c] focus:border-[#f4258c] transition-all"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-[11px] text-zinc-400 flex items-start gap-2">
                <Globe className="w-4 h-4 text-[#f4258c] shrink-0 mt-0.5" />
                <span>
                  Joining will instantly connect you with the host peer over our real-time WebRTC media pipeline.
                </span>
              </div>

              <button
                type="submit"
                disabled={!wsConnected || !inputRoomId.trim() || isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-[#f4258c] hover:bg-[#e01e7e] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-lg shadow-[#f4258c]/30 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>{isSubmitting ? `Joining ${inputRoomId || 'Room'}...` : 'Join Room'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6 mt-12 text-center text-xs text-zinc-500">
        <p>Watch Together • Phase 1 Architecture Preserved with Dark Cinematic UI</p>
      </footer>
    </div>
  );
}
