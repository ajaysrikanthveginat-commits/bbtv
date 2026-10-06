import React, { useState } from 'react';
import {
  ArrowRight,
  Activity,
  Radio,
  Monitor,
  ShieldCheck,
  Zap,
  Users2,
  Tv,
  Volume2,
  Lock,
  Play,
  Pause,
  SlidersHorizontal,
  Maximize2,
  Terminal,
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

const DISCIPLINES = [
  {
    id: 'cinema',
    tag: '01 / WATCH',
    label: 'CINEMA',
    headline: 'FRAME-LOCKED SYNCHRONIZED STREAMING.',
    description: 'Zero playback drift across continents. Synchronized playheads, volume parity, and high-fidelity Opus stereo audio.',
    specs: ['SYNC DRIFT < 8MS', '4K ANAMORPHIC', 'PEER CAM LENSES'],
  },
  {
    id: 'studio',
    tag: '02 / WORK',
    label: 'STUDIO',
    headline: 'SIMULTANEOUS DUAL-FEED BROADCAST.',
    description: 'Share a 4K display and keep your face camera live concurrently on dedicated transceivers. No dropouts. No stream replacements.',
    specs: ['DUAL TRANSCEIVERS', '3840×2160 @ 60FPS', '1080P WEBCAM'],
  },
  {
    id: 'enclave',
    tag: '03 / MEET',
    label: 'ENCLAVE',
    headline: 'EPHEMERAL PEER-TO-PEER ENCRYPTION.',
    description: 'Encrypted DTLS-SRTP media transmitted directly between peers. Zero accounts, zero cookies, zero server storage.',
    specs: ['100% DIRECT P2P', 'DTLS-SRTP 256-BIT', 'ZERO LOG RETENTION'],
  },
] as const;

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
  const [roomName, setRoomName] = useState('Studio Lounge');
  const [inputRoomId, setInputRoomId] = useState(initialRoomCode || '');
  const [allowControl, setAllowControl] = useState(true);
  const [allowShare, setAllowShare] = useState(true);

  // Active discipline selection
  const [activeDiscipline, setActiveDiscipline] = useState<'cinema' | 'studio' | 'enclave'>('cinema');

  // Simulated player interactive state
  const [isPlaying, setIsPlaying] = useState(true);

  const handleTabChange = (tab: 'create' | 'join') => {
    setActiveTab(tab);
    onClearError();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsConnected || isSubmitting) return;
    onCreateRoom({
      displayName: displayName.trim() || 'Ajay',
      roomName: roomName.trim() || 'Studio Lounge',
      allowControl,
      allowShare,
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsConnected || !inputRoomId.trim() || isSubmitting) return;
    onJoinRoom(inputRoomId.trim().toUpperCase(), displayName.trim() || 'Guest');
  };

  const currentDiscipline = DISCIPLINES.find((d) => d.id === activeDiscipline) || DISCIPLINES[0];

  return (
    <div className="min-h-screen bg-[#020306] text-white flex flex-col justify-between selection:bg-sky-500/20 selection:text-sky-300 relative overflow-x-hidden animate-cinematic-reveal">
      {/* Precision Ambient Light Beacon — Restrained & Subtle */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[1400px] h-[450px] bg-sky-500/[0.035] rounded-full blur-[200px]" />
        <div className="absolute top-1/2 -right-72 w-[600px] h-[600px] bg-blue-600/[0.015] rounded-full blur-[180px]" />
      </div>

      {/* Luxury Masthead */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 py-8 flex items-center justify-between border-b border-white/[0.06]">
        {/* Brand Wordmark */}
        <div className="flex items-baseline gap-3">
          <span className="text-2xl sm:text-3xl font-black tracking-[-0.04em] text-white select-none">
            BBTV<span className="text-sky-400">.</span>
          </span>
          <span className="hidden sm:inline text-[9px] font-mono tracking-[0.25em] text-zinc-500 uppercase">
            SPECIFICATION 01
          </span>
        </div>

        {/* Center Specification Note */}
        <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono tracking-[0.2em] uppercase text-zinc-500">
          <span>REAL-TIME SPATIAL REPAIR</span>
          <span className="text-zinc-700">·</span>
          <span>MULTI-TRANSCEIVER P2P</span>
        </div>

        {/* Mesh Status & Telemetry Link */}
        <div className="flex items-center gap-5 text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                wsConnected
                  ? 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]'
                  : 'bg-rose-400 animate-pulse'
              }`}
            />
            <span className="text-[10px] tracking-widest uppercase hidden sm:inline text-zinc-400">
              {wsConnected ? 'MESH ONLINE' : 'DISCONNECTED'}
            </span>
          </div>

          {onToggleDiagnostics && (
            <button
              type="button"
              onClick={onToggleDiagnostics}
              title="Open real-time telemetry console"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono tracking-widest uppercase text-zinc-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] transition-all cursor-pointer"
            >
              <Activity className="w-3 h-3 text-sky-400" />
              <span className="hidden md:inline">TELEMETRY</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Experience Viewport */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 py-16 sm:py-24 flex-1 flex flex-col items-center">
        {/* System Error Notification Banner */}
        {error && (
          <div className="w-full max-w-3xl mb-12 bg-rose-950/60 border border-rose-800/60 text-rose-200 px-6 py-4 rounded-xl text-xs flex items-center justify-between shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] tracking-widest uppercase text-rose-400 font-bold">SYSTEM NOTICE</span>
              <span className="text-zinc-200">{error}</span>
            </div>
            <button
              onClick={onClearError}
              className="text-rose-400 hover:text-white font-mono text-[11px] uppercase tracking-wider ml-6 cursor-pointer underline"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Monumental Hero Statement */}
        <div className="w-full text-left sm:text-center max-w-5xl mx-auto space-y-6 sm:space-y-8 mb-16 sm:mb-24">
          <div className="flex items-center sm:justify-center gap-3 text-[10px] font-mono tracking-[0.28em] uppercase text-zinc-500">
            <span>THE MEDIUM</span>
            <span className="text-zinc-700">/</span>
            <span className="text-sky-400">PURE REAL TIME</span>
            <span className="text-zinc-700">/</span>
            <span>UNCOMPROMISED DUAL-STREAM</span>
          </div>

          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[-0.045em] leading-[0.92] text-white select-none">
            <span className="block">BE TOGETHER.</span>
            <span className="block text-zinc-400 font-light tracking-[-0.03em] mt-1 sm:mt-2">
              IN PURE <span className="text-white font-black underline decoration-sky-400/40 decoration-wavy decoration-1 underline-offset-8">SYNC.</span>
            </span>
          </h1>

          <p className="text-base sm:text-xl text-zinc-400 font-normal max-w-2xl sm:mx-auto leading-relaxed pt-2 text-balance">
            Synchronized cinema, simultaneous 4K screen broadcast, and low-latency spatial voice.
            Engineered directly between peer browsers with zero permanent data retention.
          </p>

          {/* Interactive Modality Switcher */}
          <div className="flex items-center sm:justify-center gap-3 flex-wrap pt-4">
            {DISCIPLINES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveDiscipline(d.id)}
                className={`px-4 py-2 rounded-full text-[11px] font-mono tracking-widest uppercase transition-all duration-200 cursor-pointer ${
                  activeDiscipline === d.id
                    ? 'bg-white text-black font-bold shadow-lg shadow-white/10'
                    : 'bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.06] hover:border-white/[0.15]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* The Central Monolith: Living Stage + Command Deck */}
        <div className="w-full max-w-6xl rounded-3xl bg-[#04060c] border border-white/[0.08] shadow-2xl shadow-black overflow-hidden mb-24 sm:mb-32">
          {/* Top Chassis Bar */}
          <div className="px-6 sm:px-8 py-4 border-b border-white/[0.06] bg-white/[0.015] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span className="text-[11px] tracking-widest uppercase text-white font-bold">
                {currentDiscipline.tag} — {currentDiscipline.headline}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[10px] tracking-widest text-zinc-400 uppercase">
              {currentDiscipline.specs.map((s, idx) => (
                <span key={idx} className="flex items-center gap-2">
                  {idx > 0 && <span className="text-zinc-700">·</span>}
                  <span>{s}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Cinematic Living Stage (Interactive Simulation) */}
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-[#020307] flex flex-col items-center justify-center p-8 sm:p-14 overflow-hidden border-b border-white/[0.06]">
            {/* Subtle light aura */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-950/20 via-transparent to-transparent pointer-events-none" />

            {/* CINEMA STAGE SIMULATION */}
            {activeDiscipline === 'cinema' && (
              <div className="w-full h-full flex flex-col justify-between relative z-10">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white font-bold">STREAM SYNCHRONIZED</span>
                  </div>
                  <span className="text-zinc-500">FRAME 14,892 · DRIFT 0.002S</span>
                </div>

                <div className="text-center space-y-3 max-w-lg mx-auto my-auto">
                  <div
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-16 h-16 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] text-white mx-auto flex items-center justify-center transition-all cursor-pointer shadow-2xl group"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-sky-400 group-hover:scale-110 transition-transform" />
                    ) : (
                      <Play className="w-6 h-6 text-sky-400 pl-1 group-hover:scale-110 transition-transform" />
                    )}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Synchronized Cinema Stage
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                    {currentDiscipline.description}
                  </p>
                </div>

                {/* Floating Companion Lens */}
                <div className="absolute bottom-4 right-4 hidden sm:flex items-center gap-3 p-2.5 rounded-xl bg-black/80 border border-white/[0.1] backdrop-blur-md">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-sky-400/50 flex items-center justify-center text-xs font-mono text-sky-300 font-bold">
                    AJ
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-[11px] text-white block font-bold">Alex (Companion)</span>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-zinc-400">Audio Lock</span>
                    </div>
                  </div>
                </div>

                {/* Playhead Scrub Timeline */}
                <div className="space-y-2 pt-4">
                  <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden relative">
                    <div className="absolute left-0 top-0 bottom-0 w-[62%] bg-sky-400" />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-300">01:42:19.04</span>
                      <span>/</span>
                      <span>02:18:45.00</span>
                    </div>
                    {/* Audio wave bars */}
                    <div className="flex items-end gap-1 h-3">
                      <span className="w-0.5 h-full bg-sky-400 animate-audio-1" />
                      <span className="w-0.5 h-full bg-sky-400 animate-audio-2" />
                      <span className="w-0.5 h-full bg-sky-400 animate-audio-3" />
                      <span className="w-0.5 h-full bg-sky-400 animate-audio-1" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STUDIO SIMULTANEOUS MULTI-TRACK SIMULATION */}
            {activeDiscipline === 'studio' && (
              <div className="w-full h-full flex flex-col justify-between relative z-10">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-sky-400" />
                    <span className="text-white font-bold">DUAL-TRANSCEIVER STREAMING ACTIVE</span>
                  </div>
                  <span className="text-emerald-400 font-bold">NO WEBCAM DROP</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 h-full items-center py-4">
                  {/* Left 8: 4K Display broadcast preview */}
                  <div className="sm:col-span-8 h-full rounded-xl bg-[#060812] border border-white/[0.08] p-4 flex flex-col justify-between font-mono text-xs">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pb-2 border-b border-white/[0.05]">
                      <span>PRIMARY DISPLAY BROADCAST</span>
                      <span className="text-sky-400">3840×2160 @ 60FPS</span>
                    </div>
                    <div className="space-y-1 text-zinc-400 py-3 text-[11px]">
                      <p className="text-white font-bold">// WebRTC Transceiver Matrix</p>
                      <p className="text-zinc-500">Sender 0: Video Track [Camera] &rarr; Active</p>
                      <p className="text-sky-400">Sender 1: Video Track [Display Capture] &rarr; Active</p>
                      <p className="text-zinc-500">Sender 2: Audio Track [Microphone] &rarr; Active</p>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-2 border-t border-white/[0.05]">
                      <span>TRANSMISSION BITRATE: 12.4 MBPS</span>
                      <span className="text-emerald-400">0 PACKET LOSS</span>
                    </div>
                  </div>

                  {/* Right 4: Host Webcam inset lens */}
                  <div className="sm:col-span-4 h-full rounded-xl bg-[#060812] border border-sky-400/30 p-4 flex flex-col justify-between font-mono text-xs shadow-lg shadow-sky-500/5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pb-2 border-b border-white/[0.05]">
                      <span className="text-white font-bold">HOST WEBCAM</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-center py-4">
                      <div className="w-12 h-12 rounded-full bg-sky-500/10 border border-sky-400/40 text-sky-400 mx-auto flex items-center justify-center font-bold">
                        YOU
                      </div>
                      <span className="text-[11px] text-zinc-300 block pt-2">Camera Coexists</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 text-center pt-2 border-t border-white/[0.05]">
                      1080P @ 30FPS CONTINUOUS
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ENCLAVE P2P SIMULATION */}
            {activeDiscipline === 'enclave' && (
              <div className="w-full h-full flex flex-col justify-between relative z-10 font-mono">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-sky-400" />
                    <span className="text-white font-bold">CRYPTOGRAPHIC DIRECT LATTICE</span>
                  </div>
                  <span className="text-sky-400">DTLS-SRTP 256-BIT</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center my-auto">
                  <div className="p-4 rounded-xl bg-[#060812] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Topology</span>
                    <span className="text-lg font-bold text-white block">Mesh P2P</span>
                    <span className="text-[10px] text-emerald-400 block">Direct Peer Handshake</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#060812] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Data Storage</span>
                    <span className="text-lg font-bold text-white block">0 Bytes</span>
                    <span className="text-[10px] text-sky-400 block">Volatile RAM Only</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#060812] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Authentication</span>
                    <span className="text-lg font-bold text-white block">Zero Accounts</span>
                    <span className="text-[10px] text-zinc-400 block">Instant Session Dissolution</span>
                  </div>
                </div>

                <div className="text-center text-[11px] text-zinc-500 pt-2 border-t border-white/[0.05]">
                  Rooms evaporate completely the moment the final participant disconnects.
                </div>
              </div>
            )}
          </div>

          {/* Integrated Physical Command Deck (Room Creation / Access) */}
          <div className="p-8 sm:p-12 bg-[#04060c]">
            <div className="max-w-3xl mx-auto space-y-8">
              {/* Segmented Mode Switcher */}
              <div className="flex p-1.5 bg-[#020306] rounded-2xl border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => handleTabChange('create')}
                  className={`flex-1 py-3 text-xs font-mono tracking-widest uppercase transition-all duration-200 cursor-pointer ${
                    activeTab === 'create'
                      ? 'bg-white text-black font-bold shadow-xl shadow-white/10 rounded-xl'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  01 · INITIATE A SPACE
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('join')}
                  className={`flex-1 py-3 text-xs font-mono tracking-widest uppercase transition-all duration-200 cursor-pointer ${
                    activeTab === 'join'
                      ? 'bg-white text-black font-bold shadow-xl shadow-white/10 rounded-xl'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  02 · ENTER WITH KEY
                </button>
              </div>

              {activeTab === 'create' ? (
                /* CREATE ROOM FORM */
                <form onSubmit={handleCreateSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[11px] font-mono tracking-widest uppercase text-zinc-400 mb-2">
                        Operator Alias
                      </label>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name..."
                        className="w-full bg-[#020306] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/25 transition-all font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono tracking-widest uppercase text-zinc-400 mb-2">
                        Space Title <span className="text-zinc-600 lowercase">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="e.g. Studio Lounge..."
                        className="w-full bg-[#020306] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/25 transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Permissions Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <label className="flex items-center justify-between p-4 rounded-xl bg-[#020306] border border-white/[0.06] cursor-pointer hover:border-white/[0.12] transition-colors">
                      <div className="pr-3">
                        <span className="text-xs font-semibold text-zinc-200 block">
                          Synchronized Controls
                        </span>
                        <span className="text-[11px] text-zinc-500 block pt-0.5">
                          Guests can play, pause, and seek
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowControl}
                        onChange={(e) => setAllowControl(e.target.checked)}
                        className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-sky-400 focus:ring-sky-400/50 cursor-pointer accent-sky-400"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-xl bg-[#020306] border border-white/[0.06] cursor-pointer hover:border-white/[0.12] transition-colors">
                      <div className="pr-3">
                        <span className="text-xs font-semibold text-zinc-200 block">
                          Dual-Feed Screen Sharing
                        </span>
                        <span className="text-[11px] text-zinc-500 block pt-0.5">
                          Guests can broadcast displays
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowShare}
                        onChange={(e) => setAllowShare(e.target.checked)}
                        className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-sky-400 focus:ring-sky-400/50 cursor-pointer accent-sky-400"
                      />
                    </label>
                  </div>

                  {/* Primary Launch Action */}
                  <button
                    type="submit"
                    disabled={!wsConnected || isSubmitting}
                    className="w-full group flex items-center justify-center gap-3 bg-white hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-40 text-black text-xs font-mono font-bold tracking-[0.2em] uppercase px-8 py-4.5 rounded-xl transition-all duration-200 shadow-2xl shadow-white/5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>{isSubmitting ? 'INITIALIZING SPACE...' : 'LAUNCH SPACE'}</span>
                    <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1.5 transition-transform" />
                  </button>
                </form>
              ) : (
                /* JOIN ROOM FORM */
                <form onSubmit={handleJoinSubmit} className="space-y-6">
                  {initialRoomCode && (
                    <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-800/40 text-xs text-sky-200 flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
                      <span>
                        Direct invitation active for room <strong className="text-white font-mono">{initialRoomCode}</strong>.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[11px] font-mono tracking-widest uppercase text-zinc-400 mb-2">
                        Operator Alias
                      </label>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name..."
                        className="w-full bg-[#020306] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/25 transition-all font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono tracking-widest uppercase text-zinc-400 mb-2">
                        Enclave Access Key
                      </label>
                      <input
                        type="text"
                        required
                        value={inputRoomId}
                        onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                        placeholder="e.g. 8-CHAR CODE"
                        maxLength={12}
                        className="w-full bg-[#020306] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white font-mono tracking-widest uppercase placeholder-zinc-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/25 transition-all"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#020306] border border-white/[0.06] text-xs text-zinc-400 flex items-center gap-3 font-mono">
                    <Lock className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="text-[11px] leading-relaxed">
                      Handshake connects directly to the host peer via end-to-end encrypted media.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={!wsConnected || !inputRoomId.trim() || isSubmitting}
                    className="w-full group flex items-center justify-center gap-3 bg-white hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-40 text-black text-xs font-mono font-bold tracking-[0.2em] uppercase px-8 py-4.5 rounded-xl transition-all duration-200 shadow-2xl shadow-white/5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>{isSubmitting ? `CONNECTING TO ${inputRoomId}...` : 'ENTER ENCLAVE'}</span>
                    <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1.5 transition-transform" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Editorial Architecture Manifesto (Monumental 3-Column Spread) */}
        <div className="w-full max-w-6xl pt-16 border-t border-white/[0.08]">
          <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-zinc-500 mb-12">
            TECHNICAL ARCHITECTURE & SPECIFICATIONS
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            <div className="space-y-4">
              <span className="text-xs font-mono text-sky-400">01 / DUAL-TRANSCEIVER ENGINE</span>
              <h3 className="text-2xl font-bold text-white tracking-tight leading-snug">
                Simultaneous Screen & Face Presence
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Conventional platforms replace your webcam when sharing your screen. BBTV negotiates dedicated transceivers for display capture and camera feeds concurrently. Both transmit simultaneously at native fidelity.
              </p>
              <div className="pt-2 text-[10px] font-mono text-zinc-500 tracking-wider">
                3840×2160 UHD · 60FPS · ZERO DROPOUTS
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-xs font-mono text-sky-400">02 / SYNCHRONIZATION PARITY</span>
              <h3 className="text-2xl font-bold text-white tracking-tight leading-snug">
                Frame-Accurate Cinema Playback
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Experience film and media with sub-10ms geographical drift. Shared playheads, scrubbing, and play/pause controls propagate across peers with zero buffering lag.
              </p>
              <div className="pt-2 text-[10px] font-mono text-zinc-500 tracking-wider">
                DRIFT &lt; 8MS · OPUS STEREO 48KHZ
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-xs font-mono text-sky-400">03 / VOLATILE PRIVACY</span>
              <h3 className="text-2xl font-bold text-white tracking-tight leading-snug">
                Ephemeral Zero-Storage Enclaves
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                No user databases, tracking pixels, or retained video recordings. Media travels directly between browser peers. When participants leave, the enclave evaporates forever.
              </p>
              <div className="pt-2 text-[10px] font-mono text-zinc-500 tracking-wider">
                100% DIRECT P2P · DTLS-SRTP 256-BIT
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Editorial Masthead Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-12 px-6 sm:px-12 text-xs font-mono text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-black tracking-[-0.04em] text-white">
              BBTV<span className="text-sky-400">.</span>
            </span>
            <span className="text-[11px] text-zinc-500">
              The Real-Time Spatial Medium
            </span>
          </div>
          <div className="flex items-center gap-6 text-[10px] tracking-widest uppercase text-zinc-400">
            <span>DTLS-SRTP</span>
            <span>·</span>
            <span>OPUS STEREO</span>
            <span>·</span>
            <span>SIMULTANEOUS DUAL-TRANSCEIVERS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}



