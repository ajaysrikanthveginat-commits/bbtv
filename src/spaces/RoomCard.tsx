import { useEffect, useState } from "react";
import { ArrowRight, Download, RotateCcw } from "lucide-react";
import { cachedRoom, downloadBackup } from "./cache";
import { InkPaths } from "./InkPaths";
import type { Mode, RoomDocument } from "./protocol";

export interface RoomSummary {id:string;exists:boolean;people:number;updatedAt?:number;questions?:number;name?:string;mode?:Mode}
export function RoomCard({room,summary,disabled,onOpen,onRestore}:{
  room:{id:string;name:string;mode:Mode};summary?:RoomSummary;disabled:boolean;
  onOpen:(id:string)=>void;onRestore:(document:RoomDocument)=>void;
}) {
  const [document,setDocument]=useState<RoomDocument>();
  useEffect(()=>{let active=true;void cachedRoom(room.id).then(value=>{if(active)setDocument(value);}).catch(()=>{});return ()=>{active=false;};},[room.id]);
  const strokes=document?.pages.find(page=>page.id===document.page)?.strokes||[];
  const questions=document?.notes.filter(note=>note.kind==="question"&&!note.done)||[];
  return <li className="recent-room">
    <button className="recent-room-open" disabled={disabled||summary?.exists===false} onClick={()=>onOpen(room.id)}>
      <div className="recent-room-preview" aria-hidden="true">
        {strokes.length?<svg viewBox="0 0 1600 1000"><InkPaths strokes={strokes}/></svg>:<span>{room.mode==="family"?"♡":room.mode==="watch"?"▶":"✎"}</span>}
      </div>
      <div className="recent-room-copy"><strong>{summary?.name||room.name}</strong>
        <small>{summary?.exists===false?"Room unavailable":summary?.people?summary.people+" in the room":summary?"Room is quiet":"Checking room…"}</small>
        {summary?.updatedAt&&<small>Saved {new Date(summary.updatedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</small>}
      </div><ArrowRight size={17}/>
    </button>
    {questions.length>0&&<p className="recent-room-question">{questions.length} open question{questions.length===1?"":"s"} · {questions[0].text}</p>}
    {document&&<div className="recent-room-backups">
      <button className="space-text-button" aria-label={"Download backup of "+room.name} onClick={()=>downloadBackup(document)}><Download size={13}/> Backup</button>
      <button className="space-text-button" aria-label={"Restore a copy of "+room.name} disabled={disabled} onClick={()=>onRestore(document)}><RotateCcw size={13}/> Restore a copy</button>
    </div>}
  </li>;
}
