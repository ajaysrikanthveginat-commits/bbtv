import { useEffect, useRef } from 'react';
import { VideoOff, Mic, MicOff } from 'lucide-react';
interface LocalVideoProps {
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  userId: string;
  userName?: string;
  className?: string;
}
export function LocalVideo({stream,videoEnabled,audioEnabled,userName='You',className=''}:LocalVideoProps) {
  const videoRef=useRef<HTMLVideoElement>(null);
  useEffect(()=>{
    const player=videoRef.current;
    if(!player)return;
    player.srcObject=stream;
    if(stream)player.play().catch(()=>{});
    return ()=>{player.srcObject=null;};
  },[stream]);
  const cameraOn=!!stream && videoEnabled && stream.getVideoTracks().some(t=>t.readyState==='live');
  return <div className={`call-tile ${className}`}>
    <div className="call-viewport">
      <video ref={videoRef} autoPlay playsInline muted className={'mirror-mode '+(!cameraOn?'call-video-hidden':'')} />
      {!cameraOn && <div className="call-placeholder"><VideoOff size={22}/><span>{stream?'Camera off':'Your camera is off'}</span></div>}
    </div>
    <div className="call-caption"><span>{userName} <small>(you)</small></span><span aria-label={stream && audioEnabled?'Microphone on':'Microphone off'}>{stream && audioEnabled?<Mic size={14}/>:<MicOff size={14}/>}</span></div>
  </div>;
}
