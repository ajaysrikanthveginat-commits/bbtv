import test from "node:test";
import assert from "node:assert/strict";
import type { WatchState, WatchAction } from "../src/shared/watch.ts";
import {
  newWatchState,
  changeWatch,
  watchPosition,
} from "../src/shared/watch.ts";
const members = ["host", "guest"];
const run = (s: WatchState, a: WatchAction, actor = "host", now = 1000) =>
  changeWatch(s, a, actor, "host", members, now);
const source = () =>
  run(newWatchState(), {
    kind: "source",
    url: "https://example.com/movie.mp4",
  });
test("both participants must be ready; scheduled play starts after countdown", () => {
  let s = source();
  assert.throws(() => run(s, { kind: "start" }));
  s = run(s, { kind: "ready", ready: true });
  assert.throws(() => run(s, { kind: "start" }));
  s = run(s, { kind: "ready", ready: true }, "guest");
  s = run(s, { kind: "start" });
  assert.equal(s.updatedAt, 4000);
  assert.equal(watchPosition(s, 3000), 0);
  assert.equal(watchPosition(s, 6000), 2);
  s = run(s, { kind: "pause" }, "guest", 7000);
  assert.equal(s.position, 3);
  assert.equal(watchPosition(s, 9000), 3);
});
test("host-only control is enforced; guests can always request a break", () => {
  let s = run(source(), { kind: "permission", allowControl: false });
  assert.throws(() => run(s, { kind: "seek", position: 50 }, "guest"));
  assert.throws(() =>
    run(s, { kind: "permission", allowControl: true }, "guest"),
  );
  s = { ...s, playing: true, updatedAt: 1000 };
  s = run(s, { kind: "ready", ready: false }, "guest", 5000);
  assert.equal(s.playing, false);
  assert.equal(s.position, 4);
});
test("source validation, membership, and seek bounds reject invalid input", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.com/a",
    "https://user:password@example.com/a",
    "bad",
  ])
    assert.throws(() => run(newWatchState(), { kind: "source", url }));
  assert.throws(() => run(source(), { kind: "pause" }, "outsider"));
  for (const position of [-1, NaN, Infinity, 604801])
    assert.throws(() => run(source(), { kind: "seek", position }));
  assert.throws(() =>
    run(source(), { kind: "source", url: "https://example.com/b" }, "guest"),
  );
});
test("changing video resets readiness and playback; seek preserves countdown", () => {
  let s = { ...source(), ready: members, playing: true, updatedAt: 5000 };
  s = run(s, { kind: "seek", position: 20 }, "host", 2000);
  assert.equal(s.updatedAt, 5000);
  assert.equal(watchPosition(s, 4000), 20);
  s = run(s, { kind: "source", url: "https://example.com/next.webm" });
  assert.deepEqual(s.ready, []);
  assert.equal(s.position, 0);
  assert.equal(s.playing, false);
});

test("guests can suggest videos and only the host can load them", () => {
  const empty = newWatchState(false);
  const queued = changeWatch(empty, {
    kind: "queue-add", title: "Feature", url: "https://example.com/movie.mp4",
  }, "guest", "host", ["host", "guest"], 100);
  const load = { kind: "queue-load" as const, id: queued.queue[0].id };
  assert.throws(() => changeWatch(queued, load, "guest", "host", ["host", "guest"], 200), /host/);
  const loaded = changeWatch(queued, load, "host", "host", ["host", "guest"], 200);
  assert.equal(loaded.title, "Feature");
  assert.equal(loaded.url, "https://example.com/movie.mp4");
  assert.deepEqual(loaded.queue, []);
  assert.deepEqual(loaded.ready, []);
  assert.equal(loaded.playing, false);
});
