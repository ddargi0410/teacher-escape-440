import {normalizeAnalyticsNickname} from './analytics-identity.js?v=20261106-nicknames1';
import {ANALYTICS_STORAGE_KEY,isAnalyticsPreview} from './analytics.js?v=20261106-nicknames1';

export const HONORS_HEARTBEAT_MS=10_000;
export const HONORS_REFRESH_MS=30_000;
const TIMEOUT_MS=8_000,RETRY_MS=2_000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const honorsDate=ms=>new Date(ms+9*60*60*1000).toISOString().slice(0,10);
const complete=state=>state?.finished===true&&Array.isArray(state.completed)&&state.completed.length===10&&Array.from({length:10},(_,i)=>i+1).every(id=>state.completed.includes(id));
function makeId(crypto){
 try{
  if(typeof crypto?.randomUUID==='function')return crypto.randomUUID();
  if(typeof crypto?.getRandomValues!=='function')return null;
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const h=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
 }catch{return null;}
}
function validatedBoard(value){
 if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(value.generatedAt))return null;
 const winner=(entry,kind)=>{
  if(entry===null)return null;
  if(!entry||!normalizeAnalyticsNickname(entry.nickname)||!Number.isFinite(entry.achievedAt))throw new Error('invalid_board');
  if(kind==='fastest'&&(!Number.isFinite(entry.schoolMinutes)||!Number.isFinite(entry.elapsedSeconds)))throw new Error('invalid_board');
  if(kind==='rest'&&(!Number.isFinite(entry.restSeconds)||entry.restSeconds<0))throw new Error('invalid_board');
  return {...entry,nickname:normalizeAnalyticsNickname(entry.nickname)};
 };
 try{return {date:value.date,generatedAt:value.generatedAt,fastest:winner(value.fastest,'fastest'),rest:winner(value.rest,'rest')};}catch{return null;}
}

/** Independent best-effort records: no answer text, timers, or gameplay depend on the network. */
export function createHonors({endpoint,getState,getActivity=()=>({visible:false,resting:false}),onStateChange=()=>{},onData=()=>{},onStatus=()=>{},runtime={}}){
 const win=runtime.window??globalThis.window,doc=runtime.document??globalThis.document;
 const location=runtime.location??win?.location,fetcher=runtime.fetch??globalThis.fetch?.bind(globalThis);
 const crypto=Object.hasOwn(runtime,'crypto')?runtime.crypto:globalThis.crypto;
 const Controller=runtime.AbortController??globalThis.AbortController;
 const now=runtime.now??Date.now,later=runtime.setTimeout??globalThis.setTimeout,cancel=runtime.clearTimeout??globalThis.clearTimeout;
 let storage;try{storage=Object.hasOwn(runtime,'storage')?runtime.storage:win?.localStorage;}catch{}
 const enabled=typeof endpoint==='string'&&/^https:\/\//.test(endpoint)&&!isAnalyticsPreview(location)&&typeof fetcher==='function'&&typeof Controller==='function';
 let started=false,disposed=false,pageHidden=false,visitorId=null,sessionId=null,seq=0,runState=null,runActive=false;
 let activity={visible:false,resting:false},heartbeatTimer=null,readTimer=null,pending=null,queued=null,readPending=null;
 let board=null,clockOffset=0;
 const finishQueue=[],finishRecords=new Map(),retryTimers=new Set();
 const safe=(fn,...args)=>{try{fn(...args);}catch{}};
 const approxNow=()=>now()+clockOffset;
 const empty=()=>({date:honorsDate(approxNow()),generatedAt:approxNow(),fastest:null,rest:null});
 function clearTimer(name){if(name!==null)cancel(name);}
 function checkDay(){
  const date=honorsDate(approxNow());
  if(board&&board.date!==date){board=empty();safe(onData,board);safe(onStatus,'loading');return true;}
  return false;
 }
 function currentActivity(){
  let value={};try{value=getActivity()||{};}catch{}
  const visible=runActive&&!pageHidden&&!doc?.hidden&&value.visible===true;
  return {visible,resting:visible&&value.resting===true};
 }
 function scheduleHeartbeat(){
  clearTimer(heartbeatTimer);heartbeatTimer=null;
  if(disposed||!enabled||!runActive||!activity.visible)return;
  heartbeatTimer=later(()=>{heartbeatTimer=null;sync(true);},HONORS_HEARTBEAT_MS);
 }
 function payload(event,flags){
  const state=runState,nickname=normalizeAnalyticsNickname(state?.name);
  if(!state||!nickname||!visitorId||!sessionId||!UUID.test(state.honorsRunId||'')||seq>=1e9)return null;
  if(!Number.isFinite(state.elapsed)||state.elapsed<0||state.elapsed>604800||!Number.isFinite(state.penalty)||state.penalty<0||state.penalty>360)return null;
  const completed=Array.isArray(state.completed)?[...new Set(state.completed)].filter(id=>Number.isInteger(id)&&id>=1&&id<=10).sort((a,b)=>a-b):[];
  return {visitorId,sessionId,runId:state.honorsRunId,seq:++seq,nickname,event,elapsedSeconds:state.elapsed,penaltyMinutes:state.penalty,completed,...flags};
 }
 function abortPost(){
  if(!pending)return;const old=pending;pending=null;clearTimer(old.timer);try{old.controller.abort();}catch{}
 }
 function drain(){
  if(pending||disposed)return;
  while(finishQueue.length){
   const next=finishQueue.shift();
   if(finishRecords.get(next.body.runId)===next&&next.date===honorsDate(approxNow())&&next.attempt<3){send(next);return;}
  }
  const next=queued;queued=null;if(next)send(next);
 }
 function send(record,urgent=false){
  if(!record||disposed||!enabled)return;
  const isFinish=record.body.event==='finish';
  if(isFinish){
   if(finishRecords.get(record.body.runId)!==record){drain();return;}
   if(pending?.record===record)return;
   if(record.retryTimer!==undefined){clearTimer(record.retryTimer);retryTimers.delete(record.retryTimer);delete record.retryTimer;}
   if(record.date!==honorsDate(approxNow())||record.attempt>=3){finishRecords.delete(record.body.runId);drain();return;}
   // Completing another run or leaving the tab must never cancel a finish.
   if(pending?.record.body.event==='finish'){
    if(!finishQueue.includes(record))finishQueue.push(record);
    return;
   }
   if(pending){queued=null;abortPost();}
  }else{
   if(pending?.record.body.event==='finish'||finishQueue.length){queued=record;return;}
   if(pending&&!urgent){queued=record;return;}
   if(urgent){queued=null;abortPost();}
  }
  if(isFinish)record.attempt++;
  const controller=new Controller(),request={controller,timer:null,record};pending=request;
  const finish=(ok,status=0)=>{
   if(pending!==request)return;pending=null;clearTimer(request.timer);
   if(isFinish){
    if(ok){finishRecords.delete(record.body.runId);void refresh();}
    else if((status===0||status>=500||status===429)&&record.attempt<3&&record.date===honorsDate(approxNow())){
     const timer=later(()=>{retryTimers.delete(timer);delete record.retryTimer;send(record);},RETRY_MS);record.retryTimer=timer;retryTimers.add(timer);
    }else finishRecords.delete(record.body.runId);
   }
   drain();
  };
  request.timer=later(()=>{try{controller.abort();}catch{}finish(false);},TIMEOUT_MS);
  try{Promise.resolve(fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record.body),credentials:'omit',cache:'no-store',keepalive:record.keepalive,signal:controller.signal}))
   .then(response=>finish(response?.ok===true,response?.status||0),()=>finish(false));}catch{finish(false);}
 }
 function record(event,flags,urgent=false){
  const body=payload(event,flags);if(!body)return;
  const value={body,date:honorsDate(approxNow()),attempt:0,keepalive:event==='finish'||!flags.visible};
  if(event==='finish')finishRecords.set(body.runId,value);send(value,urgent);
 }
 function sync(force=false){
  if(disposed||!runActive)return;
  const next=currentActivity(),changed=next.visible!==activity.visible||next.resting!==activity.resting;
  activity=next;
  if(changed||force)record('heartbeat',next,!next.visible);
  scheduleHeartbeat();
 }
 function scheduleRead(){clearTimer(readTimer);readTimer=null;if(started&&!disposed&&enabled)readTimer=later(()=>{readTimer=null;void refresh();},HONORS_REFRESH_MS);}
 function refresh(){
  checkDay();
  if(disposed||!enabled||pageHidden||doc?.hidden){scheduleRead();return Promise.resolve(false);}
  if(readPending)return readPending.promise;
  const controller=new Controller(),request={controller,timer:null,promise:null};readPending=request;
  request.promise=new Promise(resolve=>{
   const finish=(value)=>{
    if(readPending!==request)return;readPending=null;clearTimer(request.timer);
    if(value){clockOffset=value.generatedAt-now();board=value;safe(onData,board);safe(onStatus,'ready');}
    else{checkDay();safe(onStatus,'error');}
    scheduleRead();resolve(!!value);
   };
   request.timer=later(()=>{try{controller.abort();}catch{}finish(null);},TIMEOUT_MS);
   try{Promise.resolve(fetcher(endpoint,{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal}))
    .then(async response=>response?.ok?validatedBoard(await response.json()):null).then(finish,()=>finish(null));}catch{finish(null);}
  });
  return request.promise;
 }
 function hidden(){sync(true);checkDay();if(!doc?.hidden&&!pageHidden)void refresh();}
 function hide(){pageHidden=true;sync(true);for(const record of finishRecords.values())if(record.date===honorsDate(approxNow()))send(record,true);}
 function show(){pageHidden=false;sync(true);void refresh();}
 const api={
  start(){
   if(started||disposed)return enabled&&!disposed;started=true;board=empty();safe(onData,board);safe(onStatus,enabled?'loading':'ready');
   if(!enabled)return false;
   doc?.addEventListener?.('visibilitychange',hidden);win?.addEventListener?.('pagehide',hide);win?.addEventListener?.('pageshow',show);void refresh();return true;
  },
  startRun(){
   api.stopRun();if(!started)api.start();if(disposed||!enabled)return false;
   const state=getState?.();if(!state||state.finished)return false;
   try{visitorId=storage?.getItem(ANALYTICS_STORAGE_KEY)||visitorId;}catch{}
   if(!UUID.test(visitorId||'')){visitorId=makeId(crypto);if(visitorId)try{storage?.setItem(ANALYTICS_STORAGE_KEY,visitorId);}catch{}}
   if(!sessionId)sessionId=makeId(crypto);
   if(!visitorId||!sessionId)return false;
   if(!UUID.test(state.honorsRunId||'')){state.honorsRunId=makeId(crypto);safe(onStateChange);}
   if(!state.honorsRunId)return false;
   runState=state;runActive=true;activity={visible:false,resting:false};sync(true);void refresh();return true;
  },
  stopRun(){
   if(!runActive)return;activity={visible:false,resting:false};record('heartbeat',activity,true);runActive=false;clearTimer(heartbeatTimer);heartbeatTimer=null;
  },
  finish(){
   if(disposed||!enabled||!runActive||!complete(runState)||runState.elapsed<1)return false;
   record('finish',{visible:!doc?.hidden&&!pageHidden,resting:false},true);runActive=false;activity={visible:false,resting:false};clearTimer(heartbeatTimer);heartbeatTimer=null;return true;
  },
  sync,
  update(){if(checkDay())void refresh();if(runActive){const next=currentActivity();if(next.visible!==activity.visible||next.resting!==activity.resting)sync();}},
  refresh,
  dispose(){
   if(disposed)return;api.stopRun();disposed=true;clearTimer(heartbeatTimer);clearTimer(readTimer);for(const timer of retryTimers)clearTimer(timer);retryTimers.clear();finishQueue.length=0;finishRecords.clear();abortPost();
   if(readPending){clearTimer(readPending.timer);try{readPending.controller.abort();}catch{}readPending=null;}
   doc?.removeEventListener?.('visibilitychange',hidden);win?.removeEventListener?.('pagehide',hide);win?.removeEventListener?.('pageshow',show);
  }
 };
 return api;
}
