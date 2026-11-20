import type { InkPoint, InkStroke } from "./protocol";
function pathData(points:InkPoint[]) {
  const [first,...rest]=points;
  if(!first)return "";
  if(!rest.length)return `M ${first.join(" ")} l .1 .1`;
  const curves=rest.slice(0,-1).map((point,index)=>{const next=rest[index+1];return `Q ${point.join(" ")} ${(point[0]+next[0])/2} ${(point[1]+next[1])/2}`;});
  return `M ${first.join(" ")} ${curves.join(" ")} L ${rest.at(-1)!.join(" ")}`;
}
function calligraphyData(stroke:InkStroke) {
  const edge=stroke.width*.8;
  return "M "+[...stroke.points.map(([x,y])=>[x+edge,y-edge*.4]),...[...stroke.points].reverse().map(([x,y])=>[x-edge,y+edge*.4])].map(point=>point.join(" ")).join(" L ")+" Z";
}
export function InkPaths({strokes}: {strokes:InkStroke[]}) {
  return <>{strokes.map(stroke=>{
    const nib=stroke.style==="calligraphy"&&stroke.color!=="erase"&&stroke.points.length>1;
    const color=stroke.color==="erase"?"#fffef9":stroke.color;
    return <path key={stroke.id} data-stroke={stroke.id} data-pen={stroke.style||"pen"} d={nib?calligraphyData(stroke):pathData(stroke.points)}
      stroke={color} strokeWidth={stroke.style==="marker"&&stroke.color!=="erase" ? stroke.width*3 : nib ? .5 : stroke.width}
      fill={nib?color:"none"} opacity={stroke.style==="marker"&&stroke.color!=="erase" ? .35 : 1} strokeLinecap={stroke.style==="marker"?"square":"round"} strokeLinejoin="round"/>;
  })}</>;
}
