import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { Eraser, PenLine, Trash2, Undo2 } from "lucide-react";
import { inkColors, type Drawing, type InkPoint, type InkStroke, type RoomRequest } from "./protocol";

const colorNames = ["Forest", "Terracotta", "Blue", "Violet"];
function pathData(points: InkPoint[]) {
  const [first, ...rest] = points;
  if (!first) return "";
  return `M ${first.join(" ")} ${rest.length ? rest.map(point => "L " + point.join(" ")).join(" ") : "l .1 .1"}`;
}
type Draft = { stroke: InkStroke; buffer: InkPoint[]; pointer: number; revision: number };

export function Whiteboard({ drawing, ink, id, host, online, error, send }: {
  drawing: Drawing; ink: InkStroke[]; id: string; host: boolean; online: boolean; error: string;
  send: (action: RoomRequest) => boolean;
}) {
  const [color, setColor] = useState<string>(inkColors[0]);
  const [width, setWidth] = useState(6);
  const [eraser, setEraser] = useState(false);
  const [preview, setPreview] = useState<InkStroke | null>(null);
  const surface = useRef<SVGSVGElement>(null);
  const active = useRef<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flush() {
    clearTimeout(timer.current);
    timer.current = undefined;
    const draft = active.current;
    if (!draft?.buffer.length) return;
    send({ type: "draw", stroke: draft.stroke.id, revision: draft.revision, phase: "move", points: draft.buffer.splice(0) });
  }
  function finish() {
    clearTimeout(timer.current);
    const draft = active.current;
    if (!draft) return;
    active.current = null;
    send({ type: "draw", stroke: draft.stroke.id, revision: draft.revision, phase: "end", points: draft.buffer });
    if (surface.current?.hasPointerCapture(draft.pointer)) surface.current.releasePointerCapture(draft.pointer);
  }
  useEffect(() => () => {
    clearTimeout(timer.current);
    const draft = active.current;
    if (draft) send({ type: "draw", stroke: draft.stroke.id, revision: draft.revision, phase: "end", points: draft.buffer });
  }, [send]);
  useEffect(() => {
    if (active.current?.revision === drawing.revision && online && !error) return;
    clearTimeout(timer.current);
    active.current = null;
    setPreview(null);
  }, [drawing.revision, online, error]);
  useEffect(() => {
    if (!active.current) setPreview(current => current && ink.some(stroke => stroke.id === current.id) ? current : null);
  }, [drawing, ink]);

  function point(event: { clientX: number; clientY: number }): InkPoint {
    const bounds = surface.current!.getBoundingClientRect();
    return [
      Math.round(Math.max(0, Math.min(1600, (event.clientX - bounds.left) / bounds.width * 1600)) * 10) / 10,
      Math.round(Math.max(0, Math.min(1000, (event.clientY - bounds.top) / bounds.height * 1000)) * 10) / 10,
    ];
  }
  function start(event: PointerEvent<SVGSVGElement>) {
    if (!online || !event.isPrimary || event.button !== 0 || active.current) return;
    event.preventDefault();
    const stroke: InkStroke = { id: crypto.randomUUID(), author: id, color: eraser ? "erase" : color, width: eraser ? 32 : width, points: [point(event)] };
    if (!send({ type: "draw", revision: drawing.revision, stroke: stroke.id, phase: "start", points: stroke.points, color: stroke.color, width: stroke.width })) return;
    surface.current!.setPointerCapture(event.pointerId);
    active.current = { stroke, pointer: event.pointerId, revision: drawing.revision, buffer: [] };
    setPreview(stroke);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const draft = active.current;
    if (!draft || draft.pointer !== event.pointerId) return;
    event.preventDefault();
    const next = point(event);
    const last = draft.stroke.points.at(-1)!;
    if (Math.hypot(next[0] - last[0], next[1] - last[1]) < .8) return;
    draft.stroke = { ...draft.stroke, points: [...draft.stroke.points, next] };
    draft.buffer.push(next);
    setPreview(draft.stroke);
    if (draft.buffer.length >= 32) flush();
    else if (!timer.current) timer.current = setTimeout(() => { timer.current = undefined; flush(); }, 50);
    if (draft.stroke.points.length >= 1000) finish();
  }

  const strokes = [...drawing.strokes, ...ink.filter(stroke => stroke.id !== preview?.id), ...(preview ? [preview] : [])];
  return <section className="whiteboard" aria-label="Shared whiteboard">
    <div className="whiteboard-tools" role="group" aria-label="Drawing tools">
      <button className="space-icon" aria-label="Pen" aria-pressed={!eraser} disabled={!online} onClick={() => setEraser(false)}><PenLine size={17}/></button>
      <button className="space-icon" aria-label="Eraser" aria-pressed={eraser} disabled={!online} onClick={() => setEraser(true)}><Eraser size={17}/></button>
      <div className="ink-colors" role="group" aria-label="Pen color">
        {inkColors.slice(0, 4).map((value, index) => <button key={value} style={{ "--ink-color": value } as CSSProperties} aria-label={colorNames[index]} aria-pressed={color === value && !eraser} disabled={!online} onClick={() => { setColor(value); setEraser(false); }}/>)}
      </div>
      <label className="ink-width"><span className="sr-only">Pen thickness</span><select aria-label="Pen thickness" value={width} disabled={!online || eraser} onChange={event => setWidth(Number(event.target.value))}><option value={3}>Fine</option><option value={6}>Medium</option><option value={12}>Bold</option></select></label>
      <button className="space-icon" aria-label="Undo your last stroke" disabled={!online || !drawing.strokes.some(stroke => stroke.author === id)} onClick={() => send({ type: "draw-undo" })}><Undo2 size={17}/></button>
      {host && <button className="space-icon clear-ink" aria-label="Clear whiteboard" disabled={!online || (!drawing.strokes.length && !ink.length)} onClick={() => {
        if (confirm("Clear all handwriting from this room’s whiteboard?")) send({ type: "draw-clear", revision: drawing.revision });
      }}><Trash2 size={17}/></button>}
    </div>
    <div className="whiteboard-paper">
      <svg ref={surface} viewBox="0 0 1600 1000" role="img" aria-label="Drawing surface" aria-description="Hold and drag your mouse or finger to write on the shared whiteboard."
        className={eraser ? "ink-eraser" : ""} data-online={online}
        onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onContextMenu={event => event.preventDefault()}>
        {strokes.map(stroke => <path key={stroke.id} data-stroke={stroke.id} d={pathData(stroke.points)} stroke={stroke.color === "erase" ? "#fffef9" : stroke.color} strokeWidth={stroke.width} fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}
      </svg>
      {!strokes.length && <p className="whiteboard-hint"><PenLine size={21}/><span>Hold and drag to write.</span><small>Use your mouse, finger, or stylus. Everyone can draw.</small></p>}
    </div>
    <div className="whiteboard-caption"><span>{online ? "Shared live · Mouse, touch & pen" : "Reconnecting · Drawing paused"}</span><span>Handwriting stays with this room</span></div>
  </section>;
}
