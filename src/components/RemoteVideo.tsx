import { useEffect, useRef, useState } from 'react';
import { Volume2, AlertTriangle, Video, Users, CheckCircle2, User, VolumeX } from 'lucide-react';

interface RemoteVideoProps {
  stream: MediaStream | null;
  remoteUserId: string | null;
  localStreamId: string | null;
  userName?: string;
  className?: string;
  onInviteClick?: () => void;
}

export function RemoteVideo({
  stream,
  remoteUserId,
  localStreamId,
  userName = 'Remote Friend',
  className = '',
  onInviteClick,
}: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastAttachedStreamIdRef = useRef<string | null>(null);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [audioPlaybackActive, setAudioPlaybackActive] = useState(false);
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [, setTrackVersion] = useState(0);

  // Attach stream and attempt playback safely following strict WebRTC lifecycle rules
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isSubscribed = true;

    if (stream) {
      console.log(`REMOTE STREAM ID = ${stream.id}`);

      // Permanently mute video element so video decoding is never blocked by audio policies
      video.muted = true;

      // Section 4: Attach stream and ensure decoder binds to video tracks
      if (video.srcObject !== stream || lastAttachedStreamIdRef.current !== stream.id || (video.videoWidth === 0 && stream.getVideoTracks().length > 0)) {
        video.srcObject = stream;
        lastAttachedStreamIdRef.current = stream.id;
      }

      // Section 3: Verify exact Remote Video Element state
      console.log(
        `[REMOTE VIDEO ELEMENT]\n` +
        `srcObject exists: ${!!video.srcObject}\n` +
        `srcObject.id: ${(video.srcObject as MediaStream)?.id || 'none'}\n` +
        `video.paused: ${video.paused}\n` +
        `video.muted: ${video.muted}\n` +
        `video.readyState: ${video.readyState}\n` +
        `video.networkState: ${video.networkState}\n` +
        `video.currentTime: ${video.currentTime}\n` +
        `video.videoWidth: ${video.videoWidth}\n` +
        `video.videoHeight: ${video.videoHeight}`
      );

      // Section 5: Video playback test with explicit promise resolution/rejection capture
      const attemptPlay = () => {
        try {
          video.muted = true;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('[REMOTE VIDEO PLAY]\nSUCCESS');
              })
              .catch((domException: DOMException) => {
                console.error(
                  `[REMOTE VIDEO PLAY]\nFAILED\n` +
                  `name: ${domException.name}\n` +
                  `message: ${domException.message}`
                );
              });
          }
        } catch (err: any) {
          console.error('[REMOTE VIDEO PLAY SYNCHRONOUS ERROR]', err);
        }
      };

      attemptPlay();

      // Dedicated audio element playback
      const attemptAudioPlay = () => {
        const audio = audioRef.current;
        if (!audio || !stream || stream.getAudioTracks().length === 0) {
          if (isSubscribed) setAudioPlaybackActive(false);
          return;
        }

        if (audio.srcObject !== stream) {
          audio.srcObject = stream;
        }
        audio.muted = false;

        audio
          .play()
          .then(() => {
            console.log('[REMOTE AUDIO PLAY] SUCCESS - Remote audio is actively playing');
            if (isSubscribed) {
              setAudioPlaybackActive(true);
              setAudioPlaybackBlocked(false);
            }
          })
          .catch((err: any) => {
            console.warn('[REMOTE AUDIO PLAY] Playback rejected/blocked:', err.name, err.message);
            if (isSubscribed) {
              if (err.name === 'NotAllowedError') {
                setAudioPlaybackBlocked(true);
                setAudioPlaybackActive(false);
              } else {
                setAudioPlaybackActive(false);
              }
            }
          });
      };

      attemptAudioPlay();

      // Section 6: Video frame delivery diagnostics and event listeners
      const onLoadedMetadata = () => {
        const width = video.videoWidth || 0;
        const height = video.videoHeight || 0;
        console.log(`[VIDEO EVENT loadedmetadata] readyState=${video.readyState} width=${width} height=${height}`);
        if (width > 0 && height > 0 && isSubscribed) {
          setResolution({ width, height });
        }
      };

      const onLoadedData = () => {
        console.log(`[VIDEO EVENT loadeddata] readyState=${video.readyState}`);
      };

      const onCanPlay = () => {
        console.log(`[VIDEO EVENT canplay] readyState=${video.readyState}`);
      };

      const onPlaying = () => {
        console.log(`[VIDEO EVENT playing] readyState=${video.readyState} currentTime=${video.currentTime.toFixed(2)} width=${video.videoWidth} height=${video.videoHeight}`);
      };

      const onWaiting = () => {
        console.log(`[VIDEO EVENT waiting] readyState=${video.readyState}`);
      };

      const onError = () => {
        console.error(`[VIDEO EVENT error] code=${video.error?.code} message=${video.error?.message}`);
      };

      let lastSampleTime = 0;
      const onTimeUpdate = () => {
        const now = Date.now();
        if (now - lastSampleTime > 3000) {
          lastSampleTime = now;
          console.log(`[VIDEO FRAME DELIVERY] currentTime=${video.currentTime.toFixed(2)}s width=${video.videoWidth} height=${video.videoHeight} readyState=${video.readyState}`);
        }
      };

      const onResize = () => {
        const width = video.videoWidth || 0;
        const height = video.videoHeight || 0;
        console.log(`[VIDEO EVENT resize] width=${width} height=${height}`);
        if (width > 0 && height > 0 && isSubscribed) {
          setResolution({ width, height });
        }
      };

      // Listen for tracks dynamically added to the existing stream
      const onTrackAdded = (ev: MediaStreamTrackEvent) => {
        console.log(`[REMOTE STREAM TRACK ADDED] kind=${ev.track.kind} id=${ev.track.id}`);
        if (ev.track.kind === 'video') {
          if (video.srcObject !== stream || video.videoWidth === 0) {
            video.srcObject = stream;
          }
          if (video.paused) {
            attemptPlay();
          }
        } else if (ev.track.kind === 'audio') {
          attemptAudioPlay();
        }
        ev.track.addEventListener('unmute', onTrackUnmuted);
        if (isSubscribed) {
          setTrackVersion((v) => v + 1);
        }
      };

      const onTrackRemoved = (ev: MediaStreamTrackEvent) => {
        console.log(`[REMOTE STREAM TRACK REMOVED] kind=${ev.track.kind} id=${ev.track.id}`);
        ev.track.removeEventListener('unmute', onTrackUnmuted);
        if (isSubscribed) {
          setTrackVersion((v) => v + 1);
        }
      };

      const onTrackUnmuted = (ev: Event) => {
        const trk = ev.target as MediaStreamTrack;
        console.log(`[REMOTE TRACK UNMUTED IN VIDEO ELEMENT] kind=${trk?.kind || 'unknown'} id=${trk?.id || 'unknown'}`);
        if (trk?.kind === 'audio') {
          attemptAudioPlay();
        } else {
          if (video.videoWidth === 0 && stream.getVideoTracks().length > 0) {
            video.srcObject = stream;
          }
          if (video.paused) {
            attemptPlay();
          }
        }
        if (isSubscribed) {
          setTrackVersion((v) => v + 1);
        }
      };

      const onTrackMuted = (ev: Event) => {
        const trk = ev.target as MediaStreamTrack;
        console.log(`[REMOTE TRACK MUTED] kind=${trk?.kind || 'unknown'} id=${trk?.id || 'unknown'}`);
        if (trk?.kind === 'audio' && isSubscribed) {
          setAudioPlaybackActive(false);
        }
      };

      stream.getTracks().forEach((t) => {
        t.addEventListener('unmute', onTrackUnmuted);
        t.addEventListener('mute', onTrackMuted);
      });

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('playing', onPlaying);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('error', onError);
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('resize', onResize);

      stream.addEventListener('addtrack', onTrackAdded);
      stream.addEventListener('removetrack', onTrackRemoved);

      return () => {
        isSubscribed = false;
        stream.getTracks().forEach((t) => {
          t.removeEventListener('unmute', onTrackUnmuted);
          t.removeEventListener('mute', onTrackMuted);
        });

        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('error', onError);
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('resize', onResize);

        stream.removeEventListener('addtrack', onTrackAdded);
        stream.removeEventListener('removetrack', onTrackRemoved);
      };
    } else {
      video.srcObject = null;
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
      lastAttachedStreamIdRef.current = null;
      setAudioPlaybackBlocked(false);
      setAudioPlaybackActive(false);
      setResolution(null);
    }

    return () => {
      isSubscribed = false;
    };
  }, [stream]);

  const handleEnableAudioGesture = async () => {
    const audio = audioRef.current;
    if (audio) {
      try {
        console.log('[USER GESTURE UNMUTE] Calling audio.play() on dedicated audio element...');
        audio.muted = false;
        await audio.play();
        console.log('[USER GESTURE UNMUTE] SUCCESS - Audio actively playing');
        setAudioPlaybackActive(true);
        setAudioPlaybackBlocked(false);
      } catch (err: any) {
        console.error('[USER GESTURE UNMUTE] FAILED:', err);
      }
    }
  };

  const videoTracks = stream ? stream.getVideoTracks() : [];
  const audioTracks = stream ? stream.getAudioTracks() : [];
  const isVideoDecoding = resolution !== null && resolution.width > 0 && resolution.height > 0;
  const hasLiveVideo = videoTracks.length > 0 && videoTracks[0].enabled;
  const hasLiveAudio = audioTracks.length > 0 && audioTracks[0].enabled;

  return (
    <div
      className={`group relative flex flex-col bg-[#11131a] border border-white/10 rounded-xl overflow-hidden shadow-2xl transition-all ${className}`}
    >
      {/* Top Header Bar */}
      <div className="bg-[#171924]/90 backdrop-blur-md px-3 py-2 border-b border-white/5 flex items-center justify-between text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              stream ? 'bg-[#f4258c] animate-pulse' : 'bg-zinc-600'
            }`}
          />
          <span className="font-semibold text-white tracking-wide text-xs">
            {remoteUserId ? userName : 'Friend'}
          </span>
          {remoteUserId && (
            <span className="text-[#f4258c] font-mono text-[10px] bg-[#f4258c]/10 border border-[#f4258c]/20 px-1.5 py-0.5 rounded">
              Peer: {remoteUserId.slice(0, 6)}
            </span>
          )}
        </div>

        {stream && (
          isVideoDecoding ? (
            <span className="flex items-center gap-1 text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3" />
              <span className="hidden sm:inline">Decoded {resolution.width}×{resolution.height}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] bg-amber-950/80 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span className="hidden sm:inline">Awaiting Video Decode</span>
            </span>
          )
        )}
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        {/* Hidden dedicated audio element for resilient unmuted audio playback */}
        <audio ref={audioRef} autoPlay playsInline className="hidden" />

        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-500 gap-3 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500">
              <User className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-300">Awaiting Remote Participant</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                Invite a friend using your room code to join video and audio.
              </p>
            </div>
            {onInviteClick && (
              <button
                onClick={onInviteClick}
                className="mt-1 text-xs font-semibold text-white bg-[#f4258c] hover:bg-[#e01e7e] px-3 py-1.5 rounded-lg transition-all shadow-md shadow-[#f4258c]/20 cursor-pointer"
              >
                Invite Friend
              </button>
            )}
          </div>
        )}

        {/* Browser Audio Autoplay Blocked Warning Banner */}
        {audioPlaybackBlocked && (
          <div className="absolute top-2 left-2 right-2 bg-black/90 backdrop-blur-md border border-amber-500/60 rounded-lg p-2.5 flex items-center justify-between z-20 shadow-xl animate-fade-in">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <VolumeX className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <div className="text-[11px] text-zinc-200 truncate">
                <span className="font-semibold text-amber-300">Audio Blocked by Browser: </span>
                Click to hear friend.
              </div>
            </div>
            <button
              onClick={handleEnableAudioGesture}
              className="flex items-center gap-1.5 bg-[#f4258c] hover:bg-[#e01e7e] text-white font-semibold px-3 py-1 rounded-md text-xs shadow-md shadow-[#f4258c]/25 transition-all cursor-pointer shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Enable Audio</span>
            </button>
          </div>
        )}

        {/* Participant Status Badges overlaid on bottom-left */}
        {stream && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-md ${
                hasLiveVideo
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                  : 'bg-zinc-900/90 text-zinc-400 border border-white/10'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>{hasLiveVideo ? 'CAM LIVE' : 'NO VIDEO'}</span>
            </div>

            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-md ${
                audioPlaybackBlocked
                  ? 'bg-amber-950/90 text-amber-300 border border-amber-700/60'
                  : audioPlaybackActive
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                  : hasLiveAudio
                  ? 'bg-zinc-900/90 text-zinc-300 border border-white/10'
                  : 'bg-rose-950/90 text-rose-300 border border-rose-800/60'
              }`}
            >
              {audioPlaybackBlocked ? (
                <VolumeX className="w-3 h-3 text-amber-400 animate-pulse" />
              ) : audioPlaybackActive ? (
                <Volume2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <VolumeX className="w-3 h-3 text-rose-400" />
              )}
              <span>
                {audioPlaybackBlocked
                  ? 'AUDIO BLOCKED'
                  : audioPlaybackActive
                  ? 'AUDIO ACTIVE'
                  : hasLiveAudio
                  ? 'AUDIO READY'
                  : 'MUTED'}
              </span>
            </div>
          </div>
        )}

        {/* Remote Stream ID tag */}
        {stream && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] text-[#f4258c] font-mono border border-white/5">
            Stream: {stream.id.slice(0, 8)}...
          </div>
        )}
      </div>

      {/* Footer Details */}
      <div className="bg-[#0e1017] px-3 py-1.5 border-t border-white/5 text-[10px] text-zinc-500 flex flex-wrap items-center justify-between gap-1">
        <div>
          <span>Tracks: <strong className="text-zinc-300 font-mono">{videoTracks.length}V / {audioTracks.length}A</strong></span>
        </div>
        {resolution && (
          <div className="text-zinc-400 font-mono text-[9px]">
            {resolution.width}x{resolution.height}
          </div>
        )}
      </div>
    </div>
  );
}
