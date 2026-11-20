import { useState } from "react";
import { defaultAvatar } from "./documents";
import type { AvatarProfile } from "./protocol";

const skins = ["#f9ddbd","#e5b58e","#c68d65","#9b654b","#684638"];
const backgrounds = ["#dce8cb","#f0d9bc","#d9dfee","#e6d7e7","#d0e5e0"];
export function Avatar({profile, label}: {profile:AvatarProfile;label?:string}) {
  return <svg className="personal-avatar" viewBox="0 0 100 100" role={label?"img":undefined} aria-label={label} aria-hidden={label?undefined:true}>
    <circle cx="50" cy="50" r="49" fill={backgrounds[profile.background]}/>
    <path d="M16 99 Q18 70 50 70 Q82 70 84 99" fill="#385b4d"/>
    <path d="M40 66 L40 80 Q50 87 60 80 L60 66" fill={skins[profile.skin]}/>
    <ellipse cx="50" cy="46" rx="28" ry="32" fill={skins[profile.skin]}/>
    {profile.hair===0 && <path d="M23 42 Q14 8 51 12 Q85 9 77 44 L70 30 Q45 36 31 27 Z" fill="#40322c"/>}
    {profile.hair===1 && <path d="M22 65 Q7 12 50 10 Q93 13 78 68 L72 64 L71 28 Q46 40 30 30 L29 65 Z" fill="#302b2c"/>}
    {profile.hair===2 && <path d="M24 38 Q18 9 42 15 Q49 1 59 15 Q85 8 78 40 L70 32 Q50 20 31 34 Z" fill="#7b5336"/>}
    <g fill="#332a29">
      {profile.expression==="laugh" ? <><path d="M34 45 Q39 39 44 45 M56 45 Q61 39 66 45" fill="none" stroke="#332a29" strokeWidth="2.5" strokeLinecap="round"/></> :
        <><ellipse cx="39" cy="44" rx="2.6" ry={profile.expression==="wow"?4:3}/><ellipse cx="61" cy="44" rx="2.6" ry={profile.expression==="wow"?4:3}/></>}
      {profile.expression==="wow" ? <ellipse cx="50" cy="61" rx="5" ry="7"/> :
        profile.expression==="laugh" ? <path d="M39 56 Q50 80 61 56 Z"/> :
        <path d={profile.expression==="calm"?"M43 61 Q50 64 57 61":"M40 57 Q50 68 60 57"} fill="none" stroke="#7b443c" strokeWidth="2.5" strokeLinecap="round"/>}
    </g>
    {profile.glasses && <g fill="none" stroke="#34463f" strokeWidth="2"><rect x="29" y="37" width="19" height="14" rx="5"/><rect x="52" y="37" width="19" height="14" rx="5"/><path d="M48 42 H52 M24 40 H29 M71 40 H76"/></g>}
  </svg>;
}
export function AvatarEditor({profile,onSave}: {profile?:AvatarProfile;onSave:(value:AvatarProfile)=>void}) {
  const [draft,setDraft] = useState(profile||defaultAvatar);
  return <div className="avatar-editor">
    <Avatar profile={draft} label="Your avatar preview"/>
    <div>
      <label>Skin tone<select aria-label="Avatar skin tone" value={draft.skin} onChange={e=>setDraft({...draft,skin:Number(e.target.value)})}>{skins.map((_,i)=><option key={i} value={i}>Tone {i+1}</option>)}</select></label>
      <label>Hair<select aria-label="Avatar hair" value={draft.hair} onChange={e=>setDraft({...draft,hair:Number(e.target.value)})}>{["Short","Long","Wavy","No hair"].map((name,i)=><option key={name} value={i}>{name}</option>)}</select></label>
      <label>Background<select aria-label="Avatar background" value={draft.background} onChange={e=>setDraft({...draft,background:Number(e.target.value)})}>{["Sage","Sand","Sky","Lilac","Mint"].map((name,i)=><option key={name} value={i}>{name}</option>)}</select></label>
      <label>Expression<select aria-label="Avatar expression" value={draft.expression} onChange={e=>setDraft({...draft,expression:e.target.value as AvatarProfile["expression"]})}>{["smile","laugh","wow","calm"].map(name=><option key={name} value={name}>{name}</option>)}</select></label>
      <label className="avatar-glasses"><input type="checkbox" checked={draft.glasses} onChange={e=>setDraft({...draft,glasses:e.target.checked})}/> Glasses</label>
      <button className="space-button solid" onClick={()=>onSave(draft)}>Save avatar</button>
    </div>
  </div>;
}
