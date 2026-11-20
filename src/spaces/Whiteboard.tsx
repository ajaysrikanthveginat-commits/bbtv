import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { Download, Eraser, Hand, Highlighter, Maximize2, MousePointer2, PenLine, PenTool, Plus, Redo2, Trash2, Undo2, ZoomIn, ZoomOut, CircleHelp } from "lucide-react";
import { inkColors, type BoardPage, type Drawing, type InkPoint, type InkStroke, type InkStyle, type Note, type RoomPointer, type RoomRequest } from "./protocol";
import { InkPaths } from "./InkPaths";

const colorNames = ["Forest", "Terracotta", "Blue", "Violet"];
type Draft = { stroke: InkStroke; buffer: InkPoint[]; pointer: number; revision: number };

export function Whiteboard({ drawing, ink, id, host, online, error, send, pages, page, redo, saving, pointers, notes }: {
  drawing: Drawing; ink: InkStroke[]; id: string; host: boolean; online: boolean; error: string;
  pages:BoardPage[];page:string;redo:boolean;saving:boolean;pointers:RoomPointer[];notes:Note[];
  send: (action: RoomRequest) => boolean;
}) {
  const [color, setColor] = useState<string>(inkColors[0]);
  const [width, setWidth] = useState(6);
  const [eraser, setEraser] = useState(false);
  const [style, setStyle] = useState<InkStyle>("pen");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<InkStroke | null>(null);
  const [tool,setTool]=useState<"draw"|"pan"|"pointer"|"question">("draw");
  const [view,setView]=useState({x:0,y:0,zoom:1});
  const pan=useRef<{x:number;y:number;view:typeof view}|null>(null);
  const captured=useRef<number|undefined>(undefined);
  const pointedAt=useRef(0);
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
    active.current = null;
    pan.current=null;
    if(draft)send({ type: "draw", stroke: draft.stroke.id, revision: draft.revision, phase: "end", points: draft.buffer });
    const pointer=captured.current;captured.current=undefined;
    if (pointer!==undefined&&surface.current?.hasPointerCapture(pointer)) surface.current.releasePointerCapture(pointer);
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
  useEffect(()=>{setView({x:0,y:0,zoom:1});},[page]);

  function point(event: { clientX: number; clientY: number }): InkPoint {
    const bounds = surface.current!.getBoundingClientRect();
    return [
      Math.round(Math.max(0, Math.min(1600, view.x+(event.clientX - bounds.left) / bounds.width * 1600/view.zoom)) * 10) / 10,
      Math.round(Math.max(0, Math.min(1000, view.y+(event.clientY - bounds.top) / bounds.height * 1000/view.zoom)) * 10) / 10,
    ];
  }
  function start(event: PointerEvent<SVGSVGElement>) {
    if ((!online&&tool!=="pan") || !event.isPrimary || event.button !== 0 || active.current) return;
    event.preventDefault();
    if(tool==="question"){const [x,y]=point(event);send({type:"question",id:crypto.randomUUID(),x,y,page});setTool("draw");return;}
    surface.current!.setPointerCapture(event.pointerId);captured.current=event.pointerId;
    if(tool==="pan"){pan.current={x:event.clientX,y:event.clientY,view};return;}
    if(tool==="pointer"){pointedAt.current=0;move(event);return;}
    const stroke: InkStroke = { id: crypto.randomUUID(), author: id, color: eraser ? "erase" : color, width: eraser ? 32 : width, points: [point(event)], style };
    if (!send({ type: "draw", revision: drawing.revision, stroke: stroke.id, phase: "start", points: stroke.points, color: stroke.color, width: stroke.width, style })) return;
    active.current = { stroke, pointer: event.pointerId, revision: drawing.revision, buffer: [] };
    setPreview(stroke);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if(tool==="pointer"&&online&&Date.now()-pointedAt.current>65){
      pointedAt.current=Date.now();const [x,y]=point(event);send({type:"pointer",surface:"board",page,x,y});
    }
    if(pan.current){
      const drag=pan.current,bounds=surface.current!.getBoundingClientRect();
      setView({...drag.view,x:Math.max(0,Math.min(1600-1600/drag.view.zoom,drag.view.x-(event.clientX-drag.x)/bounds.width*1600/drag.view.zoom)),
        y:Math.max(0,Math.min(1000-1000/drag.view.zoom,drag.view.y-(event.clientY-drag.y)/bounds.height*1000/drag.view.zoom))});
      return;
    }
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
  function zoom(change:number) {
    setView(current=>{
      const zoom=Math.max(1,Math.min(3,current.zoom+change));
      return {zoom,x:Math.max(0,Math.min(1600-1600/zoom,current.x+800/current.zoom-800/zoom)),
        y:Math.max(0,Math.min(1000-1000/zoom,current.y+500/current.zoom-500/zoom))};
    });
  }
  async function download() {
    setNotice("");
    const clone = surface.current!.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1600");
    clone.setAttribute("height", "1000");
    clone.setAttribute("viewBox","0 0 1600 1000");
    clone.querySelectorAll("[data-pointer]").forEach(element=>element.remove());
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
    <div className="whiteboard-heading"><span><PenLine size={15}/> Handwriting board</span><span role="status">{!online?"Offline":error?"Check room notice":saving?"Saving…":"Saved to room"}</span></div>
    <div className="whiteboard-pages" role="group" aria-label="Whiteboard pages">
      {pages.map(item=><button className="space-button" key={item.id} aria-pressed={item.id===page} disabled={!online} onClick={()=>send({type:"page",action:"select",id:item.id})}>{item.title}</button>)}
      <button className="space-icon" aria-label="Add whiteboard page" disabled={!online||pages.length>=6} onClick={()=>send({type:"page",action:"add"})}><Plus size={16}/></button>
    </div>
    <div className="whiteboard-tools" role="group" aria-label="Drawing tools">
      <button className="space-icon" title="Pen" aria-label="Pen" aria-pressed={tool==="draw"&&!eraser && style === "pen"} disabled={!online} onClick={() => { setTool("draw");setEraser(false); setStyle("pen"); }}><PenLine size={17}/></button>
      <button className="space-icon" title="Highlighter" aria-label="Highlighter" aria-pressed={tool==="draw"&&!eraser && style === "marker"} disabled={!online} onClick={() => { setTool("draw");setEraser(false); setStyle("marker"); }}><Highlighter size={17}/></button>
      <button className="space-icon" title="Calligraphy" aria-label="Calligraphy pen" aria-pressed={tool==="draw"&&!eraser && style === "calligraphy"} disabled={!online} onClick={() => { setTool("draw");setEraser(false); setStyle("calligraphy"); }}><PenTool size={17}/></button>
      <button className="space-icon" title="Eraser" aria-label="Eraser" aria-pressed={tool==="draw"&&eraser} disabled={!online} onClick={() => {setTool("draw");setEraser(true);}}><Eraser size={17}/></button>
      <div className="ink-colors" role="group" aria-label="Pen color">
        {inkColors.slice(0, 4).map((value, index) => <button key={value} style={{ "--ink-color": value } as CSSProperties} aria-label={colorNames[index]} aria-pressed={color === value && !eraser} disabled={!online} onClick={() => { setTool("draw");setColor(value); setEraser(false); }}/>)}
      </div>
      <label className="ink-width"><span className="sr-only">Pen thickness</span><select aria-label="Pen thickness" value={width} disabled={!online || eraser} onChange={event => setWidth(Number(event.target.value))}><option value={3}>Fine</option><option value={6}>Medium</option><option value={12}>Bold</option></select></label>
      <button className="space-icon" title="Undo" aria-label="Undo your last stroke" disabled={!online || !drawing.strokes.some(stroke => stroke.author === id)} onClick={() => send({ type: "draw-undo" })}><Undo2 size={17}/></button>
      <button className="space-icon" title="Redo" aria-label="Redo your last stroke" disabled={!online||!redo} onClick={()=>send({type:"draw-redo"})}><Redo2 size={17}/></button>
      <button className="space-icon" title="Pan the page" aria-label="Pan whiteboard" aria-pressed={tool==="pan"} onClick={()=>setTool(tool==="pan"?"draw":"pan")}><Hand size={17}/></button>
      <button className="space-icon" title="Shared pointer" aria-label="Shared board pointer" aria-pressed={tool==="pointer"} disabled={!online} onClick={()=>setTool(tool==="pointer"?"draw":"pointer")}><MousePointer2 size={17}/></button>
      <button className="space-icon" title="Pin a question" aria-label="Pin a question" aria-pressed={tool==="question"} disabled={!online} onClick={()=>setTool(tool==="question"?"draw":"question")}><CircleHelp size={17}/></button>
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
    <div className="whiteboard-view">
      <button className="space-icon" aria-label="Zoom out" disabled={view.zoom<=1} onClick={()=>zoom(-.25)}><ZoomOut size={16}/></button>
      <button className="space-text-button" aria-label="Reset whiteboard zoom" onClick={()=>setView({x:0,y:0,zoom:1})}>{Math.round(view.zoom*100)}%</button>
      <button className="space-icon" aria-label="Zoom in" disabled={view.zoom>=3} onClick={()=>zoom(.25)}><ZoomIn size={16}/></button>
      <span>{tool==="pan"?"Drag to move around the page":tool==="pointer"?"Move to point things out to everyone":tool==="question"?"Tap the part you’d like explained":"Hold and drag to write"}</span>
    </div>
    <div className="whiteboard-paper">
      <svg ref={surface} viewBox={`${view.x} ${view.y} ${1600/view.zoom} ${1000/view.zoom}`} role="img" aria-label="Drawing surface" aria-description="Hold and drag your mouse or finger to write on the shared whiteboard."
        className={tool==="pan"?"ink-pan":tool==="draw"&&eraser ? "ink-eraser" : ""} data-online={online}
        onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onContextMenu={event => event.preventDefault()}>
        <InkPaths strokes={strokes}/>
        {notes.filter(note=>note.page===page&&!note.done&&note.x!==undefined&&note.y!==undefined).map(note=><g key={note.id} className="board-question-pin" transform={`translate(${note.x} ${note.y})`}><circle r="22" fill="#b66a31"/><text y="9" textAnchor="middle" fontSize="28" fill="white">?</text><title>{note.author}: {note.text}</title></g>)}
        {pointers.filter(pointer=>pointer.surface==="board"&&pointer.page===page).map(pointer=><g key={pointer.id} data-pointer={pointer.id} transform={`translate(${pointer.x} ${pointer.y})`} pointerEvents="none"><circle r="13" fill="#d46d38" opacity=".8"/><text x="20" y="-12" fontSize="22" fill="#8e4324">{pointer.name}</text></g>)}
      </svg>
      {!strokes.length && <p className="whiteboard-hint"><PenLine size={21}/><span>Hold and drag to write.</span><small>Use your mouse, finger, or stylus. Everyone can draw.</small></p>}
    </div>
    <div className="whiteboard-caption"><span>{online ? "Shared live · Mouse, touch & pen" : "Reconnecting · Drawing paused"}</span><span>Handwriting stays with this room</span></div>
    {notice && <p className="space-error" role="alert">{notice}</p>}
  </section>;
}
