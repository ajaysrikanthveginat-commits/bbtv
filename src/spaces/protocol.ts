import type { WatchAction, WatchState } from "../shared/watch";

export const modes = ["study", "meet", "family", "watch"] as const;
export type Mode = typeof modes[number];
export const capacity = 4;
export type NoteKind = "note" | "question" | "decision";

export interface Member {
  id: string;
  name: string;
  owner: boolean;
  hand: boolean;
  audio: boolean;
  video: boolean;
}

export interface Note {
  id: string;
  kind: NoteKind;
  text: string;
  author: string;
  done: boolean;
  position?: number;
  source?: string;
}

export interface Chat {
  id: string;
  name: string;
  text: string;
}

export interface Space {
  id: string;
  name: string;
  mode: Mode;
  notes: Note[];
  watch: WatchState;
  members: Member[];
  host: string;
  presenter: string;
  chat: Chat[];
}

export type MediaSignal =
  | { sdp: RTCSessionDescriptionInit }
  | { candidate: RTCIceCandidateInit }
  | { retry: true };

export type RoomRequest =
  | { type: "create"; title: string; name: string; mode: Mode }
  | { type: "join"; room: string; name: string; ownerKey?: string }
  | { type: "mode"; mode: Mode }
  | { type: "note"; text: string; kind: NoteKind; pin: boolean }
  | { type: "resolve"; id: string }
  | { type: "hand"; value: boolean }
  | { type: "devices"; audio: boolean; video: boolean }
  | { type: "present"; value: boolean }
  | { type: "chat"; text: string }
  | { type: "watch"; action: WatchAction }
  | { type: "rtc"; to: string; signal: MediaSignal }
  | { type: "clock"; at: number };

export type RoomEvent =
  | { type: "joined"; id: string; room: string; ownerKey?: string; iceServers: RTCIceServer[]; persistent: boolean }
  | { type: "state"; space: Space; now: number }
  | { type: "error"; message: string; action?: string }
  | { type: "rtc"; from: string; signal: MediaSignal }
  | { type: "clock"; at: number; now: number };
