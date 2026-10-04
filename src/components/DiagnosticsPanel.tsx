import { useState } from 'react';
import { DiagnosticsState } from '../types/webrtc';
import { Activity, Terminal, ShieldAlert, CheckCircle, ChevronDown, ChevronUp, X } from 'lucide-react';

interface DiagnosticsPanelProps {
  diagnostics: DiagnosticsState;
  onClearLogs?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export function DiagnosticsPanel({
  diagnostics,
  onClearLogs,
  onClose,
  isModal = false,
}: DiagnosticsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const getStatusBadge = (status: string, successValues: string[]) => {
    const isSuccess = successValues.includes(status.toLowerCase());
    const isPending = ['checking', 'new', 'have-local-offer', 'have-remote-offer'].includes(status.toLowerCase());

    return (
      <span
        className={`font-mono px-2 py-0.5 rounded text-[11px] font-semibold ${
          isSuccess
            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
            : isPending
            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
            : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
        }`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  const isStreamDifferent =
    diagnostics.localStreamId &&
    diagnostics.remoteStreamId &&
    diagnostics.localStreamId !== diagnostics.remoteStreamId;

  const content = (
    <div className="bg-[#0f111a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      <div className="bg-[#151724] px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div
          onClick={() => !isModal && setCollapsed(!collapsed)}
          className="flex items-center gap-2 cursor-pointer flex-1"
        >
          <Activity className="w-4 h-4 text-[#f4258c]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Real-Time Diagnostics & WebRTC Engine
          </h3>
          <span className="text-[10px] font-mono bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full border border-white/5">
            Phase 1 Baseline
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {diagnostics.connectionState === 'connected' ? (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold text-xs">
                <CheckCircle className="w-3.5 h-3.5" /> Peer Connected
              </span>
            ) : (
              <span className="text-zinc-400 text-xs">State: {diagnostics.connectionState}</span>
            )}
          </span>

          {onClose ? (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {(!collapsed || isModal) && (
        <div className="p-4 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {/* Development Room Diagnostics (Strict Consistency Checker) */}
          <div className="bg-[#090a0f] p-3 rounded-xl border border-indigo-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Development Room Diagnostics
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                  (diagnostics.roomId ? diagnostics.roomId === diagnostics.wsRoomId : true)
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {(diagnostics.roomId ? diagnostics.roomId === diagnostics.wsRoomId : true)
                  ? 'ROOM STATE CONSISTENT'
                  : 'ROOM MISMATCH DETECTED'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">Active Client ID</span>
                <span className="text-zinc-200 truncate block font-semibold">{diagnostics.localUserId}</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">Active Room ID</span>
                <span className="text-emerald-400 font-bold block">{diagnostics.roomId || '<NONE>'}</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">Server Room ID</span>
                <span className="text-indigo-300 font-bold block">{diagnostics.serverRoomId || diagnostics.roomId || '<NONE>'}</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">WebSocket Room ID</span>
                <span className="text-purple-300 font-bold block">{diagnostics.wsRoomId || '<NONE>'}</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">URL Room ID</span>
                <span className="text-amber-300 font-bold block">{diagnostics.urlRoomId || '<NONE>'}</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">Stored Room ID</span>
                <span className="text-zinc-400 block">{diagnostics.storedRoomId || '<NONE>'}</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">User Role</span>
                <span className="text-pink-400 font-bold uppercase block">{diagnostics.role}</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">WebSocket Status</span>
                <span className={diagnostics.wsConnected ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {diagnostics.wsConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
            </div>
          </div>

          {/* Top Status Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#090a0f] p-2.5 rounded-xl border border-white/5">
              <div className="text-zinc-500 text-[10px] uppercase font-semibold mb-1">Room ID</div>
              <div className="font-mono text-white text-xs font-bold truncate">
                {diagnostics.roomId || '<Not Joined>'}
              </div>
            </div>

            <div className="bg-[#090a0f] p-2.5 rounded-xl border border-white/5">
              <div className="text-zinc-500 text-[10px] uppercase font-semibold mb-1">Local User (Role)</div>
              <div className="font-mono text-indigo-300 text-xs truncate">
                {diagnostics.localUserId.slice(0, 8)} ({diagnostics.role.toUpperCase()})
              </div>
            </div>

            <div className="bg-[#090a0f] p-2.5 rounded-xl border border-white/5">
              <div className="text-zinc-500 text-[10px] uppercase font-semibold mb-1">Remote Peer ID</div>
              <div className="font-mono text-[#f4258c] text-xs truncate">
                {diagnostics.remoteUserId ? diagnostics.remoteUserId.slice(0, 8) : 'None'}
              </div>
            </div>

            <div className="bg-[#090a0f] p-2.5 rounded-xl border border-white/5">
              <div className="text-zinc-500 text-[10px] uppercase font-semibold mb-1">WebSocket Signaling</div>
              <div>{getStatusBadge(diagnostics.wsConnected ? 'connected' : 'disconnected', ['connected'])}</div>
            </div>
          </div>

          {/* WebRTC State Matrix */}
          <div className="bg-[#090a0f] p-3 rounded-xl border border-white/5 space-y-2">
            <div className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wide">
              WebRTC PeerConnection Status
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-zinc-500 block text-[10px]">connectionState:</span>
                {getStatusBadge(diagnostics.connectionState, ['connected'])}
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">iceConnectionState:</span>
                {getStatusBadge(diagnostics.iceConnectionState, ['connected', 'completed'])}
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">signalingState:</span>
                {getStatusBadge(diagnostics.signalingState, ['stable'])}
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">iceGatheringState:</span>
                {getStatusBadge(diagnostics.iceGatheringState, ['complete', 'gathering'])}
              </div>
            </div>
          </div>

          {/* Media & Track Verification Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Local Media Audit */}
            <div className="bg-[#090a0f] p-3 rounded-xl border border-white/5 space-y-2">
              <div className="text-emerald-400 font-semibold text-[11px] uppercase flex items-center justify-between">
                <span>Local Media Audit</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {diagnostics.localStreamId ? diagnostics.localStreamId.slice(0, 8) + '...' : 'None'}
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Camera Track:</span>
                  <span className={diagnostics.localVideoTrack ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                    {diagnostics.localVideoTrack ? (diagnostics.localVideoEnabled ? 'ACTIVE (ON)' : 'PAUSED (OFF)') : 'NO TRACK'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Microphone Track:</span>
                  <span className={diagnostics.localAudioTrack ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                    {diagnostics.localAudioTrack ? (diagnostics.localAudioEnabled ? 'ACTIVE (UNMUTED)' : 'MUTED') : 'NO TRACK'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 truncate font-mono">
                  Track IDs: {diagnostics.localTrackIds.join(', ') || 'None'}
                </div>
              </div>
            </div>

            {/* Remote Media Audit */}
            <div className="bg-[#090a0f] p-3 rounded-xl border border-white/5 space-y-2">
              <div className="text-[#f4258c] font-semibold text-[11px] uppercase flex items-center justify-between">
                <span>Remote Media Audit</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {diagnostics.remoteStreamId ? diagnostics.remoteStreamId.slice(0, 8) + '...' : 'None'}
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Remote Video Track:</span>
                  <span className={diagnostics.remoteVideoTrack ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                    {diagnostics.remoteVideoTrack ? 'RECEIVED' : 'NONE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Remote Audio Track:</span>
                  <span className={diagnostics.remoteAudioTrack ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                    {diagnostics.remoteAudioTrack ? 'RECEIVED' : 'NONE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Resolution / Paused:</span>
                  <span className="font-mono text-zinc-300">
                    {diagnostics.remoteVideoWidth}x{diagnostics.remoteVideoHeight} | P:{diagnostics.remoteVideoPaused ? 'Y' : 'N'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stream Distinction Proof */}
          <div className="bg-[#090a0f] p-3 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-zinc-300">Stream Independence Verification</div>
              <div className="text-[10px] text-zinc-500">
                Verifies remote stream is an actual distinct WebRTC stream and not a mirror.
              </div>
            </div>
            <div>
              {isStreamDifferent ? (
                <span className="inline-flex items-center gap-1 bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> VERIFIED DISTINCT
                </span>
              ) : diagnostics.remoteStreamId && diagnostics.localStreamId ? (
                <span className="inline-flex items-center gap-1 bg-rose-950 text-rose-300 border border-rose-700 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" /> STREAM COLLISION
                </span>
              ) : (
                <span className="text-zinc-500 text-[11px] font-mono">Awaiting 2nd stream...</span>
              )}
            </div>
          </div>

          {/* Phase 2: Screen Sharing Diagnostics */}
          <div className="bg-[#090a0f] p-3 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-zinc-300">Phase 2 Screen Sharing Status</div>
              <div className="text-[10px] text-zinc-500">
                Live WebRTC RTCRtpSender.replaceTrack & getDisplayMedia state
              </div>
            </div>
            <div>
              {diagnostics.isScreenSharing ? (
                <span className="inline-flex items-center gap-1 bg-[#f4258c]/20 text-[#f4258c] border border-[#f4258c]/40 px-2.5 py-1 rounded-lg text-[11px] font-bold animate-pulse">
                  <CheckCircle className="w-3.5 h-3.5" /> BROADCASTING ({diagnostics.screenShareOwner?.toUpperCase()})
                </span>
              ) : (
                <span className="text-zinc-500 text-[11px] font-mono">INACTIVE</span>
              )}
            </div>
          </div>

          {/* Lightweight Performance Diagnostics */}
          <div className="bg-[#090a0f] p-3 rounded-xl border border-white/5 space-y-2">
            <div className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wide flex items-center justify-between">
              <span>Performance Diagnostics</span>
              <span className="text-[10px] text-zinc-500 font-normal">Throttled & Non-blocking</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-zinc-500 block text-[10px]">Render Count:</span>
                <span className="font-mono text-zinc-200 font-bold">{diagnostics.renderCount ?? 1}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-zinc-500 block text-[10px]">WS Sent (TX):</span>
                <span className="font-mono text-zinc-200 font-bold">{diagnostics.wsTxCount ?? 0}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-zinc-500 block text-[10px]">WS Received (RX):</span>
                <span className="font-mono text-zinc-200 font-bold">{diagnostics.wsRxCount ?? 0}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-zinc-500 block text-[10px]">PeerConnections:</span>
                <span className="font-mono text-zinc-200 font-bold">{diagnostics.peerConnectionCount ?? (diagnostics.connectionState !== 'uninitialized' ? 1 : 0)}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-zinc-500 block text-[10px]">Local Tracks:</span>
                <span className="font-mono text-zinc-200 font-bold">{diagnostics.localTrackIds?.length ?? 0}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-zinc-500 block text-[10px]">Remote Tracks:</span>
                <span className="font-mono text-zinc-200 font-bold">{diagnostics.remoteTrackIds?.length ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Live Log Console */}
          <div className="bg-black/90 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-2 text-zinc-400 text-[11px]">
              <div className="flex items-center gap-1.5 font-mono">
                <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                <span>WebRTC Event Console</span>
              </div>
              {onClearLogs && (
                <button
                  onClick={onClearLogs}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                >
                  Clear Logs
                </button>
              )}
            </div>
            <div className="font-mono text-[10px] space-y-1 max-h-36 overflow-y-auto pr-1">
              {diagnostics.recentLogs.length === 0 ? (
                <div className="text-zinc-600">No events logged yet</div>
              ) : (
                diagnostics.recentLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      log.level === 'error'
                        ? 'text-rose-400'
                        : log.level === 'warn'
                        ? 'text-amber-400'
                        : log.level === 'success'
                        ? 'text-emerald-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    <span className="text-zinc-600 mr-2">[{log.time}]</span>
                    {log.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
        <div className="w-full max-w-2xl">{content}</div>
      </div>
    );
  }

  return content;
}
