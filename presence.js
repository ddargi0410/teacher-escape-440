import * as THREE from './vendor/three.module.js';

export const GREETINGS = Object.freeze({
  wave: '👋 안녕하세요!', cheer: '✊ 퇴근까지 힘내요!', thanks: '🌿 수고 많으셨어요!'
});
const ACTIONS = new Set(['idle','walk','rest','learn','mission']);
const BEDS = new Set(['bed-1','bed-2','bed-3','bed-4','bed-5']);
const COLORS = ['#8faac4','#bda1bf','#8fb89c','#d4ae77','#c59087','#a5a3cb'];
const cleanName = value => Array.from(String(value || '').replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,16).join('') || '퇴근 동료';

function secureIdentity(api) {
  if(typeof api?.getRandomValues!=='function')return null;
  try{
    // randomUUID is secure-context-only on some school browsers. getRandomValues
    // is also cryptographically secure and remains available on local previews.
    const bytes=api.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
    const id=typeof api.randomUUID==='function'?api.randomUUID():`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    const token=[...api.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
    return {id,token};
  }catch{return null;}
}

/** Treat the network as untrusted; labels are always rendered with textContent. */
export function sanitizePresencePlayer(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || value.id.length > 80 || !value.id) return null;
  const {x,y,z,yaw,floor} = value;
  if (![x,y,z,yaw,floor].every(Number.isFinite) || !Number.isInteger(floor) || floor<1 || floor>5 || Math.abs(x)>26 || y<0 || y>18 || z< -8 || z>27 || Math.abs(yaw)>100000) return null;
  const action = ACTIONS.has(value.action) ? value.action : 'idle';
  const bedId = BEDS.has(value.bedId) ? value.bedId : undefined;
  let greeting;
  if (value.greeting && Number.isSafeInteger(value.greeting.seq) && value.greeting.seq>0 && Object.hasOwn(GREETINGS,value.greeting.type) && Number.isFinite(value.greeting.at)) {
    greeting = {seq:value.greeting.seq,type:value.greeting.type,at:value.greeting.at};
  }
  return {id:value.id,nickname:cleanName(value.nickname),x,y,z,yaw,floor,action:action==='rest'&&!bedId?'idle':action,bedId,greeting};
}

/** Polls the hosted presence service; no simulated visitors or same-browser substitute. */
export function createPresence({scene,world,camera,getLocal,onStatus,onGreeting,onGreetingSent,endpoint,runtime={}}) {
  const doc = runtime.document || document;
  const win = runtime.window || window;
  const fetcher = runtime.fetch || ((...args)=>fetch(...args));
  const now = runtime.now || (()=>performance.now());
  const cryptoApi = Object.hasOwn(runtime,'crypto') ? runtime.crypto : globalThis.crypto;
  let identity=null,id=null,token=null;
  const labels = doc.createElement('div');
  labels.className='presence-labels';labels.hidden=true;
  labels.setAttribute('aria-hidden','true');
  doc.body.append(labels);
  const peers = new Map();
  const projection = new THREE.Vector3();
  let room='',nickname='',wanted=false,connected=false,disposed=false;
  let generation=0,inflight=null,nextAt=0,failures=0,sequence=0,pendingGreeting=null,lastGreetAt=-Infinity;
  let status='offline',message='혼자 탐색 중',lastStatusKey='',visible=false,currentFloor=5,phase=0;

  function snapshot() { return {state:status,connected,wanted,count:connected?peers.size+1:0,room,nickname,message,selfId:id}; }
  function report(next, detail) {
    status=next;message=detail;
    const data=snapshot(),key=JSON.stringify(data);
    if(key!==lastStatusKey){lastStatusKey=key;onStatus?.(data);}
  }
  function removePeer(peer) {
    scene.remove(peer.model);peer.label.remove();
    // Teacher geometry/materials belong to world; disposing them would break the school.
  }
  function clearPeers() { for(const peer of peers.values())removePeer(peer);peers.clear();labels.hidden=true; }
  function cancelPoll() {
    generation++;
    if(inflight){clearTimeout(inflight.timer);inflight.controller.abort();inflight=null;}
  }
  function body(leave=false) {
    if(leave)return {room,id,token,leave:true};
    const local=getLocal()||{};
    const data={room,id,token,nickname,x:local.x,y:local.y,z:local.z,yaw:local.yaw,floor:local.floor,action:ACTIONS.has(local.action)?local.action:'idle'};
    if(BEDS.has(local.bedId))data.bedId=local.bedId;
    if(pendingGreeting)data.greeting={...pendingGreeting};
    return data;
  }
  function leave() {
    if(!room||!endpoint)return;
    // Best effort; the service also expires missing heartbeats after 20 seconds.
    try { void Promise.resolve(fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body(true)),keepalive:true,credentials:'omit',cache:'no-store'})).catch(()=>{}); } catch {}
  }
  function makePeer(data) {
    const hash=[...data.id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
    const model=world.createTeacher(COLORS[hash%COLORS.length]);
    model.name='online-teacher';model.position.set(data.x,data.y,data.z);model.rotation.y=data.yaw;scene.add(model);
    const label=doc.createElement('div');label.className='presence-label';
    const greeting=doc.createElement('span');greeting.className='presence-greeting';greeting.hidden=true;
    const name=doc.createElement('span');name.className='presence-name';
    const activity=doc.createElement('span');activity.className='presence-activity';
    label.append(greeting,name,activity);labels.append(label);
    return {model,label,name,activity,bubble:greeting,data,seenGreeting:0,greetingUntil:0,armZ:(model.userData.arms||[]).map(a=>a.rotation.z)};
  }
  function accept(payload) {
    if(!payload||payload.self!==id||!Array.isArray(payload.players)||!Number.isFinite(payload.serverTime))throw new Error('invalid_response');
    const received=new Set();
    for(const item of payload.players.slice(0,30)){
      const data=sanitizePresencePlayer(item);
      if(!data||data.id===id||received.has(data.id)||received.size>=29)continue;
      received.add(data.id);
      let peer=peers.get(data.id);
      if(!peer){peer=makePeer(data);peers.set(data.id,peer);}
      if(peer.data.floor!==data.floor||Math.hypot(peer.data.x-data.x,peer.data.z-data.z)>8)peer.model.position.set(data.x,data.y,data.z);
      peer.data=data;peer.name.textContent=data.nickname;
      peer.activity.textContent=data.action==='rest'?'쉬는 중':data.action==='learn'?'기초 배우는 중':data.action==='mission'?'업무 처리 중':'';
      const greeting=data.greeting;
      if(greeting&&greeting.seq>peer.seenGreeting){
        peer.seenGreeting=greeting.seq;
        const age=Math.max(0,(payload.serverTime-greeting.at)/1000);
        if(age<3){peer.greetingUntil=now()+(3-age)*1000;peer.bubble.textContent=GREETINGS[greeting.type];
          if(visible&&data.floor===currentFloor)onGreeting?.({nickname:data.nickname,type:greeting.type,text:GREETINGS[greeting.type]});
        }
      }
    }
    for(const [key,peer] of peers)if(!received.has(key)){removePeer(peer);peers.delete(key);}
  }
  async function poll() {
    if(disposed||!wanted||doc.hidden||inflight)return false;
    if(!endpoint){connected=false;nextAt=now()+15000;report('offline','함께하기 연결 주소가 준비되지 않았어요.');return false;}
    const epoch=generation,controller=new AbortController();
    const request={controller,timer:0};inflight=request;
    request.timer=setTimeout(()=>controller.abort(),6000);
    const sentGreeting=pendingGreeting?{...pendingGreeting}:null;
    try {
      const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body()),signal:controller.signal,credentials:'omit',cache:'no-store'});
      if(epoch!==generation||disposed||!wanted)return false;
      let payload;
      try{payload=await response.json();}catch{throw new Error('invalid_response');}
      if(epoch!==generation||disposed||!wanted)return false;
      if(!response.ok)throw new Error(payload?.error||'service_unavailable');
      accept(payload);connected=true;failures=0;nextAt=now()+1000;
      if(sentGreeting&&pendingGreeting?.seq===sentGreeting.seq)pendingGreeting=null;
      report('online',`${peers.size+1}명 함께 탐색 중`);
      if(sentGreeting){try{onGreetingSent?.({...sentGreeting});}catch(error){console.warn('Greeting feedback unavailable',error);}}
      return true;
    } catch(error) {
      if(epoch!==generation||disposed||!wanted)return false;
      connected=false;clearPeers();failures++;nextAt=now()+Math.min(15000,1000*2**Math.min(failures,4));
      if(error.message==='room_full')report('full','채널이 가득 찼어요. 다른 채널로 이동해 주세요.');
      else if(error.message==='session_conflict')report('offline','접속 정보가 겹쳤어요. 새로고침 후 다시 연결해 주세요.');
      else report('reconnecting','연결을 다시 확인 중이에요. 혼자 계속할 수 있어요.');
      return false;
    } finally {
      clearTimeout(request.timer);if(inflight===request)inflight=null;
    }
  }
  function disconnect() {
    if(disposed)return;
    const wasWanted=wanted;cancelPoll();if(wasWanted)leave();
    wanted=false;connected=false;pendingGreeting=null;clearPeers();report('offline','혼자 탐색 중');
  }
  function onVisibility() {
    if(disposed||!wanted)return;
    if(doc.hidden){cancelPoll();leave();connected=false;clearPeers();report('hidden','다른 탭을 보는 동안 잠시 나가 있어요.');}
    else{nextAt=0;report('connecting','연수실에 다시 들어가는 중…');void poll();}
  }
  const onPageHide=()=>{if(wanted){cancelPoll();leave();connected=false;clearPeers();}};
  doc.addEventListener('visibilitychange',onVisibility);
  win.addEventListener('pagehide',onPageHide);

  return {
    async connect(options={}) {
      if(disposed)return false;
      const nextIdentity=secureIdentity(cryptoApi);
      if(!nextIdentity){report('offline','이 브라우저에서는 함께하기를 사용할 수 없어요. 혼자 탐색은 계속돼요.');return false;}
      const nextRoom=String(options.room||'').trim().toUpperCase();
      if(!/^[A-Z0-9_-]{4,24}$/.test(nextRoom)){report('offline','방 코드는 영문·숫자 4~24자로 적어 주세요.');return false;}
      if(wanted)disconnect();
      // A channel switch starts a new session. The old channel's delayed leave
      // or heartbeat must never delete or overwrite the new channel's player.
      identity=nextIdentity;id=identity.id;token=identity.token;sequence=0;
      room=nextRoom;nickname=cleanName(options.nickname);wanted=true;connected=false;failures=0;nextAt=0;pendingGreeting=null;lastGreetAt=-Infinity;
      report(doc.hidden?'hidden':'connecting',doc.hidden?'게임 화면으로 돌아오면 연결돼요.':'연수실에 들어가는 중…');
      return await poll();
    },
    disconnect,
    update(dt,options={}) {
      if(disposed)return;
      visible=!!options.visible&&!doc.hidden;currentFloor=options.floor||getLocal()?.floor||5;
      if(wanted&&!doc.hidden&&!inflight&&now()>=nextAt)void poll();
      const step=Math.max(0,Math.min(.1,Number(dt)||0));phase+=step*10;
      labels.hidden=!visible||!connected;
      for(const peer of peers.values()){
        const data=peer.data,show=visible&&connected&&data.floor===currentFloor;
        peer.model.visible=show;peer.label.hidden=!show;if(!show)continue;
        const greetingActive=peer.greetingUntil>now();
        const resting=data.action==='rest'&&data.bedId&&data.floor===1;
        if(resting)world.setRestPose?.(peer.model,data.bedId,Math.abs(Math.sin(data.yaw))>.5?'side':'back');
        else{
          world.clearRestPose?.(peer.model);
          peer.model.position.lerp(new THREE.Vector3(data.x,data.y,data.z),1-Math.exp(-7*step));
          const delta=Math.atan2(Math.sin(data.yaw-peer.model.rotation.y),Math.cos(data.yaw-peer.model.rotation.y));
          peer.model.rotation.y+=delta*Math.min(1,step*9);
          world.animateCharacter?.(peer.model,phase,data.action==='walk'?1:0);
        }
        if(!resting)(peer.model.userData.arms||[]).forEach((arm,index)=>arm.rotation.z=peer.armZ[index]);
        if(greetingActive&&!resting){const arm=peer.model.userData.arms?.[1];if(arm){arm.rotation.z=-2.2;arm.rotation.x=Math.sin(phase*1.5)*.3;}}
        peer.bubble.hidden=!greetingActive;
        projection.copy(peer.model.position);projection.y+=resting?1:2.65;projection.project(camera);
        const offscreen=projection.z>1||projection.z< -1||Math.abs(projection.x)>1.05||Math.abs(projection.y)>1.05;
        peer.label.hidden=offscreen;
        peer.label.style.left=`${(projection.x*.5+.5)*win.innerWidth}px`;
        peer.label.style.top=`${(-projection.y*.5+.5)*win.innerHeight}px`;
      }
    },
    greet(type='wave') {
      if(!connected||!Object.hasOwn(GREETINGS,type)||now()-lastGreetAt<2000)return false;
      lastGreetAt=now();pendingGreeting={seq:++sequence,type};nextAt=Math.min(nextAt,now()+350);return true;
    },
    isConnected:()=>connected&&!disposed,
    get count(){return connected?peers.size+1:0;},
    getSnapshotStatus:snapshot,
    getOccupiedBeds:()=>connected?[...peers.values()].filter(peer=>peer.data.floor===1&&peer.data.action==='rest'&&BEDS.has(peer.data.bedId))
      .map(peer=>({bedId:peer.data.bedId,nickname:peer.data.nickname,id:peer.data.id})):[],
    getBedConflict(bedId) {
      if(!connected||!BEDS.has(bedId))return null;
      const resting=[...peers.values()].filter(peer=>peer.data.floor===1&&peer.data.action==='rest'&&BEDS.has(peer.data.bedId));
      if(!resting.some(peer=>peer.data.bedId===bedId&&peer.data.id<id))return null;
      const freeBedId=[...BEDS].find(candidate=>candidate!==bedId&&!resting.some(peer=>peer.data.bedId===candidate))||null;
      return {conflict:true,freeBedId};
    },
    dispose() {
      if(disposed)return;disconnect();disposed=true;
      doc.removeEventListener('visibilitychange',onVisibility);win.removeEventListener('pagehide',onPageHide);labels.remove();
    }
  };
}
