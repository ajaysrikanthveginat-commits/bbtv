export interface WatchState {
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
  | { kind: "ready"; ready: boolean }
  | { kind: "start" }
  | { kind: "pause" }
  | { kind: "seek"; position: number }
  | { kind: "permission"; allowControl: boolean };
export const newWatchState = (allowControl = true): WatchState => ({
  url: "",
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
  if (
    actor !== host &&
    (!state.allowControl ||
      action.kind === "permission" ||
      action.kind === "source")
  )
    throw new Error("Only the host can do that.");
  switch (action.kind) {
    case "source": {
      if (typeof action.url !== "string" || action.url.length > 4096)
        throw new Error("Enter a valid HTTPS video URL.");
      let url: URL;
      try {
        url = new URL(action.url);
      } catch {
        throw new Error("Enter a valid HTTPS video URL.");
      }
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("Use an HTTPS video URL without credentials.");
      return {
        ...next,
        url: url.href,
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
