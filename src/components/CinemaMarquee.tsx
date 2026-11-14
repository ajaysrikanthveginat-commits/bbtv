import { useRef } from "react";
import type { PointerEvent } from "react";
import { Play, AudioLines } from "lucide-react";

export function CinemaMarquee() {
  const scene = useRef<HTMLDivElement>(null);
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    scene.current?.style.setProperty("--pitch", `${(0.5 - (event.clientY - bounds.top) / bounds.height) * 15}deg`);
    scene.current?.style.setProperty("--yaw", `${((event.clientX - bounds.left) / bounds.width - 0.5) * 20}deg`);
  }
  function reset() {
    scene.current?.style.removeProperty("--pitch");
    scene.current?.style.removeProperty("--yaw");
  }
  return (
    <div className="marquee-scene" aria-hidden="true" onPointerMove={tilt} onPointerLeave={reset}>
      <div className="marquee-halo" />
      <div className="marquee-grid" />
      <div className="marquee-object" ref={scene}>
        <div className="marquee-shadow" />
        <div className="marquee-display">
          <div className="marquee-picture">
            <div className="marquee-sun" />
            <div className="marquee-ridge ridge-back" />
            <div className="marquee-ridge ridge-front" />
            <div className="marquee-play"><Play size={26} fill="currentColor" /></div>
          </div>
        </div>
        <div className="marquee-ticket">
          <i /><i /><i />
          <span>BBTV</span>
        </div>
        <div className="marquee-audio"><AudioLines size={24} /></div>
      </div>
    </div>
  );
}
