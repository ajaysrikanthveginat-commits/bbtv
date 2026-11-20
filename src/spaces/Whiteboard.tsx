import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { Download, Eraser, Highlighter, Maximize2, PenLine, PenTool, Trash2, Undo2 } from "lucide-react";
import { inkColors, type Drawing, type InkPoint, type InkStroke, type InkStyle, type RoomRequest } from "./protocol";

const colorNames = ["Forest", "Terracotta", "Blue", "Violet"];
function pathData(points: InkPoint[]) {
  const [first, ...rest] = points;
  if (!first) return "";
  if (!rest.length) return `M ${first.join(" ")} l .1 .1`;
  const curves = rest.slice(0, -1).map((point, index) => {
    const next = rest[index + 1];
    return `Q ${point.join(" ")} ${(point[0] + next[0]) / 2} ${(point[1] + next[1]) / 2}`;
  });
  return `M ${first.join(" ")} ${curves.join(" ")} L ${rest.at(-1)!.join(" ")}`;
}
function calligraphyData(stroke: InkStroke) {
  const edge = stroke.width * .8;
  const outline = [
    ...stroke.points.map(([x,y]) => [x + edge,y - edge * .4]),
    ...[...stroke.points].reverse().map(([x,y]) => [x - edge,y + edge * .4]),
  ];
  return "M " + outline.map(point => point.join(" ")).join(" L ") + " Z";
}
type Draft = { stroke: InkStroke; buffer: InkPoint[]; pointer: number; revision: number };

export function Whiteboard({ drawing, ink, id, host, online, error, send }: {
  drawing: Drawing; ink: InkStroke[]; id: string; host: boolean; online: boolean; error: string;
  send: (action: RoomRequest) => boolean;
}) {
  const [color, setColor] = useState<string>(inkColors[0]);
  const [width, setWidth] = useState(6);
  const [eraser, setEraser] = useState(false);
  const [style, setStyle] = useState<InkStyle>("pen");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<InkStroke | null>(null);
  const surface = useRef<SVGSVGElement>(null);
  const board = useRef<HTMLElement>(null);
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
    const stroke: InkStroke = { id: crypto.randomUUID(), author: id, color: eraser ? "erase" : color, width: eraser ? 32 : width, points: [point(event)], style };
    if (!send({ type: "draw", revision: drawing.revision, stroke: stroke.id, phase: "start", points: stroke.points, color: stroke.color, width: stroke.width, style })) return;
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
  async function download() {
    setNotice("");
    const clone = surface.current!.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1600");
    clone.setAttribute("height", "1000");
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], {type:"image/svg+xml"}));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1600; canvas.height = 1000;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#fffef9"; context.fillRect(0,0,1600,1000);
      context.drawImage(image,0,0);
      const link = document.createElement("a");
      link.download = "BBTV-whiteboard.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch { setNotice("The board couldn’t download. Try again."); }
    finally { URL.revokeObjectURL(url); }
  }
  return <section ref={board} className="whiteboard" aria-label="Shared whiteboard">
    <div className="whiteboard-heading"><span><PenLine size={15}/> Handwriting board</span><span>Write, sketch, explain.</span></div>
    <div className="whiteboard-tools" role="group" aria-label="Drawing tools">
      <button className="space-icon" aria-label="Pen" aria-pressed={!eraser && style === "pen"} disabled={!online} onClick={() => { setEraser(false); setStyle("pen"); }}><PenLine size={17}/></button>
      <button className="space-icon" aria-label="Highlighter" aria-pressed={!eraser && style === "marker"} disabled={!online} onClick={() => { setEraser(false); setStyle("marker"); }}><Highlighter size={17}/></button>
      <button className="space-icon" aria-label="Calligraphy pen" aria-pressed={!eraser && style === "calligraphy"} disabled={!online} onClick={() => { setEraser(false); setStyle("calligraphy"); }}><PenTool size={17}/></button>
      <button className="space-icon" aria-label="Eraser" aria-pressed={eraser} disabled={!online} onClick={() => setEraser(true)}><Eraser size={17}/></button>
      <div className="ink-colors" role="group" aria-label="Pen color">
        {inkColors.slice(0, 4).map((value, index) => <button key={value} style={{ "--ink-color": value } as CSSProperties} aria-label={colorNames[index]} aria-pressed={color === value && !eraser} disabled={!online} onClick={() => { setColor(value); setEraser(false); }}/>)}
      </div>
      <label className="ink-width"><span className="sr-only">Pen thickness</span><select aria-label="Pen thickness" value={width} disabled={!online || eraser} onChange={event => setWidth(Number(event.target.value))}><option value={3}>Fine</option><option value={6}>Medium</option><option value={12}>Bold</option></select></label>
      <button className="space-icon" aria-label="Undo your last stroke" disabled={!online || !drawing.strokes.some(stroke => stroke.author === id)} onClick={() => send({ type: "draw-undo" })}><Undo2 size={17}/></button>
      <button className="space-icon" aria-label="Download handwriting" onClick={() => void download()}><Download size={17}/></button>
      {typeof document.documentElement.requestFullscreen === "function" && <button className="space-icon" aria-label="Full screen whiteboard" onClick={() => {
        setNotice("");
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => setNotice("Full screen is unavailable."));
        else void board.current?.requestFullscreen().catch(() => setNotice("Full screen is unavailable."));
      }}><Maximize2 size={17}/></button>}
      {host && <button className="space-icon clear-ink" aria-label="Clear whiteboard" disabled={!online || (!drawing.strokes.length && !ink.length)} onClick={() => {
        if (confirm("Clear all handwriting from this room’s whiteboard?")) send({ type: "draw-clear", revision: drawing.revision });
      }}><Trash2 size={17}/></button>}
    </div>
    <div className="whiteboard-paper">
      <svg ref={surface} viewBox="0 0 1600 1000" role="img" aria-label="Drawing surface" aria-description="Hold and drag your mouse or finger to write on the shared whiteboard."
        className={eraser ? "ink-eraser" : ""} data-online={online}
        onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onContextMenu={event => event.preventDefault()}>
        {strokes.map(stroke => {
          const nib = stroke.style === "calligraphy" && stroke.color !== "erase" && stroke.points.length > 1;
          const color = stroke.color === "erase" ? "#fffef9" : stroke.color;
          return <path key={stroke.id} data-stroke={stroke.id} data-pen={stroke.style || "pen"}
            d={nib ? calligraphyData(stroke) : pathData(stroke.points)}
            stroke={color} strokeWidth={stroke.style === "marker" && stroke.color !== "erase" ? stroke.width * 3 : nib ? .5 : stroke.width}
            fill={nib ? color : "none"} opacity={stroke.style === "marker" && stroke.color !== "erase" ? .35 : 1}
            strokeLinecap={stroke.style === "marker" ? "square" : "round"} strokeLinejoin="round"/>;
        })}
      </svg>
      {!strokes.length && <p className="whiteboard-hint"><PenLine size={21}/><span>Hold and drag to write.</span><small>Use your mouse, finger, or stylus. Everyone can draw.</small></p>}
    </div>
    <div className="whiteboard-caption"><span>{online ? "Shared live · Mouse, touch & pen" : "Reconnecting · Drawing paused"}</span><span>Handwriting stays with this room</span></div>
    {notice && <p className="space-error" role="alert">{notice}</p>}
  </section>;
}
