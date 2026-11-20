import type { WatchAction, WatchState } from "../shared/watch";

export const modes = ["study", "meet", "family", "watch"] as const;
export type Mode = typeof modes[number];
export const capacity = 4;
export type NoteKind = "note" | "question" | "decision";
export type InkPoint = [number, number];
export type InkStyle = "pen" | "marker" | "calligraphy";
export const roomReactions = ["❤️", "👏", "😂", "✨"] as const;
export const inkColors = ["#243f34", "#ba4b37", "#386ca0", "#936bb0", "erase"] as const;
export interface InkStroke {
  id: string;
  author: string;
  color: string;
  width: number;
  points: InkPoint[];
  style?: InkStyle;
}
export interface Drawing {
  revision: number;
  strokes: InkStroke[];
}
export interface BoardPage { id: string; title: string; strokes: InkStroke[] }
export interface AvatarProfile {
  skin: number; hair: number; background: number; glasses: boolean;
  expression: "smile" | "laugh" | "wow" | "calm";
}
export interface RoomPointer { id: string; name: string; x: number; y: number; surface: "board" | "screen"; page: string }
export type RoomDocument = Pick<Space, "id" | "name" | "mode" | "notes" | "watch" | "drawing" | "pages" | "page" | "version" | "updatedAt">;
export interface RoomBackup { format: "bbtv-room"; document: RoomDocument }

export interface Member {
  id: string;
  writer: string;
  name: string;
  owner: boolean;
  hand: boolean;
  audio: boolean;
  video: boolean;
  avatar?: AvatarProfile;
}

export interface Note {
  id: string;
  kind: NoteKind;
  text: string;
  author: string;
  done: boolean;
  position?: number;
  source?: string;
  x?: number;
  y?: number;
  page?: string;
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
  drawing: Drawing;
  ink: InkStroke[];
  pages: BoardPage[];
  page: string;
  version: number;
  updatedAt: number;
  redo: string[];
}

export type MediaSignal =
  | { sdp: RTCSessionDescriptionInit }
  | { candidate: RTCIceCandidateInit }
  | { retry: true };

export type RoomRequest =
  | { type: "create"; title: string; name: string; mode: Mode; avatar?: AvatarProfile; restore?: RoomBackup }
  | { type: "join"; room: string; name: string; ownerKey?: string; avatar?: AvatarProfile; resumeKey?:string }
  | { type: "mode"; mode: Mode }
  | { type: "note"; text: string; kind: NoteKind; pin: boolean }
  | { type: "resolve"; id: string }
  | { type: "draw"; revision: number; stroke: string; phase: "start" | "move" | "end"; points: InkPoint[]; color?: string; width?: number; style?: InkStyle }
  | { type: "draw-undo" }
  | { type: "draw-redo" }
  | { type: "draw-clear"; revision: number }
  | { type: "page"; action: "add" | "select"; id?: string }
  | { type: "question"; id: string; x: number; y: number; page: string }
  | { type: "restore"; backup: RoomBackup }
  | { type: "history" }
  | { type: "restore-version"; version: number }
  | { type: "profile"; avatar: AvatarProfile }
  | { type: "pointer"; x: number; y: number; surface: "board" | "screen"; page: string }
  | { type: "hand"; value: boolean }
  | { type: "devices"; audio: boolean; video: boolean }
  | { type: "present"; value: boolean }
  | { type: "chat"; text: string }
  | { type: "reaction"; emoji?: typeof roomReactions[number]; expression?: AvatarProfile["expression"] }
  | { type: "watch"; action: WatchAction }
  | { type: "rtc"; to: string; signal: MediaSignal }
  | { type: "clock"; at: number };

export type RoomEvent =
  | { type: "joined"; id: string; room: string; ownerKey?: string; iceServers: RTCIceServer[]; persistent: boolean; resumeKey:string }
  | { type: "state"; space: Space; now: number }
  | { type: "ink"; revision: number; stroke: InkStroke; finished: boolean; version: number; updatedAt: number }
  | { type: "reaction"; id: string; emoji: string; name: string; avatar?: AvatarProfile }
  | { type: "pointer"; pointer: RoomPointer }
  | { type: "history"; versions: { version: number; at: number }[] }
  | { type: "error"; message: string; action?: string }
  | { type: "rtc"; from: string; signal: MediaSignal }
  | { type: "clock"; at: number; now: number };
