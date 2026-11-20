import { useEffect, useRef, useState } from "react";
import { Mic, Video, X } from "lucide-react";
import { readLocal, writeLocal } from "./useRoom";

export function DevicePreview({onClose}:{onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const video=useRef<HTMLVideoElement>(null);
  const [camera,setCamera]=useState(false),[microphone,setMicrophone]=useState(false);
  const [cameraId,setCameraId]=useState(()=>readLocal("bbtv.camera"));
  const [microphoneId,setMicrophoneId]=useState(()=>readLocal("bbtv.microphone"));
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
  const [error,setError]=useState(""),[level,setLevel]=useState(0);
  const [connection,setConnection]=useState("Checking connection…");
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    dialog.current?.showModal();
    const controller=new AbortController();
    const started=performance.now();
    fetch("/api/health",{signal:controller.signal,cache:"no-store"}).then(response=>{
      if(!response.ok)throw new Error();
      setConnection("Server reachable · "+Math.round(performance.now()-started)+" ms");
    }).catch(()=>{if(!controller.signal.aborted)setConnection("Server unavailable. Check your connection.");});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    let active=true, stream:MediaStream|undefined, audio:AudioContext|undefined;
    let timer:ReturnType<typeof setInterval>|undefined;
    setReady(false);setLevel(0);setError("");
    if(!camera&&!microphone)return;
    if(!navigator.mediaDevices?.getUserMedia){setError("Device access is unavailable in this browser.");return;}
    void navigator.mediaDevices.getUserMedia({
      video:camera?{deviceId:cameraId?{exact:cameraId}:undefined,width:{ideal:640}}:false,
      audio:microphone?{deviceId:microphoneId?{exact:microphoneId}:undefined}:false,
    }).then(async media=>{
      if(!active){media.getTracks().forEach(track=>track.stop());return;}
      stream=media;
      if(video.current){video.current.srcObject=media;void video.current.play().catch(()=>{});}
      setReady(true);
      const available=await navigator.mediaDevices.enumerateDevices();
      if(!active)return;
      setDevices(available);
      if(microphone&&typeof AudioContext!=="undefined") {
        audio=new AudioContext();
        const analyser=audio.createAnalyser();
        analyser.fftSize=256;
        audio.createMediaStreamSource(media).connect(analyser);
        const values=new Uint8Array(analyser.frequencyBinCount);
        await audio.resume().catch(()=>{});
        if(!active){void audio.close();return;}
        timer=setInterval(()=>{
          analyser.getByteFrequencyData(values);
          if(active)setLevel(Math.min(100,Math.max(...values)/2.55));
        },100);
      }
    }).catch(()=>{if(active)setError("Allow device access in your browser. If a selected device is unavailable, choose Default.");});
    return ()=>{
      active=false;clearInterval(timer);
      stream?.getTracks().forEach(track=>track.stop());
      void audio?.close();
    };
  },[camera,microphone,cameraId,microphoneId]);
  return <dialog ref={dialog} className="device-preview space-invite" aria-labelledby="device-preview-title" onClose={onClose} onCancel={onClose}>
    <button className="space-icon invite-close" aria-label="Close device check" onClick={()=>dialog.current?.close()}><X size={18}/></button>
    <span className="spaces-overline">BEFORE YOU JOIN</span><h2 id="device-preview-title">Check your devices</h2>
    <div className="device-camera"><video ref={video} muted playsInline autoPlay aria-label="Camera preview"/>{!camera&&<span>Camera preview</span>}</div>
    <div className="device-options">
      <button className="space-button" aria-pressed={camera} onClick={()=>setCamera(!camera)}><Video size={16}/>{camera?"Stop camera preview":"Test camera"}</button>
      <button className="space-button" aria-pressed={microphone} onClick={()=>setMicrophone(!microphone)}><Mic size={16}/>{microphone?"Stop mic test":"Test microphone"}</button>
    </div>
    <label>Camera<select aria-label="Preview camera device" value={cameraId} onChange={event=>{setCameraId(event.target.value);writeLocal("bbtv.camera",event.target.value);}}><option value="">Default camera</option>{devices.filter(item=>item.kind==="videoinput").map((item,index)=><option key={item.deviceId} value={item.deviceId}>{item.label||"Camera "+(index+1)}</option>)}</select></label>
    <label>Microphone<select aria-label="Preview microphone device" value={microphoneId} onChange={event=>{setMicrophoneId(event.target.value);writeLocal("bbtv.microphone",event.target.value);}}><option value="">Default microphone</option>{devices.filter(item=>item.kind==="audioinput").map((item,index)=><option key={item.deviceId} value={item.deviceId}>{item.label||"Microphone "+(index+1)}</option>)}</select></label>
    {microphone&&<label className="mic-meter">Speak to test your microphone<meter aria-label="Microphone level" min={0} max={100} value={level}/></label>}
    <p role="status">{error||((camera||microphone)&&!ready?"Waiting for device permission…":connection)}</p>
    {ready&&<p>Devices are ready. Your camera and microphone start off when you enter the room.</p>}
    <button className="space-button solid" onClick={()=>dialog.current?.close()}>Done</button>
  </dialog>;
}
