const CAPACITY=30, BED_COUNT=5, REFRESH_MS=8000, STALE_MS=20000;
export const PUBLIC_CHANNELS=Object.freeze(Array.from({length:10},(_,index)=>Object.freeze({id:index+1,room:index===0?'TEACHERS':`TEACHERS-${index+1}`,capacity:CAPACITY})));
const unknown=()=>PUBLIC_CHANNELS.map(channel=>({...channel,count:null,occupiedBeds:null,freeBeds:null}));
const validId=id=>Number.isInteger(id)&&id>=1&&id<=PUBLIC_CHANNELS.length;

/** Only anonymous totals are accepted from the public directory. */
export function sanitizeChannels(payload){
  if(!payload||!Array.isArray(payload.channels)||!Number.isFinite(payload.serverTime))return null;
  const result=new Map();
  for(const item of payload.channels){
    if(!item||!validId(item.id)||result.has(item.id))return null;
    const channel=PUBLIC_CHANNELS[item.id-1];
    if(item.room!==channel.room||item.capacity!==CAPACITY||!Number.isInteger(item.count)||item.count<0||item.count>CAPACITY||!Number.isInteger(item.occupiedBeds)||item.occupiedBeds<0||item.occupiedBeds>BED_COUNT||item.occupiedBeds>item.count||item.freeBeds!==BED_COUNT-item.occupiedBeds)return null;
    result.set(item.id,{...channel,count:item.count,occupiedBeds:item.occupiedBeds,freeBeds:item.freeBeds});
  }
  return result.size===PUBLIC_CHANNELS.length?PUBLIC_CHANNELS.map(channel=>result.get(channel.id)):null;
}

/** Public numbered channels; the game owns its own movement and mission state. */
export function createChannels({presence,endpoint,getNickname,onChange,onBeforeSwitch,runtime={}}){
  const fetcher=runtime.fetch||((...args)=>fetch(...args));
  const now=runtime.now||(()=>performance.now());
  const doc=runtime.document||globalThis.document;
  let running=false,disposed=false,selected=1,loading=false,connected=false;
  let channelRows=unknown(),directoryKnown=false,refreshedAt=-Infinity,nextRefresh=0;
  let error='',directoryError='',lastReport='',operation=0,directoryEpoch=0,inflight=null;
  let current=presence.getSnapshotStatus?.()||{state:'offline',connected:false,count:0};
  const directoryURL=endpoint?`${endpoint}${endpoint.includes('?')?'&':'?'}channels=1`:'';

  function getSnapshot(){
    const fresh=directoryKnown&&now()-refreshedAt<STALE_MS;
    const channels=(fresh?channelRows:unknown()).map(channel=>({...channel}));
    // Keep each card's participant and bed totals from the same snapshot.
    // The live heartbeat count is exposed separately for the current-channel HUD.
    return {channels,selected,connected,running,loading,refreshing:!!inflight,
      offline:!running,directoryKnown:fresh,
      count:connected?current.count:0,error:error||directoryError,
      message:current.message||'',state:current.state||'offline',nickname:current.nickname||''};
  }
  function report(){const value=getSnapshot(),key=JSON.stringify(value);if(key!==lastReport){lastReport=key;onChange?.(value);}}
  function syncPresence(next=presence.getSnapshotStatus?.()){
    if(!next)return;
    if(running&&next.room&&next.room!==PUBLIC_CHANNELS[selected-1].room)return;
    current=next;
    connected=running&&!!next.connected&&next.room===PUBLIC_CHANNELS[selected-1].room;
    if(connected)error='';
    else if(running&&!loading&&next.wanted&&next.state!=='hidden'&&next.state!=='connecting')error=next.message||'연결을 다시 확인하고 있어요.';
    report();
  }
  function cancelDirectory(){
    directoryEpoch++;
    if(inflight){clearTimeout(inflight.timer);inflight.controller.abort();inflight=null;}
  }
  async function refresh(){
    if(disposed||doc?.hidden)return false;
    if(inflight)return inflight.promise;
    if(!directoryURL){directoryKnown=false;directoryError='채널 현황을 확인할 수 없어요.';nextRefresh=now()+REFRESH_MS;report();return false;}
    const epoch=directoryEpoch,controller=new AbortController(),request={controller,timer:0,promise:null};
    inflight=request;request.timer=setTimeout(()=>controller.abort(),6000);report();
    request.promise=(async()=>{
      try{
        const response=await fetcher(directoryURL,{method:'GET',signal:controller.signal,credentials:'omit',cache:'no-store'});
        if(!response.ok)throw new Error('directory_unavailable');
        const result=sanitizeChannels(await response.json());
        if(epoch!==directoryEpoch||disposed)return false;
        if(!result)throw new Error('invalid_directory');
        channelRows=result;directoryKnown=true;refreshedAt=now();directoryError='';return true;
      }catch{
        if(epoch!==directoryEpoch||disposed)return false;
        // A failed request is unknown availability, never an invented empty room.
        directoryKnown=false;channelRows=unknown();directoryError='접속 현황을 확인 중이에요. 채널 이동은 가능해요.';return false;
      }finally{
        clearTimeout(request.timer);
        if(inflight===request){inflight=null;nextRefresh=now()+REFRESH_MS;report();}
      }
    })();
    return request.promise;
  }
  async function join(id,epoch,automatic=false){
    const from=selected;selected=id;loading=true;connected=false;error='';report();
    try{await onBeforeSwitch?.({from,to:id,automatic});}catch{error='채널 이동을 준비하지 못했어요.';loading=false;report();return false;}
    if(epoch!==operation||!running||disposed)return false;
    const success=await presence.connect({room:PUBLIC_CHANNELS[id-1].room,nickname:getNickname?.()||'퇴근 동료'});
    if(epoch!==operation||!running||disposed)return false;
    current=presence.getSnapshotStatus?.()||current;
    connected=!!success&&!!current.connected&&current.room===PUBLIC_CHANNELS[id-1].room;
    return connected;
  }
  async function start(){
    if(disposed)return false;
    if(running)return connected;
    running=true;loading=true;error='';const epoch=++operation;report();void refresh();
    for(const channel of PUBLIC_CHANNELS){
      if(epoch!==operation||!running||disposed)return false;
      if(channel.id!==1&&directoryKnown&&now()-refreshedAt<STALE_MS&&channelRows[channel.id-1].count>=CAPACITY)continue;
      const joined=await join(channel.id,epoch,true);
      if(epoch!==operation||!running||disposed)return false;
      if(joined){loading=false;report();void refresh();return true;}
      if(current.state!=='full'){
        loading=false;error=current.state==='hidden'?'':current.message||'연결을 다시 확인하고 있어요. 혼자 계속할 수 있어요.';report();return false;
      }
    }
    presence.disconnect();loading=false;connected=false;error='모든 채널이 가득 찼어요. 잠시 뒤 빈 채널을 골라 주세요.';report();return false;
  }
  async function select(id){
    if(disposed||!validId(id))return false;
    if(!running)running=true;
    if(connected&&id===selected)return true;
    if(directoryKnown&&now()-refreshedAt<STALE_MS&&channelRows[id-1].count>=CAPACITY){error=`채널 ${id}은 가득 찼어요. 다른 채널을 골라 주세요.`;report();return false;}
    const previous=selected,previousConnected=connected,epoch=++operation;
    const success=await join(id,epoch);
    if(epoch!==operation||!running||disposed)return false;
    if(!success&&current.state==='full'&&previousConnected&&previous!==id){
      // Occupancy may change after the directory snapshot. Restore the prior
      // channel rather than leaving a connected visitor stranded by that race.
      await join(previous,epoch);
      if(epoch!==operation||!running||disposed)return false;
      error=`채널 ${id}이 방금 가득 찼어요. 이전 채널로 돌아왔어요.`;
    }else if(!success)error=current.state==='hidden'?'':current.message||'연결을 다시 확인하고 있어요. 혼자 계속할 수 있어요.';
    loading=false;report();void refresh();return success;
  }
  function stop(){
    operation++;running=false;loading=false;connected=false;cancelDirectory();presence.disconnect();current=presence.getSnapshotStatus?.()||current;error='';directoryError='';report();
  }
  return {start,select,stop,refresh,getSnapshot,handlePresenceStatus:syncPresence,
    update(_dt,{visible=true}={}){if(disposed)return;if(!running){report();return;}if(!visible||doc?.hidden){if(inflight)cancelDirectory();report();return;}if(!inflight&&now()>=nextRefresh)void refresh();report();},
    dispose(){if(disposed)return;stop();disposed=true;},
  };
}
