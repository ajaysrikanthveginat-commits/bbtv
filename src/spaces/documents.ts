import { inkColors, modes, type AvatarProfile, type InkStroke, type RoomBackup, type RoomDocument, type Space } from "./protocol";

export const defaultAvatar: AvatarProfile = {skin:1,hair:0,background:0,glasses:false,expression:"smile"};
export function validAvatar(value: unknown): value is AvatarProfile {
  const avatar = value as AvatarProfile;
  return !!avatar && Object.keys(avatar).every(key=>["skin","hair","background","glasses","expression"].includes(key)) &&
    Number.isInteger(avatar.skin) && avatar.skin >= 0 && avatar.skin < 5 &&
    Number.isInteger(avatar.hair) && avatar.hair >= 0 && avatar.hair < 4 &&
    Number.isInteger(avatar.background) && avatar.background >= 0 && avatar.background < 5 &&
    typeof avatar.glasses === "boolean" && ["smile","laugh","wow","calm"].includes(avatar.expression);
}
export function roomDocument(space: Space | RoomDocument): RoomDocument {
  return {id:space.id,name:space.name,mode:space.mode,notes:space.notes,watch:space.watch,drawing:space.drawing,
    page:space.page,pages:space.pages,version:space.version,updatedAt:space.updatedAt};
}
export function migrateDocument(document: RoomDocument): RoomDocument {
  document.drawing ??= {revision:0,strokes:[]};
  document.page ||= "first";
  document.pages ??= [{id:document.page,title:"Page 1",strokes:document.drawing.strokes}];
  document.version ||= 0;
  document.updatedAt ||= Date.now();
  return document;
}
export function validBackup(value: unknown): value is RoomBackup {
  const backup = value as RoomBackup;
  if (!backup || backup.format !== "bbtv-room" || !backup.document) return false;
  const doc = backup.document;
  if (typeof doc.name !== "string" || !doc.name.trim() || doc.name.length > 64 || !modes.includes(doc.mode)) return false;
  if (!Array.isArray(doc.pages) || !doc.pages.length || doc.pages.length > 6 || !doc.pages.some(page => page.id === doc.page)) return false;
  const pageIds = new Set<string>(), strokeIds = new Set<string>();
  let points = 0;
  for (const page of doc.pages) {
    if (!page || typeof page.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(page.id) || pageIds.has(page.id) ||
      typeof page.title !== "string" || page.title.length > 40 || !Array.isArray(page.strokes) || page.strokes.length > 300) return false;
    pageIds.add(page.id);
    for (const stroke of page.strokes as InkStroke[]) {
      if (!stroke || typeof stroke.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(stroke.id) || strokeIds.has(stroke.id) ||
        typeof stroke.author !== "string" || stroke.author.length > 64 || !inkColors.includes(stroke.color as typeof inkColors[number]) ||
        ![3,6,12,32].includes(stroke.width) || (stroke.style && !["pen","marker","calligraphy"].includes(stroke.style)) ||
        !Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length > 1024) return false;
      strokeIds.add(stroke.id);
      points += stroke.points.length;
      if (points > 40_000 || stroke.points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || p[0]<0 || p[0]>1600 || p[1]<0 || p[1]>1000)) return false;
    }
  }
  const noteIds=new Set<string>();
  if (!Array.isArray(doc.notes) || doc.notes.length > 100 || doc.notes.some(note => {
    if(!note || typeof note.text !== "string" || note.text.length > 500 || typeof note.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(note.id) || noteIds.has(note.id) || typeof note.author !== "string" || note.author.length > 32 ||
      typeof note.done !== "boolean" || !["note","decision","question"].includes(note.kind) ||
      (note.x!==undefined&&(!Number.isFinite(note.x)||note.x<0||note.x>1600)) ||
      (note.y!==undefined&&(!Number.isFinite(note.y)||note.y<0||note.y>1000)) ||
      (note.page!==undefined&&!pageIds.has(note.page)) ||
      (note.position!==undefined&&(!Number.isFinite(note.position)||note.position<0)) ||
      (note.source!==undefined&&(typeof note.source!=="string"||note.source.length>4096)))return true;
    noteIds.add(note.id);return false;
  })) return false;
  return true;
}
export function restoreContent(backup:RoomBackup) {
  const document=backup.document;
  return {
    page:document.page,
    pages:document.pages.map(page=>({id:page.id,title:page.title,strokes:page.strokes.map(stroke=>({
      id:stroke.id,author:stroke.author,color:stroke.color,width:stroke.width,style:stroke.style,
      points:stroke.points.map(point=>[point[0],point[1]] as [number,number]),
    }))})),
    notes:document.notes.map(note=>({id:note.id,author:note.author,kind:note.kind,text:note.text,done:note.done,
      x:note.x,y:note.y,page:note.page,position:note.position,source:note.source})),
  };
}
