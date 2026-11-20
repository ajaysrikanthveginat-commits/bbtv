import { useRef, useState } from "react";
import { Download, History, Upload } from "lucide-react";
import { downloadBackup } from "./cache";
import { roomDocument, validBackup } from "./documents";
import type { RoomRequest, Space } from "./protocol";

export function BackupPanel({space,host,online,persistent,deviceBackup,history,send}:{
  space:Space;host:boolean;online:boolean;persistent:boolean;deviceBackup:boolean;
  history:{version:number;at:number}[];send:(action:RoomRequest)=>boolean;
}) {
  const input=useRef<HTMLInputElement>(null);
  const [notice,setNotice]=useState("");
  const [showHistory,setShowHistory]=useState(false);
  return <details className="room-backup-panel">
    <summary>Saving & backups</summary>
    <p>{deviceBackup?"A recovery copy is saved on this device.":"Device recovery copy is unavailable in this browser."}</p>
    {!persistent&&<p>The service is using temporary storage. Keep a downloaded backup for future visits.</p>}
    <button className="space-button" onClick={()=>downloadBackup(roomDocument(space))}><Download size={15}/> Download room backup</button>
    {host&&<>
      <button className="space-button" disabled={!online} onClick={()=>input.current?.click()}><Upload size={15}/> Restore a backup</button>
      <input ref={input} type="file" className="sr-only" accept=".json,application/json" aria-label="Room backup file" onChange={async event=>{
        const file=event.target.files?.[0];event.target.value="";if(!file)return;
        setNotice("");
        try {
          if(file.size>1_400_000)throw new Error("That backup is too large.");
          const backup:unknown=JSON.parse(await file.text());
          if(!validBackup(backup))throw new Error("Choose a valid BBTV. room backup.");
          if(confirm("Replace this room’s handwritten pages and saved notes with this backup?"))send({type:"restore",backup});
        } catch(error) { setNotice(error instanceof Error?error.message:"The backup couldn’t be read."); }
      }}/>
      <button className="space-button" disabled={!online} onClick={()=>{setShowHistory(true);send({type:"history"});}}><History size={15}/> Previous saved versions</button>
      {showHistory&&<div className="room-version-list">
        {!history.length&&<p>No earlier versions are available yet.</p>}
        {history.map(version=><button className="space-text-button" key={version.version} disabled={!online} onClick={()=>{
          if(confirm("Restore the room to this earlier saved version?")){send({type:"restore-version",version:version.version});setShowHistory(false);}
        }}>Restore {new Date(version.at).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</button>)}
      </div>}
    </>}
    {notice&&<p role="alert" className="space-error">{notice}</p>}
  </details>;
}
