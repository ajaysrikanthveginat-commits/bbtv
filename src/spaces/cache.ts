import { roomDocument } from "./documents";
import type { RoomDocument, Space } from "./protocol";
let database:Promise<IDBDatabase>|undefined;
function open() {
  database ??= new Promise((resolve,reject)=>{
    const request = indexedDB.open("bbtv-room-backups",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("rooms",{keyPath:"id"});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return database;
}
export async function cacheRoom(space: Space) {
  const db=await open();
  const document=roomDocument(space);
  return new Promise<void>((resolve,reject)=>{
    const transaction=db.transaction("rooms","readwrite"), store=transaction.objectStore("rooms");
    const read=store.get(document.id);
    read.onsuccess=()=>{if(!read.result || read.result.version<=document.version)store.put(document);};
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error);
  });
}
export async function cachedRoom(id:string):Promise<RoomDocument|undefined> {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const request=db.transaction("rooms").objectStore("rooms").get(id);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
export function downloadBackup(document:RoomDocument) {
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:"bbtv-room",document})],{type:"application/json"}));
  const link=window.document.createElement("a");
  link.download="BBTV-room-backup.json";link.href=url;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
