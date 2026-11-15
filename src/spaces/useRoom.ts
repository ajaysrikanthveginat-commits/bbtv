import { useCallback, useEffect, useRef, useState } from "react";
import { RoomMedia } from "./mesh";
import type { RoomEvent, RoomRequest, Space } from "./protocol";

type Entry = Extract<RoomRequest, { type: "create" | "join" }>;
type Slot = "camera" | "audio" | "screen";
type Incoming = { call: MediaStream; screen: MediaStream };
export function readLocal(key: string): string {
  try { return localStorage.getItem(key) || ""; } catch { return ""; }
}
export function writeLocal(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* browser storage is optional */ }
}

export function useRoom() {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  const [persistent, setPersistent] = useState(false);
  const [offset, setOffset] = useState(0);
  const [remote, setRemote] = useState<Record<string, Incoming>>({});
  const [local, setLocal] = useState<Partial<Record<Slot, MediaStreamTrack>>>({});
  const socket = useRef<WebSocket | null>(null);
  const media = useRef<RoomMedia | null>(null);
  const devices = useRef<Partial<Record<Slot, MediaStreamTrack>>>({});
  const busy = useRef(new Set<Slot>());
  const present = useRef(false);
  const fail = useCallback((message: string) => setError(message), []);
  const send = useCallback((action: RoomRequest) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(action));
    return true;
  }, []);

  const setTrack = useCallback((slot: Slot, track?: MediaStreamTrack) => {
    devices.current[slot]?.stop();
    devices.current = { ...devices.current, [slot]: track };
    void media.current?.setTrack(slot, track);
    setLocal(devices.current);
  }, []);
  const stopTracks = useCallback(() => {
    for (const track of Object.values(devices.current)) track?.stop();
    devices.current = {};
    present.current = false;
    setLocal({});
  }, []);
  function begin(action: Entry) { setError(""); setEntry(action); }

  useEffect(() => {
    if (!entry) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;
    let requested = entry;
    let initialError = false;
    let joined = false;
    function connect() {
      joined = false;
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/spaces-ws`);
      socket.current = ws;
      ws.onopen = () => {
        send(requested);
        send({ type: "clock", at: Date.now() });
        timer = setInterval(() => send({ type: "clock", at: Date.now() }), 5000);
      };
      ws.onmessage = event => {
        if (!active || ws !== socket.current) return;
        const message = JSON.parse(event.data) as RoomEvent;
        switch (message.type) {
          case "joined": {
            attempts = 0;
            joined = true;
            if (message.ownerKey) writeLocal("bbtv.owner." + message.room, message.ownerKey);
            requested = { type: "join", room: message.room, name: requested.name, ownerKey: readLocal("bbtv.owner." + message.room) };
            writeLocal("bbtv.name", requested.name);
            history.replaceState({}, "", "/spaces?space=" + message.room);
            setId(message.id);
            setError("");
            media.current = typeof RTCPeerConnection === "undefined" ? null : new RoomMedia(
              message.id, message.iceServers, (to, signal) => send({ type: "rtc", to, signal }),
              (peer, stream) => setRemote(current => {
                const next = { ...current };
                if (stream) next[peer] = stream;
                else delete next[peer];
                return next;
              }), fail,
            );
            setPersistent(message.persistent);
            setOnline(true);
            break;
          }
          case "state":
            setSpace(message.space);
            media.current?.sync(message.space.members);
            break;
          case "rtc": media.current?.receive(message.from, message.signal); break;
          case "clock": setOffset(message.now - (message.at + Date.now()) / 2); break;
          case "error":
            setError(message.message);
            if (!joined && (message.action === "join" || message.action === "create")) {
              initialError = true;
              setSpace(null);
              setEntry(null);
            } else if (message.action === "present" && present.current) {
              present.current = false;
              setTrack("screen");
            }
            break;
        }
      };
      ws.onclose = () => {
        clearInterval(timer);
        if (!active || ws !== socket.current) return;
        media.current?.close();
        media.current = null;
        stopTracks();
        setOnline(false);
        setRemote({});
        if (!initialError && attempts++ < 5) retry = setTimeout(connect, Math.min(8000, 800 * 2 ** attempts));
        else if (!initialError) {
          setError("The connection is unavailable. Leave and rejoin to retry.");
          if (requested === entry) setEntry(null);
        }
      };
    }
    connect();
    return () => {
      active = false;
      clearInterval(timer);
      clearTimeout(retry);
      socket.current?.close();
      socket.current = null;
      media.current?.close();
      media.current = null;
      stopTracks();
      setRemote({});
      setOnline(false);
    };
  }, [entry, fail, send, setTrack, stopTracks]);

  useEffect(() => {
    if (!present.current || !space || !id || space.presenter !== id || !devices.current.screen) return;
    void media.current?.setTrack("screen", devices.current.screen);
  }, [space?.presenter, id]);

  function leave() {
    setEntry(null);
    setSpace(null);
    setId("");
    setError("");
  }

  async function toggle(slot: Slot) {
    if (!online || busy.current.has(slot)) return;
    if (slot === "screen" && space?.presenter && space.presenter !== id) {
      setError("Someone is already sharing their screen.");
      return;
    }
    if (devices.current[slot]) {
      setTrack(slot);
      if (slot === "screen") {
        present.current = false;
        send({ type: "present", value: false });
      } else send({ type: "devices", audio: !!devices.current.audio, video: !!devices.current.camera });
      return;
    }
    const activeSocket = socket.current;
    busy.current.add(slot);
    setError("");
    try {
      const stream = slot === "screen"
        ? await navigator.mediaDevices.getDisplayMedia({ video: { width: { max: 1280 }, height: { max: 720 }, frameRate: { max: 15 } }, audio: false })
        : await navigator.mediaDevices.getUserMedia(slot === "camera" ? { video: { width: { ideal: 640, max: 960 }, frameRate: { max: 24 } }, audio: false } : { audio: true, video: false });
      const track = stream.getTracks()[0];
      if (!track || activeSocket !== socket.current || activeSocket?.readyState !== WebSocket.OPEN) {
        stream.getTracks().forEach(item => item.stop());
        return;
      }
      if (slot === "screen") {
        // Wait for the server to grant the shared screen before transmitting.
        present.current = true;
        devices.current = { ...devices.current, screen: track };
        setLocal(devices.current);
        send({ type: "present", value: true });
      } else {
        setTrack(slot, track);
        send({ type: "devices", audio: !!devices.current.audio, video: !!devices.current.camera });
      }
      track.addEventListener("ended", () => {
        if (devices.current[slot] !== track) return;
        setTrack(slot);
        if (slot === "screen") {
          present.current = false;
          send({ type: "present", value: false });
        } else send({ type: "devices", audio: !!devices.current.audio, video: !!devices.current.camera });
      });
    } catch {
      setError(slot === "screen" ? "Screen sharing wasn’t started. Try a supported desktop browser." : "BBTV couldn’t access that device. Check the browser’s permissions.");
    } finally {
      busy.current.delete(slot);
    }
  }

  return { begin, leave, send, toggle, space, id, online, persistent, remote, local, offset, error, setError, joining: !!entry && !space };
}
