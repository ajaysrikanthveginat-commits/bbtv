import type { MediaSignal, Member } from "./protocol";

export type MediaSlot = "audio" | "camera" | "screen" | "screenAudio";
type Media = { call: MediaStream; screen: MediaStream };
const slots: MediaSlot[] = ["audio", "camera", "screen", "screenAudio"];

interface Peer {
  pc: RTCPeerConnection;
  initiator: boolean;
  candidates: RTCIceCandidateInit[];
  jobs: Promise<void>;
  attempts: number;
}

export class RoomMedia {
  private peers = new Map<string, Peer>();
  private tracks: Partial<Record<MediaSlot, MediaStreamTrack>> = {};

  constructor(
    private own: string,
    private iceServers: RTCIceServer[],
    private send: (to: string, signal: MediaSignal) => void,
    private onMedia: (id: string, media: Media | null) => void,
    private onProblem: (message: string) => void,
  ) {}

  sync(members: Member[]) {
    const ids = new Set(members.filter(member => member.id !== this.own).map(member => member.id));
    for (const [id, peer] of this.peers) {
      if (!ids.has(id)) {
        peer.pc.close();
        this.peers.delete(id);
        this.onMedia(id, null);
      }
    }
    if (typeof RTCPeerConnection !== "undefined") for (const id of ids) this.peer(id);
  }

  private enqueue(peer: Peer, job: () => Promise<void>) {
    peer.jobs = peer.jobs.then(async () => {
      if (peer.pc.signalingState !== "closed") await job();
    }).catch(() => {
      if (peer.pc.signalingState !== "closed") this.onProblem("A call connection failed. Rejoin the room to retry.");
    });
    return peer.jobs;
  }

  private peer(id: string): Peer {
    const existing = this.peers.get(id);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    // Exactly one browser offers for this pair for the lifetime of the connection.
    const peer: Peer = { pc, initiator: this.own < id, candidates: [], jobs: Promise.resolve(), attempts: 0 };
    this.peers.set(id, peer);
    const call = new MediaStream();
    const screen = new MediaStream();
    pc.ontrack = event => {
      const index = pc.getTransceivers().indexOf(event.transceiver);
      (slots[index] === "screen" || slots[index] === "screenAudio" ? screen : call).addTrack(event.track);
      this.onMedia(id, { call: new MediaStream(call.getTracks()), screen: new MediaStream(screen.getTracks()) });
    };
    pc.onicecandidate = event => { if (event.candidate) this.send(id, { candidate: event.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") peer.attempts = 0;
      if (pc.connectionState === "failed") {
        if (peer.attempts >= 2) {
          this.onProblem("A participant’s call connection failed. Try rejoining on a different network.");
          return;
        }
        if (peer.initiator) this.offer(id, peer, true);
        else {
          peer.attempts++;
          this.send(id, { retry: true });
        }
      }
    };
    if (peer.initiator) {
      for (const slot of slots) pc.addTransceiver(slot === "audio" || slot === "screenAudio" ? "audio" : "video", { direction: "sendrecv" });
      this.offer(id, peer);
    }
    return peer;
  }

  private offer(id: string, peer: Peer, restart = false) {
    this.enqueue(peer, async () => {
      const pc = peer.pc;
      if (pc.signalingState !== "stable" || (restart && peer.attempts >= 2)) return;
      if (restart) peer.attempts++;
      await this.attach(peer);
      await pc.setLocalDescription(await pc.createOffer({ iceRestart: restart }));
      if (pc.localDescription) this.send(id, { sdp: pc.localDescription.toJSON() });
    });
  }

  receive(id: string, signal: MediaSignal) {
    const peer = this.peer(id);
    const pc = peer.pc;
    if ("retry" in signal) {
      if (peer.initiator) this.offer(id, peer, true);
      return;
    }
    this.enqueue(peer, async () => {
      if ("candidate" in signal) {
        if (!pc.remoteDescription) peer.candidates.push(signal.candidate);
        else await pc.addIceCandidate(signal.candidate);
        return;
      }
      if (!signal.sdp || (peer.initiator ? signal.sdp.type !== "answer" : signal.sdp.type !== "offer")) return;
      await pc.setRemoteDescription(signal.sdp);
      if (!peer.initiator) {
        for (const transceiver of pc.getTransceivers()) transceiver.direction = "sendrecv";
        await this.attach(peer);
        await pc.setLocalDescription(await pc.createAnswer());
        if (pc.localDescription) this.send(id, { sdp: pc.localDescription.toJSON() });
      }
      for (const candidate of peer.candidates.splice(0)) await pc.addIceCandidate(candidate);
    });
  }

  private async attach(peer: Peer) {
    await Promise.all(peer.pc.getTransceivers().slice(0, slots.length).map(async (entry, index) => {
      const track = this.tracks[slots[index]];
      await entry.sender.replaceTrack(track?.readyState === "live" ? track : null);
    }));
  }

  setTrack(slot: MediaSlot, track?: MediaStreamTrack) {
    this.tracks[slot] = track;
    return Promise.all([...this.peers.values()].map(peer => this.enqueue(peer, () => this.attach(peer))));
  }

  close() {
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
  }
}
