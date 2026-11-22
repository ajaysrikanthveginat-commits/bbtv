import { captureDisplay } from "../shared/displayMedia";

export interface WebRTCEventCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onRemoteScreenStream?: (stream: MediaStream | null) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
  onSignalingStateChange: (state: RTCSignalingState) => void;
  onIceGatheringStateChange: (state: RTCIceGathererState) => void;
  onRenegotiationNeeded?: () => void;
  onScreenShareEnded?: () => void;
  onError: (error: string) => void;
  onLog: (text: string, level?: 'info' | 'warn' | 'error' | 'success') => void;
}

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream = new MediaStream();
  private remoteScreenStream: MediaStream = new MediaStream();
  private remoteScreenHasAudio = false;
  private captureVersion = 0;
  private remoteScreenStreamId: string | null = null;
  private remoteScreenTrackId: string | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private callbacks: WebRTCEventCallbacks;
  private isOfferer = false;
  private localUserId: string;
  private remoteUserId: string | null = null;
  private role: 'host' | 'participant' | 'none' = 'none';
  private isMakingOffer = false;
  private screenStream: MediaStream | null = null;
  private isRemoteScreenSharing = false;
  private statsTimer: number | null = null;

  constructor(
    callbacks: WebRTCEventCallbacks,
    localUserId: string = 'local',
    role: 'host' | 'participant' | 'none' = 'none'
  ) {
    this.callbacks = callbacks;
    this.localUserId = localUserId;
    this.role = role;
  }

  public setRoleAndRemotePeer(role: 'host' | 'participant' | 'none', remoteUserId: string | null): void {
    this.role = role;
    this.remoteUserId = remoteUserId;
    this.logPeerIdentity();
  }

  public getConfiguration(): RTCConfiguration {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 2,
    };
  }

  public logPeerIdentity(): void {
    const localRole = this.role.toUpperCase();
    const remoteRole = this.role === 'host' ? 'PARTICIPANT' : 'HOST';
    const direction = this.role === 'host' ? 'HOST → PARTICIPANT' : 'PARTICIPANT → HOST';

    console.log(
      `[WEBRTC]\n` +
      `LOCAL PEER: ${this.localUserId} (${localRole})\n` +
      `REMOTE PEER: ${this.remoteUserId || 'unknown'} (${remoteRole})\n` +
      `ROLE: ${localRole}\n` +
      `DIRECTION: ${direction}`
    );
  }

  public initPeerConnection(remotePeerId?: string, answering = false): RTCPeerConnection {
    if (remotePeerId) {
      this.remoteUserId = remotePeerId;
    }

    if (this.pc) {
      this.callbacks.onLog('Re-initializing existing PeerConnection; cleaning up old one first', 'warn');
      this.closePeerConnection();
    }

    this.logPeerIdentity();
    this.callbacks.onLog(
      `Initializing RTCPeerConnection for ${this.role.toUpperCase()} (peer=${this.remoteUserId || 'unknown'})`,
      'info'
    );

    const pc = new RTCPeerConnection(this.getConfiguration());
    this.pc = pc;
    this.remoteStream = new MediaStream();
    this.remoteScreenStream = new MediaStream();

    // SECTION 7 & 8: Pre-configure bidirectional audio and video transceivers
    // Both peers need to send and receive media.
    try {
      if (!answering) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
        // Separate senders keep microphone/camera updates independent of the presentation.
        pc.addTransceiver('video', { direction: 'sendrecv' });
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }
      this.callbacks.onLog(`Configured default transceivers (audio & video: sendrecv)`, 'info');
    } catch (err: any) {
      console.warn(`[TRANSCEIVER INIT WARNING]`, err);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(
          `[ICE CANDIDATE LOCAL] peer=${this.role.toUpperCase()} type=${event.candidate.type || 'unknown'} candidate=${event.candidate.candidate?.slice(0, 30)}...`
        );
        this.callbacks.onLog(`Local ICE candidate generated: ${event.candidate.type || 'candidate'}`, 'info');
        this.callbacks.onIceCandidate(event.candidate.toJSON());
      } else {
        this.callbacks.onLog('Local ICE gathering complete', 'info');
      }
    };

    // Diagnostic only: report ICE server/candidate gathering errors.
    pc.onicecandidateerror = (event) => {
      const e = event as any;
      const message =
        `[ICE CANDIDATE ERROR] ` +
        `code=${e.errorCode ?? 'unknown'} ` +
        `text=${e.errorText ?? 'unknown'} ` +
        `url=${e.url ?? 'unknown'}`;

      console.warn(message, e);
      this.callbacks.onLog(message, 'error');
    };

    pc.onconnectionstatechange = () => {
      this.callbacks.onLog(
        `Connection state changed: ${pc.connectionState}`,
        pc.connectionState === 'connected' ? 'success' : 'info'
      );
      this.callbacks.onConnectionStateChange(pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.logTransceivers();
        this.logSenders();
        this.logMediaDebug();
        this.startStatsMonitoring();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.stopStatsMonitoring();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;

      this.callbacks.onLog(
        `ICE connection state: ${state}`,
        state === 'connected' ? 'success' : state === 'failed' ? 'error' : 'info'
      );
      this.callbacks.onIceConnectionStateChange(state);

      // Diagnostic only. This does not modify ICE/WebRTC behavior.
      void this.logIceDiagnostics(`ICE state = ${state}`);
    };

    pc.onsignalingstatechange = () => {
      this.callbacks.onSignalingStateChange(pc.signalingState);
    };

    pc.onicegatheringstatechange = () => {
      this.callbacks.onIceGatheringStateChange(pc.iceGatheringState);
    };

    // SECTION 9: Check HOST ontrack and PARTICIPANT ontrack
    pc.ontrack = (event) => {
      const track = event.track;
      const receiver = event.receiver;
      const transceiver = event.transceiver;
      const streams = event.streams;
      const isHost = this.role === 'host';

      console.log(
        `[MEDIA DEBUG]\n` +
        `REMOTE TRACK:\n` +
        `kind: ${track.kind}\n` +
        `track.id: ${track.id}\n` +
        `stream.id: ${streams && streams[0] ? streams[0].id : this.remoteStream.id}\n` +
        `readyState: ${track.readyState}\n` +
        `muted: ${track.muted}`
      );

      if (isHost) {
        console.log(
          `[HOST ONTRACK]\n` +
          `sender: ${transceiver?.sender?.track?.id || 'none'}\n` +
          `receiver: ${receiver?.track?.id || 'none'}\n` +
          `track.id: ${track.id}\n` +
          `track.kind: ${track.kind}\n` +
          `stream.id: ${streams && streams[0] ? streams[0].id : 'none'}\n` +
          `track.readyState: ${track.readyState}\n` +
          `track.enabled: ${track.enabled}\n` +
          `track.muted: ${track.muted}\n` +
          `streams.length: ${streams ? streams.length : 0}`
        );
      } else {
        console.log(
          `[PARTICIPANT ONTRACK]\n` +
          `sender: ${transceiver?.sender?.track?.id || 'none'}\n` +
          `receiver: ${receiver?.track?.id || 'none'}\n` +
          `track.id: ${track.id}\n` +
          `track.kind: ${track.kind}\n` +
          `stream.id: ${streams && streams[0] ? streams[0].id : 'none'}\n` +
          `track.readyState: ${track.readyState}\n` +
          `track.enabled: ${track.enabled}\n` +
          `track.muted: ${track.muted}\n` +
          `streams.length: ${streams ? streams.length : 0}`
        );
      }

      const isScreenTrack = pc.getTransceivers().indexOf(transceiver) >= 2 ||
        (this.isRemoteScreenSharing && (track.id === this.remoteScreenTrackId ||
          streams.some(stream => stream.id === this.remoteScreenStreamId)));

      // Track frame delivery / unmute listeners
      track.onunmute = () => {
        console.log(
          `[MEDIA DEBUG]\n` +
          `REMOTE TRACK UNMUTED:\n` +
          `kind: ${track.kind}\n` +
          `track.id: ${track.id}\n` +
          `readyState: ${track.readyState}\n` +
          `muted: ${track.muted}`
        );
        console.log(`[REMOTE TRACK UNMUTE] role=${this.role.toUpperCase()} kind=${track.kind} id=${track.id} readyState=${track.readyState}`);
        this.callbacks.onLog(
          `[TRACK UNMUTE] Remote ${isScreenTrack ? 'screen' : track.kind} track received RTP packets: ${track.id.slice(0, 6)}`,
          'success'
        );
        if (isScreenTrack) {
          this.publishRemoteScreen();
        } else {
          this.callbacks.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
        }
      };

      track.onmute = () => {
        console.log(`[REMOTE TRACK MUTE] role=${this.role.toUpperCase()} kind=${track.kind} id=${track.id}`);
        this.callbacks.onLog(`[TRACK MUTE] Remote ${track.kind} track muted: ${track.id.slice(0, 6)}`, 'warn');
      };

      track.onended = () => {
        console.log(`[REMOTE TRACK ENDED] role=${this.role.toUpperCase()} kind=${track.kind} id=${track.id}`);
        this.callbacks.onLog(`[TRACK ENDED] Remote ${track.kind} track ended: ${track.id.slice(0, 6)}`, 'info');
        if (isScreenTrack) {
          this.remoteScreenStream.removeTrack(track);
          this.publishRemoteScreen();
        }
      };

      if (isScreenTrack) {
        // Remove stale tracks on screen stream
        this.remoteScreenStream.getTracks().forEach((oldTrack) => {
          if (oldTrack.kind === track.kind && oldTrack.id !== track.id) {
            this.remoteScreenStream.removeTrack(oldTrack);
          }
        });
        if (!this.remoteScreenStream.getTracks().some((t) => t.id === track.id)) {
          this.remoteScreenStream.addTrack(track);
        }
        this.callbacks.onLog(
          `Remote screen track attached: ${track.id.slice(0, 8)} (${this.remoteScreenStream.getVideoTracks().length}V)`,
          'success'
        );
        this.publishRemoteScreen();
      } else {
        // If a new video track arrives (e.g. renegotiation when participant enables camera),
        // remove stale video tracks so the live camera track is always at index 0
        if (track.kind === 'video') {
          this.remoteStream.getVideoTracks().forEach((oldTrack) => {
            if (oldTrack.id !== track.id) {
              this.remoteStream.removeTrack(oldTrack);
            }
          });
        }

        // Add track to our stable remote MediaStream instance if not already added
        const existingTracks = this.remoteStream.getTracks();
        const alreadyHasTrack = existingTracks.some((t) => t.id === track.id);

        if (!alreadyHasTrack) {
          this.remoteStream.addTrack(track);
        }

        console.log(
          `[REMOTE STREAM INSPECT]\n` +
          `remoteStream.id: ${this.remoteStream.id}\n` +
          `remoteStream.getTracks(): [${this.remoteStream.getTracks().map((t) => `${t.kind}:${t.id}`).join(', ')}]\n` +
          `remoteStream.getVideoTracks(): ${this.remoteStream.getVideoTracks().length}\n` +
          `remoteStream.getAudioTracks(): ${this.remoteStream.getAudioTracks().length}`
        );

        console.log(`REMOTE STREAM ID = ${this.remoteStream.id}`);

        this.callbacks.onLog(
          `Remote ${track.kind} track attached to stream ${this.remoteStream.id.slice(0, 8)} (${this.remoteStream.getVideoTracks().length}V / ${this.remoteStream.getAudioTracks().length}A)`,
          'success'
        );

        this.callbacks.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
      }
    };

    // If local stream already exists, add its tracks now
    if (this.localStream && !answering) {
      this.addLocalTracksToPC(pc);
    }

    return pc;
  }

  /**
   * Diagnostic-only ICE inspection.
   *
   * This intentionally does not change ICE configuration, signaling,
   * transceivers, tracks, or connection state. It only reads getStats()
   * so we can determine which candidate types were gathered and whether
   * Chrome selected a candidate pair.
   */
  private async logIceDiagnostics(reason: string): Promise<void> {
    if (!this.pc) return;

    try {
      const stats = await this.pc.getStats();
      const reports = new Map<string, any>();

      stats.forEach((report) => {
        reports.set(report.id, report);
      });

      const transport = [...reports.values()].find(
        (report) => report.type === 'transport'
      );

      const candidatePairs = [...reports.values()].filter(
        (report) => report.type === 'candidate-pair'
      );

      const selectedPairId = transport?.selectedCandidatePairId;

      const relevantPairs = candidatePairs.filter(
        (pair) =>
          pair.id === selectedPairId ||
          pair.selected === true ||
          pair.state === 'succeeded' ||
          pair.state === 'failed'
      );

      const pairMessages: string[] = [];

      for (const pair of relevantPairs) {
        const localCandidate = pair.localCandidateId
          ? reports.get(pair.localCandidateId)
          : undefined;

        const remoteCandidate = pair.remoteCandidateId
          ? reports.get(pair.remoteCandidateId)
          : undefined;

        pairMessages.push(
          [
            `state=${pair.state ?? 'unknown'}`,
            `local=${localCandidate?.candidateType ?? 'unknown'}`,
            `remote=${remoteCandidate?.candidateType ?? 'unknown'}`,
            `protocol=${localCandidate?.protocol ?? 'unknown'}`,
            `rtt=${pair.currentRoundTripTime ?? 'n/a'}`
          ].join(' ')
        );
      }

      const localTypes = [
        ...new Set(
          [...reports.values()]
            .filter((report) => report.type === 'local-candidate')
            .map((report) => report.candidateType)
            .filter(Boolean)
        )
      ];

      const remoteTypes = [
        ...new Set(
          [...reports.values()]
            .filter((report) => report.type === 'remote-candidate')
            .map((report) => report.candidateType)
            .filter(Boolean)
        )
      ];

      const message =
        `[ICE DIAGNOSTIC] ${reason} | ` +
        `transport=${transport?.iceState ?? 'unknown'} ` +
        `dtls=${transport?.dtlsState ?? 'unknown'} ` +
        `selectedPair=${selectedPairId ?? 'none'} | ` +
        `localCandidates=[${localTypes.join(', ') || 'none'}] ` +
        `remoteCandidates=[${remoteTypes.join(', ') || 'none'}] | ` +
        `pairs=${pairMessages.join(' || ') || 'none'}`;

      console.log(message);
      this.callbacks.onLog(message, 'info');
    } catch (error) {
      console.warn('[ICE DIAGNOSTIC] getStats failed:', error);
    }
  }

  // SECTION 4: Attach participant/host local tracks to RTCPeerConnection transceivers
  public async addLocalTracksToPC(pc: RTCPeerConnection): Promise<void> {
    if (!this.localStream) return;

    const roleName = this.role === 'host' ? 'HOST' : 'PARTICIPANT';
    const targetName = this.role === 'host' ? 'PARTICIPANT' : 'HOST';

    for (const track of this.localStream.getTracks()) {
      const matches = pc.getTransceivers().slice(0, 2).filter(
        (t) => t.receiver.track.kind === track.kind,
      );
      // Prefer negotiated media sections to unassigned transceivers.
      const transceiver = matches.find((t) => t.mid !== null) ?? matches[0];

      if (transceiver) {
        // Guarantee sendrecv direction so sending media is permitted
        transceiver.direction = 'sendrecv';
        if (transceiver.sender.track?.id !== track.id) {
          try {
            await transceiver.sender.replaceTrack(track);
          } catch (err: any) {
            console.warn(`[REPLACE TRACK ERROR] kind=${track.kind}`, err);
          }
        }
      } else {
        pc.addTrack(track, this.localStream);
      }

      console.log(
        `[ADD TRACK]\n` +
        `sender=${roleName}\n` +
        `target=${targetName}\n` +
        `kind=${track.kind}\n` +
        `trackId=${track.id}`
      );
      this.callbacks.onLog(
        `[ADD TRACK] sender=${roleName} target=${targetName} kind=${track.kind} trackId=${track.id.slice(0, 8)}`,
        'info'
      );
    }

    // Inspect state immediately after adding tracks
    this.logSenders();
    this.logTransceivers();
    this.logMediaDebug();
  }

  public logMediaDebug(): void {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    const audioTrack = this.localStream?.getAudioTracks()[0];

    const senders = this.pc ? this.pc.getSenders() : [];
    const audioSender = senders.find(
      (s) => s.track?.kind === 'audio' || (!s.track && this.pc?.getTransceivers().find((t) => t.sender === s && t.receiver.track.kind === 'audio'))
    );
    const videoSender = senders.find(
      (s) => s.track?.kind === 'video' || (!s.track && this.pc?.getTransceivers().find((t) => t.sender === s && t.receiver.track.kind === 'video'))
    );

    const transceivers = this.pc ? this.pc.getTransceivers() : [];
    const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio');
    const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video');

    console.log(
      `[MEDIA DEBUG]\n` +
      `LOCAL CAMERA:\n` +
      `track.id: ${videoTrack ? videoTrack.id : 'none'}\n` +
      `enabled: ${videoTrack ? videoTrack.enabled : false}\n` +
      `readyState: ${videoTrack ? videoTrack.readyState : 'none'}\n` +
      `muted: ${videoTrack ? videoTrack.muted : false}\n\n` +
      `LOCAL MICROPHONE:\n` +
      `track.id: ${audioTrack ? audioTrack.id : 'none'}\n` +
      `enabled: ${audioTrack ? audioTrack.enabled : false}\n` +
      `readyState: ${audioTrack ? audioTrack.readyState : 'none'}\n` +
      `muted: ${audioTrack ? audioTrack.muted : false}\n\n` +
      `SENDERS:\n` +
      `audio sender.track: ${audioSender?.track ? `${audioSender.track.kind}:${audioSender.track.id}` : 'null'}\n` +
      `video sender.track: ${videoSender?.track ? `${videoSender.track.kind}:${videoSender.track.id}` : 'null'}\n\n` +
      `TRANSCEIVERS:\n` +
      `audio direction/currentDirection: ${audioTransceiver ? `${audioTransceiver.direction}/${audioTransceiver.currentDirection}` : 'none'}\n` +
      `video direction/currentDirection: ${videoTransceiver ? `${videoTransceiver.direction}/${videoTransceiver.currentDirection}` : 'none'}`
    );
  }

  public async setLocalStream(stream: MediaStream): Promise<void> {
    this.localStream = stream;
    this.callbacks.onLog(`Local stream attached: ${stream.id}, tracks=${stream.getTracks().length}`, 'info');

    if (this.pc) {
      await this.addLocalTracksToPC(this.pc);
    }
    this.logMediaDebug();
  }

  // SECTION 5: Inspect RTCRtpSender
  public logSenders(): void {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    console.log(`[RTCRtpSender INSPECTION] role=${this.role.toUpperCase()} count=${senders.length}`);
    senders.forEach((sender, idx) => {
      const track = sender.track;
      console.log(
        `[RTCRtpSender ${idx}]\n` +
        `sender.track.kind: ${track ? track.kind : 'null'}\n` +
        `sender.track.id: ${track ? track.id : 'null'}\n` +
        `sender.track.readyState: ${track ? track.readyState : 'null'}\n` +
        `sender.track.enabled: ${track ? track.enabled : 'null'}`
      );
    });
  }

  // SECTION 8: Inspect Transceivers
  public logTransceivers(): void {
    if (!this.pc) return;
    const transceivers = this.pc.getTransceivers();
    const roleName = this.role === 'host' ? 'HOST' : 'PARTICIPANT';
    const remoteRoleName = this.role === 'host' ? 'PARTICIPANT' : 'HOST';

    console.log(`[TRANSCEIVERS INSPECTION] peer=${roleName} count=${transceivers.length}`);
    transceivers.forEach((t, idx) => {
      console.log(
        `[TRANSCEIVER ${idx}]\n` +
        `local peer: ${roleName} (${this.localUserId})\n` +
        `remote peer: ${remoteRoleName} (${this.remoteUserId || 'unknown'})\n` +
        `kind: ${t.receiver.track.kind}\n` +
        `direction: ${t.direction}\n` +
        `currentDirection: ${t.currentDirection}\n` +
        `sender.track: ${t.sender.track ? `${t.sender.track.kind}:${t.sender.track.id}` : 'null'}\n` +
        `receiver.track: ${t.receiver.track ? `${t.receiver.track.kind}:${t.receiver.track.id}` : 'null'}`
      );
    });
  }

  // SECTION 6: Inspect SDP media sections and directions
  private inspectSDP(type: 'LOCAL' | 'REMOTE', sdpStr: string | undefined): void {
    if (!sdpStr) return;
    const lines = sdpStr.split('\r\n');
    let currentMedia: string | null = null;
    const mediaSummaries: { media: string; direction: string }[] = [];

    for (const line of lines) {
      if (line.startsWith('m=')) {
        currentMedia = line.split(' ')[0].substring(2); // 'audio' or 'video'
      } else if (
        currentMedia &&
        (line === 'a=sendrecv' || line === 'a=recvonly' || line === 'a=sendonly' || line === 'a=inactive')
      ) {
        mediaSummaries.push({ media: currentMedia, direction: line.substring(2) });
        currentMedia = null;
      }
    }

    console.log(
      `[SDP INSPECTION ${type}]\n` +
      `role=${this.role.toUpperCase()} client=${this.localUserId}\n` +
      `media sections:\n` +
      mediaSummaries.map((m) => `  m=${m.media} -> direction=${m.direction}`).join('\n')
    );

    this.callbacks.onLog(
      `SDP ${type} (${this.role.toUpperCase()}): ${mediaSummaries.map((m) => `${m.media}:${m.direction}`).join(', ')}`,
      'info'
    );
  }

  // SECTION 7: Create OFFER
  public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) {
      this.initPeerConnection();
    }
    const pc = this.pc!;

    if (this.isMakingOffer || pc.signalingState !== 'stable') {
      this.callbacks.onLog(`[OFFER CREATE] Skipping: signalingState is ${pc.signalingState} (not stable)`, 'warn');
      return null;
    }

    this.isOfferer = true;
    this.isMakingOffer = true;

    try {
      this.callbacks.onLog(`[OFFER CREATE] Initiating offer as ${this.role.toUpperCase()}...`, 'info');

      for (const transceiver of pc.getTransceivers()) transceiver.direction = 'sendrecv';
      await this.addLocalTracksToPC(pc);
      await this.attachScreenTracks(pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      if (pc !== this.pc || pc.signalingState !== 'stable') return null;
      await pc.setLocalDescription(offer);
      this.inspectSDP('LOCAL', pc.localDescription?.sdp);
      this.logTransceivers();
      this.logSenders();
      this.logMediaDebug();

      this.callbacks.onLog('Local description set with OFFER (sendrecv)', 'success');
      return pc.localDescription?.toJSON() as RTCSessionDescriptionInit;
    } catch (err: any) {
      const errorMsg = `Failed to create WebRTC offer: ${err.message || err}`;
      this.callbacks.onLog(errorMsg, 'error');
      this.callbacks.onError(errorMsg);
      return null;
    } finally {
      this.isMakingOffer = false;
    }
  }

  // SECTION 7: Handle OFFER & Create ANSWER with bidirectional sendrecv
  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) {
      this.initPeerConnection(undefined, true);
    }
    const pc = this.pc!;
    const collision = this.isMakingOffer || pc.signalingState !== 'stable';
    if (collision && this.role === 'host') {
      this.callbacks.onLog('Ignoring a colliding offer. The participant can answer the host offer.', 'info');
      return null;
    }
    this.isOfferer = false;

    try {
      this.callbacks.onLog(
        `Received OFFER from remote peer, setting remote description on ${this.role.toUpperCase()}...`,
        'info'
      );

      if (pc.signalingState !== 'stable') {
        if (this.role === 'participant' && pc.signalingState === 'have-local-offer') {
          this.callbacks.onLog('Offer collision detected on participant: rolling back local offer', 'info');
          await pc.setLocalDescription({ type: 'rollback' });
        }
      }

      this.inspectSDP('REMOTE', offer.sdp);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      this.callbacks.onLog('Remote description set from OFFER', 'success');

      // Process any queued candidates
      await this.drainPendingCandidates();

      for (const transceiver of pc.getTransceivers()) transceiver.direction = 'sendrecv';
      await this.addLocalTracksToPC(pc);
      await this.attachScreenTracks(pc);

      this.callbacks.onLog(`Creating WebRTC answer as ${this.role.toUpperCase()} (sendrecv)...`, 'info');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.inspectSDP('LOCAL', pc.localDescription?.sdp);
      this.logTransceivers();
      this.logSenders();
      this.logMediaDebug();

      this.callbacks.onLog('Local description set with ANSWER (sendrecv)', 'success');
      return pc.localDescription?.toJSON() as RTCSessionDescriptionInit;
    } catch (err: any) {
      const errorMsg = `Failed to handle WebRTC offer: ${err.message || err}`;
      this.callbacks.onLog(errorMsg, 'error');
      this.callbacks.onError(errorMsg);
      return null;
    }
  }

  // Handle incoming ANSWER
  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) {
      this.callbacks.onLog('Cannot handle answer: PeerConnection is not initialized', 'error');
      return;
    }
    const pc = this.pc;

    try {
      this.callbacks.onLog(
        `Received ANSWER from remote peer, setting remote description on ${this.role.toUpperCase()}...`,
        'info'
      );
      this.inspectSDP('REMOTE', answer.sdp);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.callbacks.onLog('Remote description set from ANSWER', 'success');

      await this.drainPendingCandidates();
      this.logTransceivers();
      this.logSenders();
    } catch (err: any) {
      const errorMsg = `Failed to set remote description from answer: ${err.message || err}`;
      this.callbacks.onLog(errorMsg, 'error');
      this.callbacks.onError(errorMsg);
    }
  }

  public async handleIceCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
    if (!candidateInit || !candidateInit.candidate) return;

    console.log(`[ICE CANDIDATE REMOTE] role=${this.role.toUpperCase()} candidate=${candidateInit.candidate.slice(0, 30)}...`);

    if (!this.pc || !this.pc.remoteDescription) {
      this.callbacks.onLog('Queuing ICE candidate (remote description not ready yet)', 'info');
      this.pendingCandidates.push(candidateInit);
      return;
    }

    try {
      await this.pc.addIceCandidate(candidateInit);
      const candSnippet = candidateInit.candidate ? `${candidateInit.candidate.slice(0, 30)}...` : 'candidate';
      this.callbacks.onLog(`Added remote ICE candidate: ${candSnippet}`, 'info');
    } catch (err: any) {
      this.callbacks.onLog(`Failed to add ICE candidate: ${err.message || err}`, 'warn');
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;

    if (this.pendingCandidates.length > 0) {
      this.callbacks.onLog(`Draining ${this.pendingCandidates.length} queued ICE candidates...`, 'info');
      while (this.pendingCandidates.length > 0) {
        const cand = this.pendingCandidates.shift();
        if (cand && cand.candidate) {
          try {
            await this.pc.addIceCandidate(cand);
          } catch (err: any) {
            this.callbacks.onLog(`Error draining candidate: ${err.message || err}`, 'warn');
          }
        }
      }
    }
  }

  public setVideoEnabled(enabled: boolean): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = enabled;
    });
    this.callbacks.onLog(`Local camera ${enabled ? 'ENABLED' : 'DISABLED'}`, 'info');
    this.logMediaDebug();
    return videoTracks.length > 0;
  }

  public setAudioEnabled(enabled: boolean): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = enabled;
    });
    this.callbacks.onLog(`Local microphone ${enabled ? 'UNMUTED' : 'MUTED'}`, 'info');
    this.logMediaDebug();
    return audioTracks.length > 0;
  }

  private publishRemoteScreen() {
    if (!this.isRemoteScreenSharing) return;
    const video = this.remoteScreenStream.getVideoTracks();
    const audio = this.remoteScreenHasAudio ? this.remoteScreenStream.getAudioTracks() : [];
    this.callbacks.onRemoteScreenStream?.(video.length ? new MediaStream([...video, ...audio]) : null);
  }

  public setRemoteScreenSharing(active: boolean, screenStreamId?: string, screenTrackId?: string, audio = false): void {
    this.isRemoteScreenSharing = active;
    this.remoteScreenStreamId = screenStreamId || null;
    this.remoteScreenTrackId = screenTrackId || null;
    this.remoteScreenHasAudio = audio;
    if (active) this.publishRemoteScreen();
    else this.callbacks.onRemoteScreenStream?.(null);
  }

  public isRemoteScreenSharingActive(): boolean {
    return this.isRemoteScreenSharing;
  }

  public getLocalScreenStream() {
    return this.screenStream;
  }

  private async attachScreenTracks(pc: RTCPeerConnection) {
    const presentation = pc.getTransceivers().slice(2, 4);
    await Promise.all(presentation.map(({sender, receiver}) => {
      const track = this.screenStream?.getTracks().find(item =>
        item.kind === receiver.track.kind && item.readyState === 'live'
      ) ?? null;
      if (sender.track !== track) return sender.replaceTrack(track);
    }));
  }

  public async startScreenShare(): Promise<MediaStream> {
    const version = ++this.captureVersion;
    const stream = await captureDisplay();
    const video = stream.getVideoTracks()[0];
    if (!video || version !== this.captureVersion) {
      stream.getTracks().forEach(track => track.stop());
      throw new DOMException('Screen sharing ended', 'AbortError');
    }
    this.screenStream?.getTracks().forEach(track => track.stop());
    this.screenStream = stream;
    video.onended = async () => {
      if (this.screenStream !== stream) return;
      await this.stopScreenShare();
      this.callbacks.onScreenShareEnded?.();
    };
    try {
      if (this.pc) await this.attachScreenTracks(this.pc);
      return stream;
    } catch (error) {
      if (this.screenStream === stream) await this.stopScreenShare();
      throw error;
    }
  }

  public async stopScreenShare(): Promise<void> {
    ++this.captureVersion;
    this.screenStream?.getTracks().forEach(track => track.stop());
    this.screenStream = null;
    if (this.pc) await this.attachScreenTracks(this.pc);
  }

  public startStatsMonitoring(): void {
    if (this.statsTimer !== null) return;
    this.pollRTPStats();
    this.statsTimer = window.setInterval(() => {
      this.pollRTPStats();
    }, 3000);
  }

  public stopStatsMonitoring(): void {
    if (this.statsTimer !== null) {
      window.clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  public async pollRTPStats(): Promise<void> {
    if (!this.pc) return;
    const pc = this.pc;
    if (pc.connectionState !== 'connected' && pc.iceConnectionState !== 'connected') return;

    try {
      const stats = await pc.getStats();
      let outboundVideo: any = null;
      let outboundAudio: any = null;
      let inboundVideo: any = null;
      let inboundAudio: any = null;
      let selectedCandidatePair: any = null;
      const codecs: Map<string, any> = new Map();

      stats.forEach((report) => {
        if (report.type === 'codec') {
          codecs.set(report.id, report);
        } else if (report.type === 'outbound-rtp' && report.kind === 'video') {
          outboundVideo = report;
        } else if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          outboundAudio = report;
        } else if (report.type === 'inbound-rtp' && report.kind === 'video') {
          inboundVideo = report;
        } else if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          inboundAudio = report;
        } else if (
          report.type === 'candidate-pair' &&
          (report.selected || report.nominated || report.state === 'succeeded')
        ) {
          if (!selectedCandidatePair || report.selected) {
            selectedCandidatePair = report;
          }
        }
      });

      const senders = pc.getSenders();
      const videoSender = senders.find(
        (s) =>
          s.track?.kind === 'video' ||
          (!s.track && pc.getTransceivers().find((t) => t.sender === s && t.receiver.track.kind === 'video'))
      );
      const audioSender = senders.find(
        (s) =>
          s.track?.kind === 'audio' ||
          (!s.track && pc.getTransceivers().find((t) => t.sender === s && t.receiver.track.kind === 'audio'))
      );

      const vSenderTrack = videoSender?.track;
      const aSenderTrack = audioSender?.track;

      if (outboundVideo) {
        console.log(
          `[OUTBOUND VIDEO RTP]\n` +
          `role: ${this.role.toUpperCase()}\n` +
          `packetsSent: ${outboundVideo.packetsSent ?? 0}\n` +
          `bytesSent: ${outboundVideo.bytesSent ?? 0}\n` +
          `framesEncoded: ${outboundVideo.framesEncoded ?? 0}\n` +
          `framesSent: ${outboundVideo.framesSent ?? 0}\n` +
          `keyFramesEncoded: ${outboundVideo.keyFramesEncoded ?? 0}\n` +
          `frameWidth: ${outboundVideo.frameWidth ?? (vSenderTrack?.getSettings?.().width || 'N/A')}\n` +
          `frameHeight: ${outboundVideo.frameHeight ?? (vSenderTrack?.getSettings?.().height || 'N/A')}\n` +
          `sender.track.id: ${vSenderTrack ? vSenderTrack.id : 'null'}\n` +
          `sender.track.readyState: ${vSenderTrack ? vSenderTrack.readyState : 'null'}\n` +
          `sender.track.enabled: ${vSenderTrack ? vSenderTrack.enabled : false}\n` +
          `sender.track.muted: ${vSenderTrack ? vSenderTrack.muted : false}`
        );
      }

      if (outboundAudio) {
        console.log(
          `[OUTBOUND AUDIO RTP]\n` +
          `role: ${this.role.toUpperCase()}\n` +
          `packetsSent: ${outboundAudio.packetsSent ?? 0}\n` +
          `bytesSent: ${outboundAudio.bytesSent ?? 0}\n` +
          `totalAudioEnergy: ${outboundAudio.totalAudioEnergy ?? 'N/A'}\n` +
          `sender.track.id: ${aSenderTrack ? aSenderTrack.id : 'null'}\n` +
          `sender.track.readyState: ${aSenderTrack ? aSenderTrack.readyState : 'null'}\n` +
          `sender.track.enabled: ${aSenderTrack ? aSenderTrack.enabled : false}\n` +
          `sender.track.muted: ${aSenderTrack ? aSenderTrack.muted : false}`
        );
      }

      if (inboundVideo) {
        console.log(
          `[INBOUND VIDEO RTP]\n` +
          `role: ${this.role.toUpperCase()}\n` +
          `packetsReceived: ${inboundVideo.packetsReceived ?? 0}\n` +
          `bytesReceived: ${inboundVideo.bytesReceived ?? 0}\n` +
          `framesReceived: ${inboundVideo.framesReceived ?? 0}\n` +
          `framesDecoded: ${inboundVideo.framesDecoded ?? 0}\n` +
          `framesDropped: ${inboundVideo.framesDropped ?? 0}\n` +
          `frameWidth: ${inboundVideo.frameWidth ?? 'N/A'}\n` +
          `frameHeight: ${inboundVideo.frameHeight ?? 'N/A'}\n` +
          `jitter: ${inboundVideo.jitter ?? 0}\n` +
          `packetsLost: ${inboundVideo.packetsLost ?? 0}`
        );
      }

      if (inboundAudio) {
        console.log(
          `[INBOUND AUDIO RTP]\n` +
          `role: ${this.role.toUpperCase()}\n` +
          `packetsReceived: ${inboundAudio.packetsReceived ?? 0}\n` +
          `bytesReceived: ${inboundAudio.bytesReceived ?? 0}\n` +
          `jitter: ${inboundAudio.jitter ?? 0}\n` +
          `packetsLost: ${inboundAudio.packetsLost ?? 0}\n` +
          `totalAudioEnergy: ${inboundAudio.totalAudioEnergy ?? 'N/A'}`
        );
      }

      if (selectedCandidatePair) {
        console.log(
          `[SELECTED ICE CANDIDATE PAIR]\n` +
          `state: ${selectedCandidatePair.state}\n` +
          `nominated: ${selectedCandidatePair.nominated}\n` +
          `selected: ${selectedCandidatePair.selected ?? false}\n` +
          `currentRoundTripTime: ${selectedCandidatePair.currentRoundTripTime ?? 'N/A'}\n` +
          `bytesSent: ${selectedCandidatePair.bytesSent ?? 0}\n` +
          `bytesReceived: ${selectedCandidatePair.bytesReceived ?? 0}`
        );
      }

      const vCodec = outboundVideo ? codecs.get(outboundVideo.codecId) : inboundVideo ? codecs.get(inboundVideo.codecId) : null;
      const aCodec = outboundAudio ? codecs.get(outboundAudio.codecId) : inboundAudio ? codecs.get(inboundAudio.codecId) : null;
      if (vCodec || aCodec) {
        console.log(
          `[CODEC CHECK]\n` +
          `video codec: ${vCodec ? `${vCodec.mimeType} (clockRate=${vCodec.clockRate})` : 'unknown'}\n` +
          `audio codec: ${aCodec ? `${aCodec.mimeType} (clockRate=${aCodec.clockRate})` : 'unknown'}`
        );
      }
    } catch (err) {
      console.warn('[RTP STATS POLL ERROR]', err);
    }
  }

  public getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  public getRemoteStream(): MediaStream {
    return this.remoteStream;
  }

  public getRemoteScreenStream(): MediaStream {
    return this.remoteScreenStream;
  }

  public closePeerConnection(): void {
    this.stopStatsMonitoring();
    if (this.pc) {
      this.callbacks.onLog('Closing RTCPeerConnection', 'info');
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onsignalingstatechange = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.pendingCandidates = [];
    this.remoteStream.getTracks().forEach((track) => {
      track.stop();
      this.remoteStream.removeTrack(track);
    });
    this.remoteScreenStream.getTracks().forEach((track) => {
      track.stop();
      this.remoteScreenStream.removeTrack(track);
    });
    this.remoteScreenStreamId = null;
    this.remoteScreenTrackId = null;
    this.isRemoteScreenSharing = false;
    this.remoteScreenHasAudio = false;
  }

  public cleanupAll(): void {
    this.stopScreenShare().catch(() => {});
    this.closePeerConnection();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
      this.callbacks.onLog('Local media tracks stopped', 'info');
    }
  }
}
