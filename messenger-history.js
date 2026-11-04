/** Received fictional game notes only. Player names and real messages are never stored here. */
export const MESSENGER_STORAGE_KEY='teacher-escape-440-inbox-v1';
export const MAX_RECEIVED_MESSAGES=60;

function localStorageOrNull(){try{return globalThis.localStorage||null;}catch{return null;}}
const text=(value,max=200)=>typeof value==='string'?value.slice(0,max):'';
function clean(entry){
  if(!entry||typeof entry!=='object'||!text(entry.id,80)||!text(entry.subject)||!Array.isArray(entry.lines))return null;
  const missionId=Number.isInteger(entry.missionId)&&entry.missionId>=1&&entry.missionId<=10?entry.missionId:null;
  if(entry.kind!=='banter'&&!missionId)return null;
  return {id:text(entry.id,80),kind:missionId?'mission':'banter',missionId,
    sender:text(entry.sender,80),subject:text(entry.subject),lines:entry.lines.slice(0,2).map(line=>text(line)),
    reply:text(entry.reply),receivedAt:Number.isFinite(entry.receivedAt)?entry.receivedAt:0,
    acknowledgedAt:Number.isFinite(entry.acknowledgedAt)?entry.acknowledgedAt:null};
}
const copy=entry=>entry?{...entry,lines:[...entry.lines]}:null;

export function createMessengerHistory({storage=localStorageOrNull(),now=Date.now}={}){
  let entries=[];
  try{
    const saved=JSON.parse(storage?.getItem(MESSENGER_STORAGE_KEY)||'null');
    if(saved?.version===1&&Array.isArray(saved.entries)){
      const ids=new Set();
      entries=saved.entries.slice(-MAX_RECEIVED_MESSAGES).map(clean).filter(entry=>{
        if(!entry||ids.has(entry.id))return false;ids.add(entry.id);return true;
      });
      // Older/corrupted saves cannot restore several simultaneous unread popups.
      const pending=entries.filter(entry=>entry.acknowledgedAt===null);
      pending.slice(0,-1).forEach(entry=>entry.acknowledgedAt=entry.receivedAt);
    }
  }catch{/* Storage disabled or malformed: keep a usable in-memory inbox. */}
  const persist=()=>{try{storage?.setItem(MESSENGER_STORAGE_KEY,JSON.stringify({version:1,entries}));}catch{}};
  return {
    receive(message){
      const stamp=Number(now())||0;
      let id=`note-${stamp}`,suffix=0;
      while(entries.some(entry=>entry.id===id))id=`note-${stamp}-${++suffix}`;
      const entry=clean({...message,id,receivedAt:stamp,acknowledgedAt:null});
      if(!entry)return null;
      entries.push(entry);entries=entries.slice(-MAX_RECEIVED_MESSAGES);persist();return copy(entry);
    },
    acknowledge(id){
      const entry=entries.find(item=>item.id===id);
      if(!entry||entry.acknowledgedAt!==null)return false;
      entry.acknowledgedAt=Number(now())||0;persist();return true;
    },
    list:()=>entries.map(copy),
    pending:()=>copy(entries.findLast(entry=>entry.acknowledgedAt===null)),
    get:id=>copy(entries.find(entry=>entry.id===id)),
    count:()=>entries.length,
    clear(){entries=[];persist();}
  };
}
