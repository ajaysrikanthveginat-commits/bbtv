import React, { useState } from 'react';
import { Video, VideoOff, Mic, MicOff, LogOut, PlusCircle, ArrowRight, Copy, Check, Radio } from 'lucide-react';
import { UserRole } from '../types/signaling';

interface RoomControlsProps {
  roomId: string;
  inRoom: boolean;
  role: UserRole | 'none';
  wsConnected: boolean;
  localStreamActive: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  error: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (targetRoomId: string) => void;
  onEnableMedia: () => void;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onLeaveRoom: () => void;
  onClearError: () => void;
}

export function RoomControls({
  roomId,
  inRoom,
  role,
  wsConnected,
  localStreamActive,
  videoEnabled,
  audioEnabled,
  error,
  onCreateRoom,
  onJoinRoom,
  onEnableMedia,
  onToggleVideo,
  onToggleAudio,
  onLeaveRoom,
  onClearError,
}: RoomControlsProps) {
  const [inputRoomId, setInputRoomId] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRoomId.trim()) {
      onJoinRoom(inputRoomId.trim().toUpperCase());
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-4 shadow-xl space-y-4">
      {/* Top Header / Connection Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg">
            <Radio className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              WATCH TOGETHER — PHASE 1 TEST ENGINE
            </h1>
            <p className="text-xs text-slate-400">
              Deterministic 1:1 WebRTC Camera & Microphone Baseline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              wsConnected
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                : 'bg-rose-950/80 text-rose-300 border-rose-800/80 animate-pulse'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span>WebSocket: {wsConnected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-950/90 border border-rose-800 text-rose-200 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">Error:</span>
            <span>{error}</span>
          </div>
          <button
            onClick={onClearError}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Lobby: Create / Join Room Bar */}
      {!inRoom ? (
        <div className="flex flex-col md:flex-row items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
          <button
            onClick={onCreateRoom}
            disabled={!wsConnected}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all shadow-md cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Room</span>
          </button>

          <span className="text-xs text-slate-500 font-medium">OR</span>

          <form onSubmit={handleJoinSubmit} className="w-full flex items-center gap-2 flex-1">
            <input
              type="text"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              placeholder="Enter 6-char Room Code..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 uppercase tracking-wider font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!wsConnected || !inputRoomId.trim()}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              <span>Join Room</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        /* In-Room Toolbar */
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Active Room:</span>
            <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-800 px-2.5 py-1 rounded">
              {roomId}
            </span>
            <button
              onClick={handleCopyRoomId}
              title="Copy Room ID"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors text-xs flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded ml-1">
              Role: <strong className="text-white uppercase">{role}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!localStreamActive ? (
              <button
                onClick={onEnableMedia}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all shadow cursor-pointer animate-bounce"
              >
                <Video className="w-4 h-4" />
                <span>Enable Camera & Mic</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onToggleVideo}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    videoEnabled
                      ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                      : 'bg-amber-950 text-amber-200 border-amber-800 hover:bg-amber-900'
                  }`}
                >
                  {videoEnabled ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-amber-400" />}
                  <span>{videoEnabled ? 'Camera On' : 'Camera Off'}</span>
                </button>

                <button
                  onClick={onToggleAudio}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    audioEnabled
                      ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                      : 'bg-rose-950 text-rose-200 border-rose-800 hover:bg-rose-900'
                  }`}
                >
                  {audioEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-rose-400" />}
                  <span>{audioEnabled ? 'Mic On' : 'Mic Muted'}</span>
                </button>
              </>
            )}

            <button
              onClick={onLeaveRoom}
              className="flex items-center gap-1.5 bg-rose-700/80 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-rose-600 ml-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Room</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
