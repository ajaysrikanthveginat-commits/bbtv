import { useState, useEffect, useRef, useCallback } from 'react';
import { SignalingService } from './services/SignalingService';
import { WebRTCManager } from './services/WebRTCManager';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { LandingPage } from './components/LandingPage';
import { WatchRoomTopBar } from './components/WatchRoomTopBar';
import { MediaPlayerStage } from './components/MediaPlayerStage';
import { Sidebar, ChatMessage, Participant } from './components/Sidebar';
import { InviteModal } from './components/InviteModal';
import { ChangeMediaModal } from './components/ChangeMediaModal';
import { DiagnosticsState } from './types/webrtc';
import { UserRole, SignalingMessage } from './types/signaling';

export default function App() {
  // Authoritative Single Source of Truth for Room ID
  const [roomId, setRoomId] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('Movie Night');
  const [inRoom, setInRoom] = useState<boolean>(false);
  const [role, setRole] = useState<UserRole | 'none'>('none');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Parse URL parameter once on mount
  const [urlRoomId, setUrlRoomId] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('room') || '').toUpperCase().trim();
    } catch {
      return '';
    }
  });

  // Check stored room ID
  const [storedRoomId, setStoredRoomId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('wt_room_id') || '';
    } catch {
      return '';
    }
  });

  const [displayName, setDisplayName] = useState<string>(() => {
    return localStorage.getItem('wt_display_name') || 'Ajay';
  });

  const [localUserId] = useState<string>(() => {
    const stored = sessionStorage.getItem('wt_user_id');
    if (stored) return stored;
    const generated = 'usr_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('wt_user_id', generated);
    return generated;
  });

  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [remoteUserName, setRemoteUserName] = useState<string>('Friend');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Media Player State
  const [mediaTitle, setMediaTitle] = useState<string>('Cosmos Laundromat (4K Ultra HD)');

  // UI Modals & Navigation state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'people'>('chat');

  // Chat messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Local media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState<boolean>(true);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Remote media state
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Phase 2: Screen sharing state
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [screenShareOwner, setScreenShareOwner] = useState<'local' | 'remote' | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    roomId: '',
    localUserId,
    remoteUserId: null,
    role: 'none',
    wsConnected: false,
    serverRoomId: null,
    wsRoomId: null,
    urlRoomId: urlRoomId || null,
    storedRoomId: storedRoomId || null,
    connectionState: 'uninitialized',
    iceConnectionState: 'uninitialized',
    signalingState: 'uninitialized',
    iceGatheringState: 'uninitialized',
    localVideoTrack: false,
    localAudioTrack: false,
    localVideoEnabled: true,
    localAudioEnabled: true,
    localStreamId: null,
    localTrackIds: [],
    remoteVideoTrack: false,
    remoteAudioTrack: false,
    remoteStreamId: null,
    remoteTrackIds: [],
    remoteVideoReadyState: 0,
    remoteVideoPaused: true,
    remoteVideoMuted: false,
    remoteVideoCurrentTime: 0,
    remoteVideoWidth: 0,
    remoteVideoHeight: 0,
    remoteAutoplayBlocked: false,
    recentLogs: [],
  });

  // Persistent references to avoid recreating WebRTC / WebSocket on state changes
  const signalingRef = useRef<SignalingService | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);

  // Mutable refs to prevent stale closures and unnecessary effect teardowns
  const roomIdRef = useRef<string>(roomId);
  roomIdRef.current = roomId;
  const remoteUserIdRef = useRef<string | null>(remoteUserId);
  remoteUserIdRef.current = remoteUserId;
  const roleRef = useRef<UserRole | 'none'>(role);
  roleRef.current = role;
  const inRoomRef = useRef<boolean>(inRoom);
  inRoomRef.current = inRoom;
  const localUserIdRef = useRef<string>(localUserId);
  localUserIdRef.current = localUserId;

  // Render counter for lightweight performance diagnostics
  const renderCountRef = useRef(0);
  renderCountRef.current++;

  // Throttled log buffer to prevent render storms
  const logsBufferRef = useRef<Array<{ time: string; text: string; level: 'info' | 'warn' | 'error' | 'success' }>>([]);
  const logFlushTimeoutRef = useRef<number | null>(null);

  const addLog = useCallback((text: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const time = new Date().toTimeString().slice(0, 8);
    logsBufferRef.current = [{ time, text, level }, ...logsBufferRef.current.slice(0, 49)];

    if (!logFlushTimeoutRef.current) {
      logFlushTimeoutRef.current = window.setTimeout(() => {
        logFlushTimeoutRef.current = null;
        setDiagnostics((prev) => ({
          ...prev,
          recentLogs: [...logsBufferRef.current],
          renderCount: renderCountRef.current,
          wsTxCount: signalingRef.current?.getTxCount() ?? 0,
          wsRxCount: signalingRef.current?.getRxCount() ?? 0,
        }));
      }, 200);
    }
  }, []);

  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;

  // Helper to add system chat message
  const addSystemMessage = useCallback((text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: 'sys_' + Math.random().toString(36).substring(2, 9),
        sender: 'System',
        text,
        time,
        isSystem: true,
      },
    ]);
  }, []);

  const addSystemMessageRef = useRef(addSystemMessage);
  addSystemMessageRef.current = addSystemMessage;

  // Single mount effect: initialize stable Signaling and WebRTC Manager
  useEffect(() => {
    const uid = localUserIdRef.current;
    const signaling = new SignalingService();
    signalingRef.current = signaling;

    const webrtc = new WebRTCManager({
      onRemoteStream: (stream) => {
        console.log(`REMOTE STREAM ID = ${stream.id}`);
        addLog(
          `Attaching remote MediaStream: ${stream.id} (${stream.getVideoTracks().length}V / ${stream.getAudioTracks().length}A)`,
          'success'
        );
        setRemoteStream(stream);
        setDiagnostics((prev) => ({
          ...prev,
          remoteStreamId: stream.id,
          remoteVideoTrack: stream.getVideoTracks().length > 0,
          remoteAudioTrack: stream.getAudioTracks().length > 0,
          remoteTrackIds: stream.getTracks().map((t) => `${t.kind}:${t.id.slice(0, 6)}`),
        }));
      },
      onRemoteScreenStream: (screenStream) => {
        console.log(`REMOTE SCREEN STREAM ID = ${screenStream ? screenStream.id : 'null'}`);
        setRemoteScreenStream(screenStream);
        if (screenStream) {
          setIsScreenSharing(true);
          setScreenShareOwner('remote');
          addLog(
            `Attaching remote screen MediaStream: ${screenStream.id} (${screenStream.getVideoTracks().length}V)`,
            'success'
          );
        }
      },
      onIceCandidate: (candidate) => {
        const curRoom = roomIdRef.current;
        const curRemote = remoteUserIdRef.current;
        if (curRoom && curRemote) {
          signaling.send({
            type: 'ICE_CANDIDATE',
            roomId: curRoom,
            senderId: uid,
            targetId: curRemote,
            payload: candidate,
          });
        }
      },
      onConnectionStateChange: (state) => {
        setDiagnostics((prev) => ({ ...prev, connectionState: state }));
      },
      onIceConnectionStateChange: (state) => {
        setDiagnostics((prev) => ({ ...prev, iceConnectionState: state }));
      },
      onSignalingStateChange: (state) => {
        setDiagnostics((prev) => ({ ...prev, signalingState: state }));
      },
      onIceGatheringStateChange: (state) => {
        setDiagnostics((prev) => ({ ...prev, iceGatheringState: state }));
      },
      onScreenShareEnded: async () => {
        setIsScreenSharing(false);
        setScreenShareOwner(null);
        setLocalScreenStream(null);
        const curRoom = roomIdRef.current;
        const curRemote = remoteUserIdRef.current;
        if (signalingRef.current && curRoom) {
          signalingRef.current.send({
            type: 'SCREEN_SHARE_STOPPED',
            roomId: curRoom,
            senderId: uid,
            ownerRole: roleRef.current !== 'none' ? roleRef.current : undefined,
          });
          if (curRemote) {
            const offer = await webrtcRef.current?.createOffer();
            if (offer && signalingRef.current) {
              signalingRef.current.send({
                type: 'OFFER',
                roomId: curRoom,
                senderId: uid,
                targetId: curRemote,
                payload: offer,
              });
            }
          }
        }
        addLog('[SCREEN SHARE STOP] Screen share ended, camera/mic restored', 'info');
        addSystemMessage('Screen sharing ended.');
      },
      onError: (err) => {
        setErrorMessage(err);
        addLog(err, 'error');
      },
      onLog: (text, level) => {
        addLog(text, level);
      },
    }, uid);
    webrtcRef.current = webrtc;

    const unbindConnection = signaling.onConnectionChange((connected) => {
      setWsConnected(connected);
      setDiagnostics((prev) => ({ ...prev, wsConnected: connected }));
      addLog(
        `Signaling WebSocket ${connected ? 'CONNECTED' : 'DISCONNECTED'}`,
        connected ? 'success' : 'warn'
      );
    });

    // Reconnection handling: Re-assert active room state without creating duplicate rooms
    const unbindReconnected = signaling.onReconnected(() => {
      const activeRoom = roomIdRef.current;
      if (activeRoom) {
        console.log(`[ROOM] RECONNECT_ATTEMPT client=${uid} room=${activeRoom}`);
        addLog(`WebSocket reconnected: re-asserting room ${activeRoom}...`, 'info');
        signaling.send({
          type: 'RECONNECT_ROOM',
          roomId: activeRoom,
          senderId: uid,
          role: roleRef.current !== 'none' ? roleRef.current : undefined,
        });
      }
    });

    // Message handler
    const unbindMessage = signaling.onMessage(async (message: SignalingMessage) => {
      const curWebRTC = webrtcRef.current;
      if (!curWebRTC) return;

      switch (message.type) {
        case 'ROOM_JOINED': {
          const validatedRoomId = (message.roomId || '').toUpperCase().trim();
          console.log(`[ROOM] ${message.role === 'host' ? 'ROOM_CREATED' : 'JOIN_SUCCESS'} client=${uid} room=${validatedRoomId}`);
          console.log(`[ROOM] CLIENT_STATE client=${uid} room=${validatedRoomId} role=${message.role}`);

          // Single Source of Truth updates:
          roomIdRef.current = validatedRoomId;
          roleRef.current = message.role;
          inRoomRef.current = true;

          setIsSubmitting(false);
          setErrorMessage(null); // Clear any old room errors
          setInRoom(true);
          setRoomId(validatedRoomId);
          setRole(message.role);

          if (message.remoteUserId) {
            remoteUserIdRef.current = message.remoteUserId;
            setRemoteUserId(message.remoteUserId);
          }

          curWebRTC.setRoleAndRemotePeer(message.role, message.remoteUserId || null);

          // Update sessionStorage and URL synchronously
          sessionStorage.setItem('wt_room_id', validatedRoomId);
          setStoredRoomId(validatedRoomId);

          try {
            const url = new URL(window.location.href);
            url.searchParams.set('room', validatedRoomId);
            window.history.replaceState({}, '', url.toString());
            setUrlRoomId(validatedRoomId);
          } catch {
            // ignore url history errors in non-standard environments
          }

          setDiagnostics((prev) => ({
            ...prev,
            roomId: validatedRoomId,
            serverRoomId: validatedRoomId,
            wsRoomId: validatedRoomId,
            urlRoomId: validatedRoomId,
            storedRoomId: validatedRoomId,
            role: message.role,
            remoteUserId: message.remoteUserId || null,
          }));

          addLog(`Authoritative Room: ${validatedRoomId} as ${message.role.toUpperCase()}`, 'success');
          addSystemMessage(
            message.role === 'host'
              ? `Room ${validatedRoomId} created. Waiting for friends to join...`
              : `Connected to room ${validatedRoomId}!`
          );
          break;
        }

        case 'USER_JOINED': {
          console.log(`[ROOM] USER_JOINED client=${uid} peer=${message.userId} room=${message.roomId}`);
          remoteUserIdRef.current = message.userId;
          setRemoteUserId(message.userId);
          setRemoteUserName('Friend');
          curWebRTC.setRoleAndRemotePeer(roleRef.current, message.userId);
          setDiagnostics((prev) => ({ ...prev, remoteUserId: message.userId }));
          addLog(`Remote peer ${message.userId.slice(0, 8)} joined the room!`, 'success');
          addSystemMessage(`A friend joined the watch room!`);

          // If we are host, initiate the WebRTC Offer to the newly arrived participant
          addLog('Host initiating WebRTC offer to new participant...', 'info');
          const offer = await curWebRTC.createOffer();
          if (offer) {
            signaling.send({
              type: 'OFFER',
              roomId: message.roomId,
              senderId: uid,
              targetId: message.userId,
              payload: offer,
            });
            addLog('Sent WebRTC OFFER via signaling', 'info');
          }
          break;
        }

        case 'USER_LEFT': {
          console.log(`[ROOM] USER_LEFT client=${uid} peer=${message.userId} room=${message.roomId}`);
          addLog(`Remote peer ${message.userId.slice(0, 8)} left the room`, 'warn');
          addSystemMessage(`Remote friend left the room.`);
          remoteUserIdRef.current = null;
          setRemoteUserId(null);
          setRemoteStream(null);
          setRemoteScreenStream(null);
          setIsScreenSharing(false);
          setScreenShareOwner(null);
          curWebRTC.setRoleAndRemotePeer(roleRef.current, null);
          curWebRTC.closePeerConnection();
          setDiagnostics((prev) => ({
            ...prev,
            remoteUserId: null,
            remoteVideoTrack: false,
            remoteAudioTrack: false,
            remoteStreamId: null,
            remoteTrackIds: [],
            connectionState: 'uninitialized',
            iceConnectionState: 'uninitialized',
          }));
          break;
        }

        case 'OFFER': {
          addLog(`Received WebRTC OFFER from ${message.senderId.slice(0, 6)}`, 'info');
          remoteUserIdRef.current = message.senderId;
          setRemoteUserId(message.senderId);
          curWebRTC.setRoleAndRemotePeer(roleRef.current, message.senderId);
          setDiagnostics((prev) => ({ ...prev, remoteUserId: message.senderId }));

          const answer = await curWebRTC.handleOffer(message.payload);
          if (answer) {
            signaling.send({
              type: 'ANSWER',
              roomId: message.roomId,
              senderId: uid,
              targetId: message.senderId,
              payload: answer,
            });
            addLog('Sent WebRTC ANSWER via signaling (sendrecv)', 'success');
          }
          break;
        }

        case 'ANSWER': {
          addLog(`Received WebRTC ANSWER from ${message.senderId.slice(0, 6)}`, 'success');
          curWebRTC.setRoleAndRemotePeer(roleRef.current, message.senderId);
          await curWebRTC.handleAnswer(message.payload);
          break;
        }

        case 'ICE_CANDIDATE': {
          await curWebRTC.handleIceCandidate(message.payload);
          break;
        }

        case 'CHAT_MESSAGE': {
          console.log(`[CHAT RECEIVED]\nroom=${message.roomId}\nsender=${message.senderId}\nmessage="${message.message}"`);
          addLog(`[CHAT RECEIVED] From ${message.senderName || message.senderId.slice(0, 6)}: "${message.message}"`, 'info');

          const incomingMsg: ChatMessage = {
            id: message.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
            sender: message.senderName || (message.senderId === remoteUserIdRef.current ? 'Friend' : 'Host'),
            text: message.message,
            time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isLocal: false,
          };
          setMessages((prev) => [...prev, incomingMsg]);
          break;
        }

        case 'ROOM_ERROR': {
          console.log(`[ROOM] ROOM_ERROR client=${uid} room=${message.roomId} error=${message.message}`);
          setIsSubmitting(false);
          setErrorMessage(message.message);
          addLog(`Room Error: ${message.message}`, 'error');
          break;
        }

        case 'SCREEN_SHARE_STARTED': {
          console.log(`[SCREEN SHARE] Remote peer ${message.senderId} started sharing screen`);
          setIsScreenSharing(true);
          setScreenShareOwner('remote');
          curWebRTC.setRemoteScreenSharing(true, message.screenStreamId, message.screenTrackId);
          setDiagnostics((prev) => ({
            ...prev,
            isScreenSharing: true,
            screenShareOwner: 'remote',
          }));
          addLog(`[REMOTE SCREEN SHARE] Screen share active from ${message.senderId.slice(0, 8)}`, 'success');
          addSystemMessage(`${message.ownerName || 'Host'} started sharing their screen.`);
          break;
        }

        case 'SCREEN_SHARE_STOPPED': {
          console.log(`[SCREEN SHARE STOP] Remote peer ${message.senderId} stopped sharing screen`);
          setIsScreenSharing(false);
          setScreenShareOwner(null);
          setRemoteScreenStream(null);
          curWebRTC.setRemoteScreenSharing(false);
          setDiagnostics((prev) => ({
            ...prev,
            isScreenSharing: false,
            screenShareOwner: null,
          }));
          addLog('[SCREEN SHARE STOP] Remote screen sharing ended', 'info');
          addSystemMessage('Screen sharing ended.');
          break;
        }
      }
    });

    return () => {
      if (logFlushTimeoutRef.current) {
        window.clearTimeout(logFlushTimeoutRef.current);
      }
      unbindConnection();
      unbindReconnected();
      unbindMessage();
      webrtc.cleanupAll();
      signaling.disconnect();
    };
  }, []);

  // Request user camera and microphone
  const handleEnableMedia = async () => {
    try {
      addLog('Requesting camera and microphone access (getUserMedia)...', 'info');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 24 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const vTracks = stream.getVideoTracks();
      const aTracks = stream.getAudioTracks();

      const currentRole = roleRef.current || role;
      if (currentRole === 'participant') {
        console.log(
          `[PARTICIPANT LOCAL MEDIA]\n` +
          `stream.id: ${stream.id}\n` +
          `videoTracks.length: ${vTracks.length}\n` +
          `audioTracks.length: ${aTracks.length}\n` +
          stream.getTracks().map((t) =>
            `track.id: ${t.id}\n` +
            `track.kind: ${t.kind}\n` +
            `track.enabled: ${t.enabled}\n` +
            `track.readyState: ${t.readyState}\n` +
            `track.muted: ${t.muted}\n` +
            `track.settings: ${JSON.stringify(t.getSettings?.() || {})}`
          ).join('\n')
        );
      } else {
        console.log(
          `[HOST LOCAL MEDIA]\n` +
          `stream.id: ${stream.id}\n` +
          `videoTracks.length: ${vTracks.length}\n` +
          `audioTracks.length: ${aTracks.length}\n` +
          stream.getTracks().map((t) =>
            `track.id: ${t.id}\n` +
            `track.kind: ${t.kind}\n` +
            `track.enabled: ${t.enabled}\n` +
            `track.readyState: ${t.readyState}\n` +
            `track.muted: ${t.muted}\n` +
            `track.settings: ${JSON.stringify(t.getSettings?.() || {})}`
          ).join('\n')
        );
      }

      setLocalStream(stream);
      await webrtcRef.current?.setLocalStream(stream);

      setDiagnostics((prev) => ({
        ...prev,
        localVideoTrack: vTracks.length > 0,
        localAudioTrack: aTracks.length > 0,
        localStreamId: stream.id,
        localTrackIds: stream.getTracks().map((t) => `${t.kind}:${t.id.slice(0, 6)}`),
      }));

      addLog(
        `getUserMedia granted: ${vTracks.length} video, ${aTracks.length} audio tracks`,
        'success'
      );
      addSystemMessage(`${displayName} enabled camera and microphone.`);

      // If we are already in a room with a remote peer and peer connection has not yet negotiated, initiate offer
      const activeRemoteUser = remoteUserIdRef.current || remoteUserId;
      const activeRoom = roomIdRef.current || roomId;
      if (inRoom && activeRemoteUser && activeRoom) {
        // Always renegotiate: create a fresh SDP offer so both the initial case
        // (no remoteDescription yet) and the renegotiation case (participant
        // enables media after the host-initiated handshake is already done) work.
        addLog(`Sending WebRTC offer to remote peer ${activeRemoteUser.slice(0, 8)}...`, 'info');
        const offer = await webrtcRef.current?.createOffer();
        if (offer && signalingRef.current) {
          signalingRef.current.send({
            type: 'OFFER',
            roomId: activeRoom,
            senderId: localUserId,
            targetId: activeRemoteUser,
            payload: offer,
          });
          addLog('Sent WebRTC OFFER via signaling', 'success');
        }
      }
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera/Microphone permission denied. Please allow access in your browser bar.'
          : `Failed to access media devices: ${err.message || err}`;
      setErrorMessage(msg);
      addLog(msg, 'error');
    }
  };

  // Toggle local camera
  const handleToggleVideo = () => {
    const nextState = !videoEnabled;
    const ok = webrtcRef.current?.setVideoEnabled(nextState);
    if (ok) {
      setVideoEnabled(nextState);
      setDiagnostics((prev) => ({ ...prev, localVideoEnabled: nextState }));
    }
  };

  // Toggle local microphone
  const handleToggleAudio = () => {
    const nextState = !audioEnabled;
    const ok = webrtcRef.current?.setAudioEnabled(nextState);
    if (ok) {
      setAudioEnabled(nextState);
      setDiagnostics((prev) => ({ ...prev, localAudioEnabled: nextState }));
    }
  };

  // Phase 2: Screen Sharing Handlers
  const handleStartScreenShare = async () => {
    try {
      addLog('Opening browser display media picker (getDisplayMedia)...', 'info');
      const stream = await webrtcRef.current?.startScreenShare();
      if (stream) {
        setIsScreenSharing(true);
        setScreenShareOwner('local');
        setLocalScreenStream(stream);

        const currentRoom = roomIdRef.current || roomId;
        const activeRemoteUser = remoteUserIdRef.current || remoteUserId;
        const screenVideoTrack = stream.getVideoTracks()[0];
        if (signalingRef.current && currentRoom) {
          signalingRef.current.send({
            type: 'SCREEN_SHARE_STARTED',
            roomId: currentRoom,
            senderId: localUserId,
            ownerRole: role !== 'none' ? role : undefined,
            ownerName: displayName,
            screenStreamId: stream.id,
            screenTrackId: screenVideoTrack?.id,
          });

          // Renegotiate SDP with remote peer to establish second video track
          if (activeRemoteUser) {
            addLog(`Renegotiating WebRTC offer to transmit screen share to ${activeRemoteUser.slice(0, 8)}...`, 'info');
            const offer = await webrtcRef.current?.createOffer();
            if (offer && signalingRef.current) {
              signalingRef.current.send({
                type: 'OFFER',
                roomId: currentRoom,
                senderId: localUserId,
                targetId: activeRemoteUser,
                payload: offer,
              });
              addLog('Sent WebRTC OFFER with screen share track', 'success');
            }
          }
        }

        setDiagnostics((prev) => ({
          ...prev,
          isScreenSharing: true,
          screenShareOwner: 'local',
        }));

        addLog('Screen share broadcasting live via WebRTC', 'success');
        addSystemMessage(`${displayName} started sharing their screen.`);
      }
    } catch (err: any) {
      if (
        err.name !== 'NotAllowedError' &&
        err.name !== 'PermissionDeniedError' &&
        err.name !== 'AbortError'
      ) {
        setErrorMessage(`Screen sharing failed: ${err.message || err}`);
        addLog(`Screen sharing error: ${err.message || err}`, 'error');
      }
    }
  };

  const handleStopScreenShare = async () => {
    try {
      await webrtcRef.current?.stopScreenShare();
      setIsScreenSharing(false);
      setScreenShareOwner(null);
      setLocalScreenStream(null);

      const currentRoom = roomIdRef.current || roomId;
      const activeRemoteUser = remoteUserIdRef.current || remoteUserId;
      if (signalingRef.current && currentRoom) {
        signalingRef.current.send({
          type: 'SCREEN_SHARE_STOPPED',
          roomId: currentRoom,
          senderId: localUserId,
          ownerRole: role !== 'none' ? role : undefined,
        });

        // Renegotiate SDP removal of screen share track
        if (activeRemoteUser) {
          addLog('Renegotiating WebRTC offer after ending screen share...', 'info');
          const offer = await webrtcRef.current?.createOffer();
          if (offer && signalingRef.current) {
            signalingRef.current.send({
              type: 'OFFER',
              roomId: currentRoom,
              senderId: localUserId,
              targetId: activeRemoteUser,
              payload: offer,
            });
            addLog('Sent WebRTC OFFER after screen share stopped', 'info');
          }
        }
      }

      setDiagnostics((prev) => ({
        ...prev,
        isScreenSharing: false,
        screenShareOwner: null,
      }));

      addLog('Screen sharing stopped manually', 'info');
      addSystemMessage(`${displayName} stopped sharing their screen.`);
    } catch (err: any) {
      console.error('Error stopping screen share:', err);
    }
  };

  // Room lifecycle actions
  const handleCreateRoom = (params: {
    displayName: string;
    roomName: string;
    allowControl: boolean;
    allowShare: boolean;
  }) => {
    if (!signalingRef.current) return;
    setDisplayName(params.displayName);
    localStorage.setItem('wt_display_name', params.displayName);
    setRoomName(params.roomName || 'Movie Night');

    setErrorMessage(null);
    setIsSubmitting(true);
    console.log(`[ROOM] CREATE_REQUEST client=${localUserId} requestedRoom=null`);
    addLog(`[ROOM] CREATE_REQUEST: generating fresh room code...`, 'info');

    signalingRef.current.send({
      type: 'CREATE_ROOM',
      roomId: '',
      senderId: localUserId,
    });
  };

  const handleJoinRoom = (targetRoomId: string, name: string) => {
    if (!signalingRef.current) return;
    const cleanTarget = (targetRoomId || '').toUpperCase().trim();
    setDisplayName(name);
    localStorage.setItem('wt_display_name', name);

    setErrorMessage(null);
    setIsSubmitting(true);
    console.log(`[ROOM] JOIN_REQUEST client=${localUserId} room=${cleanTarget}`);
    addLog(`[ROOM] JOIN_REQUEST: joining room ${cleanTarget}...`, 'info');

    signalingRef.current.send({
      type: 'JOIN_ROOM',
      roomId: cleanTarget,
      senderId: localUserId,
    });
  };

  const handleLeaveRoom = () => {
    const currentRoom = roomIdRef.current;
    console.log(`[ROOM] LEAVE_ROOM client=${localUserId} room=${currentRoom}`);

    if (signalingRef.current && currentRoom) {
      signalingRef.current.send({
        type: 'LEAVE_ROOM',
        roomId: currentRoom,
        senderId: localUserId,
        userId: localUserId,
      });
    }

    // Clean session storage and URL parameters
    sessionStorage.removeItem('wt_room_id');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.pathname);
    } catch {
      // ignore in tests
    }

    setUrlRoomId('');
    setStoredRoomId('');
    roomIdRef.current = '';
    roleRef.current = 'none';
    inRoomRef.current = false;

    webrtcRef.current?.stopScreenShare();
    webrtcRef.current?.closePeerConnection();
    setIsScreenSharing(false);
    setScreenShareOwner(null);
    setLocalScreenStream(null);
    setInRoom(false);
    setRoomId('');
    setRole('none');
    setRemoteUserId(null);
    setRemoteStream(null);
    setMessages([]);
    setErrorMessage(null);
    setIsSubmitting(false);

    setDiagnostics((prev) => ({
      ...prev,
      roomId: '',
      serverRoomId: null,
      wsRoomId: null,
      urlRoomId: null,
      storedRoomId: null,
      role: 'none',
      remoteUserId: null,
      remoteVideoTrack: false,
      remoteAudioTrack: false,
      remoteStreamId: null,
      remoteTrackIds: [],
      connectionState: 'uninitialized',
      iceConnectionState: 'uninitialized',
      signalingState: 'uninitialized',
    }));
    addLog('[ROOM] Left room cleanly. Stored state purged.', 'info');
  };

  // Chat message sending
  const handleSendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const currentRoom = roomIdRef.current || roomId;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const newMsg: ChatMessage = {
      id: msgId,
      sender: displayName,
      text: trimmed,
      time,
      isLocal: true,
    };
    setMessages((prev) => [...prev, newMsg]);

    // Diagnostics log as requested
    console.log(`[CHAT SEND]\nroom=${currentRoom}\nsender=${localUserId}\nmessage="${trimmed}"`);
    addLog(`[CHAT SEND] "${trimmed}" to room ${currentRoom}`, 'info');

    // Transmit over WebSocket to server
    if (signalingRef.current && currentRoom) {
      signalingRef.current.send({
        type: 'CHAT_MESSAGE',
        roomId: currentRoom,
        senderId: localUserId,
        senderName: displayName,
        message: trimmed,
        id: msgId,
        time,
        timestamp: Date.now(),
      });
    } else {
      console.warn('[CHAT] Cannot send message: signaling connection missing or room inactive');
      addLog('[CHAT] Failed to send: not in an active room', 'error');
    }
  };

  // Compile participant list for sidebar
  const participantsList: Participant[] = [
    {
      id: localUserId,
      name: displayName,
      role: role === 'host' ? 'host' : 'participant',
      isLocal: true,
      hasVideo: localStream !== null && videoEnabled,
      hasAudio: localStream !== null && audioEnabled,
      isConnected: true,
    },
    ...(remoteUserId
      ? [
          {
            id: remoteUserId,
            name: remoteUserName,
            role: (role === 'host' ? 'participant' : 'host') as 'host' | 'participant',
            isLocal: false,
            hasVideo: remoteStream !== null && remoteStream.getVideoTracks().length > 0,
            hasAudio: remoteStream !== null && remoteStream.getAudioTracks().length > 0,
            isConnected: true,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#020306] text-slate-100 flex flex-col antialiased selection:bg-sky-500/20 selection:text-sky-300">
      {/* 1. LANDING PAGE (When not in room) */}
      {!inRoom ? (
        <LandingPage
          wsConnected={wsConnected}
          error={errorMessage}
          defaultUserName={displayName}
          initialRoomCode={urlRoomId || undefined}
          isSubmitting={isSubmitting}
          onToggleDiagnostics={() => setIsDiagnosticsModalOpen(!isDiagnosticsModalOpen)}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onClearError={() => setErrorMessage(null)}
        />
      ) : (
        /* 2. WATCH ROOM (When in room) */
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Top Bar */}
          <WatchRoomTopBar
            roomId={roomId}
            roomName={roomName}
            role={role}
            mediaTitle={mediaTitle}
            wsConnected={wsConnected}
            localStreamActive={localStream !== null}
            videoEnabled={videoEnabled}
            audioEnabled={audioEnabled}
            isScreenSharing={isScreenSharing}
            isHost={role === 'host'}
            activeSidebarTab={activeSidebarTab}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onSelectSidebarTab={(tab) => {
              setActiveSidebarTab(tab);
              setIsSidebarOpen(true);
            }}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
            onOpenMediaModal={() => setIsMediaModalOpen(true)}
            onStartScreenShare={handleStartScreenShare}
            onStopScreenShare={handleStopScreenShare}
            onToggleDiagnostics={() => setIsDiagnosticsModalOpen(!isDiagnosticsModalOpen)}
            onEnableMedia={handleEnableMedia}
            onToggleVideo={handleToggleVideo}
            onToggleAudio={handleToggleAudio}
            onLeaveRoom={handleLeaveRoom}
          />

          {/* Error Banner in Room */}
          {errorMessage && (
            <div className="w-full bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-2 text-xs flex items-center justify-between">
              <span className="font-medium">Notice: {errorMessage}</span>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-white underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Main Stage & Collaboration Workspace */}
          <main className="flex-1 w-full max-w-[1700px] mx-auto p-3 sm:p-5 flex flex-col lg:flex-row gap-4 sm:gap-5 min-h-0">
            {/* Left 75%: Media Player Stage + WebRTC Real Participant Video Tiles */}
            <MediaPlayerStage
              mediaTitle={mediaTitle}
              localStream={localStream}
              remoteStream={remoteStream}
              remoteScreenStream={remoteScreenStream}
              localUserId={localUserId}
              localUserName={displayName}
              remoteUserId={remoteUserId}
              remoteUserName={remoteUserName}
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              isHost={role === 'host'}
              isScreenSharing={isScreenSharing}
              screenShareOwner={screenShareOwner}
              screenStream={localScreenStream}
              onStartScreenShare={handleStartScreenShare}
              onStopScreenShare={handleStopScreenShare}
              onOpenMediaModal={() => setIsMediaModalOpen(true)}
              onOpenInviteModal={() => setIsInviteModalOpen(true)}
              onEnableMedia={handleEnableMedia}
            />

            {/* Right 25%: Collaboration Sidebar (Chat & People) */}
            {isSidebarOpen && (
              <Sidebar
                activeTab={activeSidebarTab}
                onTabChange={setActiveSidebarTab}
                messages={messages}
                participants={participantsList}
                onSendMessage={handleSendMessage}
                onOpenInviteModal={() => setIsInviteModalOpen(true)}
                className="shrink-0"
              />
            )}
          </main>
        </div>
      )}

      {/* Invite Friends Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        roomId={roomId}
        onClose={() => setIsInviteModalOpen(false)}
      />

      {/* Change Media Modal */}
      <ChangeMediaModal
        isOpen={isMediaModalOpen}
        currentMediaTitle={mediaTitle}
        isHost={role === 'host'}
        isScreenSharing={isScreenSharing && screenShareOwner === 'local'}
        onStartScreenShare={handleStartScreenShare}
        onStopScreenShare={handleStopScreenShare}
        onClose={() => setIsMediaModalOpen(false)}
        onSelectMovieTitle={(title) => setMediaTitle(title)}
      />

      {/* Diagnostics Modal */}
      {isDiagnosticsModalOpen && (
        <DiagnosticsPanel
          diagnostics={{
            ...diagnostics,
            renderCount: renderCountRef.current,
            wsTxCount: signalingRef.current?.getTxCount() ?? 0,
            wsRxCount: signalingRef.current?.getRxCount() ?? 0,
          }}
          isModal={true}
          onClose={() => setIsDiagnosticsModalOpen(false)}
          onClearLogs={() => {
            logsBufferRef.current = [];
            setDiagnostics((prev) => ({ ...prev, recentLogs: [] }));
          }}
        />
      )}
    </div>
  );
}
