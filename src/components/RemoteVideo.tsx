import { useEffect, useRef, useState } from 'react';
import { Volume2, User } from 'lucide-react';

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
      if (video.srcObject !== stream) {
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
          if (video.srcObject !== stream) {
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

  const showVideo = !!stream && !!resolution?.width && stream.getVideoTracks().some(track => track.enabled && !track.muted && track.readyState === 'live');
  return <div className={`call-tile ${className}`}>
    <div className="call-viewport">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <video ref={videoRef} autoPlay playsInline muted className={!showVideo ? 'call-video-hidden' : ''} />
      {!showVideo && <div className="call-placeholder"><User size={24}/><span>{remoteUserId ? 'Together, camera optional' : 'A seat for your friend'}</span>
        {!remoteUserId && onInviteClick && <button className="call-invite" onClick={onInviteClick}>Invite a friend</button>}
      </div>}
      {audioPlaybackBlocked && <button className="call-audio-unblock" onClick={handleEnableAudioGesture}><Volume2 size={14}/> Tap to hear your friend</button>}
    </div>
    <div className="call-caption"><span>{remoteUserId ? userName : 'Your friend'}</span><small>{remoteUserId ? 'In the room' : 'Seat available'}</small></div>
  </div>;
}
