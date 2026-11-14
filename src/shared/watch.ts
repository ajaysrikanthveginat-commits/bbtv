export interface QueueEntry {
  id: string;
  title: string;
  url: string;
}

export interface WatchState {
  queue: QueueEntry[];
  title?: string;
  url: string;
  position: number;
  playing: boolean;
  updatedAt: number;
  revision: number;
  ready: string[];
  allowControl: boolean;
}
export type WatchAction =
  | { kind: "source"; url: string }
  | { kind: "queue-add"; title: string; url: string }
  | { kind: "queue-remove" | "queue-load"; id: string }
  | { kind: "preview" }
  | { kind: "ready"; ready: boolean }
  | { kind: "start" }
  | { kind: "pause" }
  | { kind: "seek"; position: number }
  | { kind: "permission"; allowControl: boolean };
export const newWatchState = (allowControl = true): WatchState => ({
  url: "",
  queue: [],
  position: 0,
  playing: false,
  updatedAt: 0,
  revision: 0,
  ready: [],
  allowControl,
});
export const watchPosition = (state: WatchState, now: number) =>
  state.position +
  (state.playing ? Math.max(0, now - state.updatedAt) / 1000 : 0);
export function changeWatch(
  state: WatchState,
  action: WatchAction,
  actor: string,
  host: string,
  members: string[],
  now: number,
): WatchState {
  if (!members.includes(actor)) throw new Error("Join the room first.");
  const next = {
    ...state,
    ready: state.ready.filter((id) => members.includes(id)),
    revision: state.revision + 1,
  };
  if (action.kind === "ready") {
    if (typeof action.ready !== "boolean" || !state.url)
      throw new Error("Choose a video first.");
    next.ready = next.ready.filter((id) => id !== actor);
    if (action.ready) next.ready.push(actor);
    else {
      next.position = watchPosition(state, now);
      next.playing = false;
      next.updatedAt = now;
    }
    return next;
  }
  if (action.kind === "queue-add") {
    const title = typeof action.title === "string" ? action.title.trim() : "";
    if (!title || title.length > 70) throw new Error("Add a video title up to 70 characters.");
    if (state.queue.length >= 8) throw new Error("The queue has room for eight videos.");
    const url = validateVideoUrl(action.url);
    if (state.queue.some((entry) => entry.url === url)) throw new Error("That video is already queued.");
    return { ...next, queue: [...state.queue, { id: String(next.revision), title, url }] };
  }
  if (action.kind === "queue-remove" || action.kind === "queue-load") {
    if (actor !== host) throw new Error("Only the host can manage the queue.");
    const entry = state.queue.find((item) => item.id === action.id);
    if (!entry) throw new Error("That video is no longer queued.");
    const queue = state.queue.filter((item) => item.id !== entry.id);
    return action.kind === "queue-remove" ? { ...next, queue } : {
      ...next, queue, url: entry.url, title: entry.title, position: 0, playing: false, ready: [], updatedAt: now,
    };
  }
  if (
    actor !== host &&
    (!state.allowControl ||
      action.kind === "permission" ||
      action.kind === "source" || action.kind === "preview")
  )
    throw new Error("Only the host can do that.");
  switch (action.kind) {
    case "preview":
      return { ...next, url: "/bbtv-preview.webm", title: "BBTV Preview", playing: false, position: 0, updatedAt: now, ready: [] };
    case "source": {
      const url = validateVideoUrl(action.url);
      return {
        ...next,
        url,
        title: undefined,
        playing: false,
        position: 0,
        updatedAt: now,
        ready: [],
      };
    }
    case "permission":
      if (typeof action.allowControl !== "boolean")
        throw new Error("Invalid control setting.");
      return { ...next, allowControl: action.allowControl };
    case "start":
      if (
        !state.url ||
        members.length < 2 ||
        !members.every((id) => next.ready.includes(id))
      )
        throw new Error("Both people must be ready before starting.");
      if (state.playing) return state;
      return { ...next, playing: true, updatedAt: now + 3000 };
    case "pause":
      return {
        ...next,
        position: watchPosition(state, now),
        playing: false,
        updatedAt: now,
      };
    case "seek":
      if (
        !state.url ||
        !Number.isFinite(action.position) ||
        action.position < 0 ||
        action.position > 604800
      )
        throw new Error("Invalid playback position.");
      return {
        ...next,
        position: action.position,
        updatedAt:
          state.playing && now < state.updatedAt ? state.updatedAt : now,
      };
    default:
      throw new Error("Unknown watch action.");
  }
}


function validateVideoUrl(value: string): string {
  if (typeof value !== "string" || value.length > 4096) throw new Error("Enter a valid HTTPS video URL.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid HTTPS video URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Use an HTTPS video URL without credentials.");
  if (url.href.length > 4096) throw new Error("The video URL is too long.");
  return url.href;
}
