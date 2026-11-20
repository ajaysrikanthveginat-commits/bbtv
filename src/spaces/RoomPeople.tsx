import { BookOpen, Hand, Mic, MicOff, Video, VideoOff } from "lucide-react";
import type { RoomRequest, Space } from "./protocol";

export function RoomPeople({ space, id, online, send }: {
  space: Space; id: string; online: boolean; send: (action: RoomRequest) => boolean;
}) {
  const own = space.members.find(member => member.id === id);
  const raised = space.members.filter(member => member.hand);
  return <div className="room-people">
    <div className="board-title">
      <span className="spaces-overline">{space.mode === "study" ? "STUDY TOGETHER" : "IN THIS MEETING"}</span>
      <h2>{space.mode === "study" ? "Study circle" : "People"}</h2>
      <p>{space.mode === "study" ? "Write with your mouse, finger, or pen. Your handwriting is shared live." : "Everyone can use the whiteboard. Share your screen to present."}</p>
    </div>
    <ul className="room-roster" aria-label="People and device status">
      {space.members.map(member => <li key={member.id}>
        <span className="roster-avatar" aria-hidden="true">{member.name.slice(0,1)}</span>
        <div><strong>{member.name}{member.id === id ? " · You" : ""}</strong><small>{member.id === space.host ? "Host" : member.hand ? "Hand raised" : "In the room"}</small></div>
        {member.audio ? <Mic size={14} aria-label="Microphone on"/> : <MicOff size={14} aria-label="Microphone off"/>}
        {member.video ? <Video size={14} aria-label="Camera on"/> : <VideoOff size={14} aria-label="Camera off"/>}
      </li>)}
    </ul>
    <div className="speaker-requests">
      <h3><Hand size={15}/>{space.mode === "study" ? "Need a hand?" : "Speaker requests"}</h3>
      {raised.length ? <ul>{raised.map(member => <li key={member.id}><span>{member.name}</span><Hand size={14}/></li>)}</ul> : <p>{space.mode === "study" ? "Raise your hand when you want help or have something to explain." : "Raise your hand to let the group know you’d like to speak."}</p>}
      <button className="space-button" aria-pressed={!!own?.hand} disabled={!online} onClick={() => send({type:"hand",value:!own?.hand})}>{own?.hand ? "Lower my hand" : "Raise my hand"}</button>
    </div>
    {space.notes.length > 0 && <details className="previous-notes">
      <summary><BookOpen size={15}/> Saved notes</summary>
      <ul>{space.notes.map(note => <li key={note.id}><small>{note.author} · {note.kind}</small><p>{note.text}</p>
        {space.host === id && note.kind === "question" && <button className="space-text-button" disabled={!online} onClick={() => send({type:"resolve",id:note.id})}>{note.done ? "Reopen" : "Mark resolved"}</button>}
      </li>)}</ul>
    </details>}
  </div>;
}
