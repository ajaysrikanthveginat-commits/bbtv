import { useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, ShieldCheck } from 'lucide-react';

interface LocalVideoProps {
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  userId: string;
  userName?: string;
  className?: string;
}

export function LocalVideo({
  stream,
  videoEnabled,
  audioEnabled,
  userId,
  userName = 'You',
  className = '',
}: LocalVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      const vTrack = stream.getVideoTracks()[0];
      const aTrack = stream.getAudioTracks()[0];

      console.log(
        `[LOCAL VIDEO ELEMENT]\n` +
        `readyState: ${video.readyState}\n` +
        `videoWidth: ${video.videoWidth}\n` +
        `videoHeight: ${video.videoHeight}\n` +
        `paused: ${video.paused}\n` +
        `srcObject.id: ${stream.id}`
      );

      if (vTrack) {
        console.log(
          `[LOCAL VIDEO TRACK]\n` +
          `id: ${vTrack.id}\n` +
          `readyState: ${vTrack.readyState}\n` +
          `enabled: ${vTrack.enabled}\n` +
          `muted: ${vTrack.muted}\n` +
          `settings: ${JSON.stringify(vTrack.getSettings?.() || {})}\n` +
          `stream.id: ${stream.id}`
        );

        vTrack.onmute = () => {
          console.warn(`[LOCAL VIDEO TRACK MUTED] Device driver or OS paused camera capture.`);
        };
        vTrack.onunmute = () => {
          console.log(`[LOCAL VIDEO TRACK UNMUTED] Camera capture active.`);
        };
        vTrack.onended = () => {
          console.log(`[LOCAL VIDEO TRACK ENDED]`);
        };
      }

      if (aTrack) {
        console.log(
          `[LOCAL AUDIO TRACK]\n` +
          `id: ${aTrack.id}\n` +
          `readyState: ${aTrack.readyState}\n` +
          `enabled: ${aTrack.enabled}\n` +
          `muted: ${aTrack.muted}\n` +
          `settings: ${JSON.stringify(aTrack.getSettings?.() || {})}\n` +
          `stream.id: ${stream.id}`
        );
      }

      const onLoadedMetadata = () => {
        console.log(`[LOCAL VIDEO loadedmetadata] ${video.videoWidth}x${video.videoHeight}, readyState=${video.readyState}`);
        if (video.videoWidth === 0 && video.videoHeight === 0) {
          console.warn(
            `[LOCAL CAMERA CAPTURE / DEVICE CONTENTION NOTICE]\n` +
            `Local preview dimensions are 0x0 despite active MediaStream. If Host and Participant are running in two browser windows on the SAME physical computer sharing one webcam, the OS camera device driver is locked by the first browser process, leaving the second browser with a blank camera capture.`
          );
        }
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata);

      video.play().catch((err) => {
        console.warn('[LocalVideo] Local play warning:', err);
      });

      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        if (vTrack) {
          vTrack.onmute = null;
          vTrack.onunmute = null;
          vTrack.onended = null;
        }
      };
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  const videoTracks = stream ? stream.getVideoTracks() : [];
  const audioTracks = stream ? stream.getAudioTracks() : [];

  return (
    <div
      className={`group relative flex flex-col bg-[#11131a] border border-white/10 rounded-xl overflow-hidden shadow-2xl transition-all ${className}`}
    >
      {/* Top Header Bar */}
      <div className="bg-[#171924]/90 backdrop-blur-md px-3 py-2 border-b border-white/5 flex items-center justify-between text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              stream && videoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
            }`}
          />
          <span className="font-semibold text-white tracking-wide text-xs">
            {userName} <span className="text-zinc-400 font-normal text-[11px]">(Local)</span>
          </span>
          <span className="text-zinc-500 font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
            {userId.slice(0, 6)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">Self Muted</span>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        {stream && videoEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror-mode"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
            {stream && !videoEnabled ? (
              <>
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-1">
                  <VideoOff className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-zinc-300">Camera Off</span>
                <span className="text-[10px] text-zinc-500">Video track is paused</span>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-zinc-800/80 border border-white/10 flex items-center justify-center text-zinc-400 mb-1">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-zinc-400">No Video Feed</span>
                <span className="text-[10px] text-zinc-600">Turn on camera to preview</span>
              </>
            )}
          </div>
        )}

        {/* Live track badges overlaid on bottom-left */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-md ${
              stream && videoEnabled
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                : 'bg-zinc-900/90 text-zinc-400 border border-white/10'
            }`}
          >
            {stream && videoEnabled ? <Video className="w-3 h-3 text-emerald-400" /> : <VideoOff className="w-3 h-3 text-zinc-500" />}
            <span>{stream && videoEnabled ? 'CAM ON' : 'CAM OFF'}</span>
          </div>

          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-md ${
              stream && audioEnabled
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                : 'bg-rose-950/90 text-rose-300 border border-rose-800/60'
            }`}
          >
            {stream && audioEnabled ? <Mic className="w-3 h-3 text-emerald-400" /> : <MicOff className="w-3 h-3 text-rose-400" />}
            <span>{stream && audioEnabled ? 'MIC ON' : 'MUTED'}</span>
          </div>
        </div>

        {/* Stream ID watermark */}
        {stream && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] text-zinc-500 font-mono border border-white/5">
            Stream: {stream.id.slice(0, 8)}...
          </div>
        )}
      </div>

      {/* Compact Track Footer */}
      <div className="bg-[#0e1017] px-3 py-1.5 border-t border-white/5 text-[10px] text-zinc-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>Tracks: <strong className="text-zinc-300 font-mono">{videoTracks.length}V / {audioTracks.length}A</strong></span>
        </div>
        {videoTracks[0] && (
          <span className="font-mono text-[9px] text-zinc-600 truncate max-w-[120px]">
            {videoTracks[0].id.slice(0, 8)}
          </span>
        )}
      </div>
    </div>
  );
}
