import * as THREE from './vendor/three.module.js';

// Navigation is deliberately authored, not random: every segment stays in an
// aisle. Each floor owns its idle state and only the active floor is advanced.
export const CROWD_ROUTES = Object.freeze({
  children: [
    [[-10,4.05],[10,4.05],[10,6.75],[-10,6.75]],
    [[-7,6.75],[10,6.75],[10,4.05],[-10,4.05],[-10,6.75]]
  ],
  parent: [[-8.5,5.05],[8.5,5.05],[8.5,7.1],[-8.5,7.1]],
  principal: [[0,4.9],[10.8,4.9],[10.8,3.55],[-10.8,3.55],[-10.8,4.9],[0,4.9]],
  vice: [[-7,3.35],[-9,3.35],[-9,4.85],[-7,4.85]]
});
export const PRINCIPAL_VIEW = Object.freeze({range:7,halfAngle:Math.PI*42/180});

export function animateCharacter(model,phase,speed=1) {
  const amount=Math.min(1,Math.max(0,speed));
  (model?.userData?.legs||[]).forEach((leg,i)=>{leg.rotation.x=Math.sin(phase+i*Math.PI)*.47*amount;});
  (model?.userData?.arms||[]).forEach((arm,i)=>{arm.rotation.x=-Math.sin(phase+i*Math.PI)*.38*amount;});
}

// Segment/AABB slab intersection. Ignore furniture too low to conceal a person.
export function rayBlockDistance(origin,direction,range,colliders,padding=0) {
  let nearest=range;
  for(const c of colliders){
    if(c.blocksSight===false)continue;
    let low=0,high=range;
    for(const [axis,size] of [['x','w'],['z','d']]){
      const lo=c[axis]-c[size]/2-padding,hi=c[axis]+c[size]/2+padding,d=direction[axis];
      if(Math.abs(d)<1e-8){if(origin[axis]<lo||origin[axis]>hi){high=-1;break;}}
      else {const a=(lo-origin[axis])/d,b=(hi-origin[axis])/d;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));}
    }
    if(high>=Math.max(0,low))nearest=Math.min(nearest,Math.max(0,low));
  }
  return nearest;
}
export function hasLineOfSight(origin,target,colliders){
  const dx=target.x-origin.x,dz=target.z-origin.z,d=Math.hypot(dx,dz);
  if(d<.001)return true;
  return rayBlockDistance(origin,{x:dx/d,z:dz/d},d,colliders)>=d-.025;
}
export function inPrincipalView(origin,yaw,target,colliders){
  const dx=target.x-origin.x,dz=target.z-origin.z,d=Math.hypot(dx,dz);
  if(d>PRINCIPAL_VIEW.range||d<.15)return false;
  const dot=(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/d;
  return dot>=Math.cos(PRINCIPAL_VIEW.halfAngle)&&hasLineOfSight(origin,target,colliders);
}
export function pointBlocked(point,colliders,radius=.33){
  return colliders.some(c=>{const x=Math.max(c.x-c.w/2,Math.min(point.x,c.x+c.w/2)),z=Math.max(c.z-c.d/2,Math.min(point.z,c.z+c.d/2));return (point.x-x)**2+(point.z-z)**2<radius**2;});
}

export function createCrowd({floors,questObjects,teacher,mesh,geo,mat,random=Math.random}) {
  const actors=[],byMission=new Map();
  let clock=0,globalGrace=4,lastFloor=null,principalDirection=-1,actionCooldown=0,actionsEnabled=false;
  function addActor({id,model,floor,route,speed=.75,kind='npc',missionId=null,wait=1.8}){
    const a={id,model,floor,route:route.map(([x,z])=>({x,z})),speed,kind,missionId,wait,index:1,pause:wait,phase:0,cooldown:0,lock:0,updates:0,
      defeated:false,respawnRemaining:0,respawns:0,lineIndex:0};
    model.name=id;model.userData.crowdActor=a;model.position.set(a.route[0].x,0,a.route[0].z);actors.push(a);return a;
  }
  for(const [id,q]of questObjects){
    const floor=id===10?1:6-Math.ceil(id/2),cx=q.npc.position.x;
    const route=id===10?[[7,7],[8.5,6.6]]:[[cx,-3],[cx+.95,-4.9],[cx+.95,.65],[cx-.95,.65]];
    const a=addActor({id:'mission-npc-'+id,model:q.npc,floor,route,speed:.55,missionId:id});byMission.set(id,a);
  }
  for(let floor=1;floor<=5;floor++){
    const inside=floors.get(floor).inside;
    for(let n=0;n<2;n++){
      const model=teacher(inside,0,0,0,n?'#dd9b69':'#80b2be',false,{id:`child-${floor}-${n}`,role:'child'});model.scale.setScalar(.64);
      addActor({id:`child-${floor}-${n}`,model,floor,route:CROWD_ROUTES.children[n],speed:n?3.7:3.5,kind:'child',wait:0});
    }
    // Preallocate one fictional complaint caller on each floor. Only the
    // player's floor moves, so adding encounters costs no off-floor simulation.
    const parentModel=teacher(inside,0,0,0,floor%2?'#b87d81':'#aa82ad',false,{id:`complaint-parent-${floor}`,role:'parent'});
    const hand=parentModel.userData.arms?.[1]||parentModel;
    mesh(hand,geo('BoxGeometry',.16,.28,.055),mat('#405258'),0,-.43,.16);
    mesh(hand,geo('BoxGeometry',.12,.21,.012),mat('#deebe2'),0,-.43,.195);
    const caller=addActor({id:`complaint-parent-${floor}`,model:parentModel,floor,route:CROWD_ROUTES.parent,speed:.58,kind:'parent',wait:1.7});
    caller.cooldown=5;
  }
  const principal=addActor({id:'principal-patrol',model:teacher(floors.get(5).inside,0,0,0,'#5d7b73',true,{id:'principal-patrol',role:'principal'}),floor:5,route:CROWD_ROUTES.principal,speed:.72,kind:'principal',wait:.65});
  // Floor projection is clipped against the same occluders used for detection.
  const segments=28,positions=new Float32Array(segments*9);
  const coneGeometry=new THREE.BufferGeometry();coneGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const cone=new THREE.Mesh(coneGeometry,new THREE.MeshBasicMaterial({color:'#edac55',transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}));cone.position.y=.025;cone.name='principal-sight-cone';cone.renderOrder=1;principal.model.add(cone);
  const vice=addActor({id:'vice-principal',model:teacher(floors.get(4).inside,0,0,0,'#9e8eae',true,{id:'vice-principal',role:'vice'}),floor:4,route:CROWD_ROUTES.vice,speed:.65,kind:'vice',wait:1});
  vice.cooldown=8;

  function head(a){return a.model.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,(a.model.userData.headHeight||2.35)*a.model.scale.y,0));}
  function syncQuest(a){
    if(a.missionId===null)return;
    const q=questObjects.get(a.missionId),p=a.model.position;
    q.ring.position.set(p.x,.035,p.z);q.crystal.position.x=p.x;q.crystal.position.z=p.z;q.number.position.x=p.x;q.number.position.z=p.z;
    const item=floors.get(a.floor).interactables.find(i=>i.missionId===a.missionId);
    if(item){item.x=p.x;item.z=p.z;item.y=(a.floor-1)*4;}
  }
  function face(a,target,dt){
    const yaw=Math.atan2(target.x-a.model.position.x,target.z-a.model.position.z);
    const delta=Math.atan2(Math.sin(yaw-a.model.rotation.y),Math.cos(yaw-a.model.rotation.y));
    a.model.rotation.y+=delta*Math.min(1,dt*7);
  }
  function updateCone(){
    const p=principal.model.position,yaw=principal.model.rotation.y,cs=floors.get(principal.floor).colliders;
    for(let i=0;i<segments;i++){
      for(let k=0;k<2;k++){
        const angle=-PRINCIPAL_VIEW.halfAngle+(i+k)/segments*PRINCIPAL_VIEW.halfAngle*2;
        const direction={x:Math.sin(yaw+angle),z:Math.cos(yaw+angle)};
        const dist=rayBlockDistance(p,direction,PRINCIPAL_VIEW.range,cs);
        const off=i*9+(k+1)*3;positions[off]=Math.sin(angle)*dist;positions[off+1]=0;positions[off+2]=Math.cos(angle)*dist;
      }
    }
    coneGeometry.attributes.position.needsUpdate=true;coneGeometry.computeBoundingSphere();
  }
  function advanceFloor(){
    if(principal.floor===1)principalDirection=1;else if(principal.floor===5)principalDirection=-1;
    principal.floor+=principalDirection;floors.get(principal.floor).inside.add(principal.model);
    principal.model.position.set(0,0,4.9);principal.index=1;principal.pause=2;principal.cooldown=8;
  }
  function navigate(a,dt){
    const p=a.model.position;
    if(a.pause>0){a.pause-=dt;animateCharacter(a.model,a.phase,0);if(a.kind==='npc'){
      const hand=a.model.userData.arms?.[0];if(hand)hand.rotation.x=-.45+Math.sin(clock*2)*.12;
    }return;}
    const target=a.route[a.index],dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz),step=a.speed*dt;
    if(dist<=step){p.x=target.x;p.z=target.z;a.index=(a.index+1)%a.route.length;a.pause=a.wait;
      if(a.kind==='principal'&&a.index===0){advanceFloor();return;}
    }else{
      const next={x:p.x+dx/dist*step,z:p.z+dz/dist*step};
      // Safety guard for future furniture edits; never push a character through it.
      if(!pointBlocked(next,floors.get(a.floor).colliders,.28*a.model.scale.x)){p.x=next.x;p.z=next.z;}
    }
    face(a,target,dt);a.phase+=dt*a.speed*3.2;animateCharacter(a.model,a.phase,Math.min(1,a.speed));
  }
  function respawn(a,position){
    const candidates=a.route.map((point,index)=>({point,index})).filter(({point})=>
      Math.hypot(point.x-position.x,point.z-position.z)>4&&
      !pointBlocked(point,floors.get(a.floor).colliders,.28*a.model.scale.x));
    if(!candidates.length){a.respawnRemaining=1;return;}
    const next=candidates[a.respawns%candidates.length];
    a.model.position.set(next.point.x,0,next.point.z);a.index=(next.index+1)%a.route.length;
    a.defeated=false;a.respawnRemaining=0;a.respawns++;a.pause=.8;a.cooldown=3;a.lock=0;
    a.model.visible=true;animateCharacter(a.model,0,0);
  }
  function useAction(kind,position,floor=lastFloor){
    if(!actionsEnabled||!position||floor!==lastFloor||!floors.has(floor)||!['talk','whistle'].includes(kind))return {ok:false,reason:'empty'};
    if(actionCooldown>0)return {ok:false,reason:'cooldown'};
    const range=kind==='talk'?3.5:2.4;
    const target=actors.filter(a=>a.floor===floor&&!a.defeated&&(a.kind==='child'||a.kind==='parent'))
      .map(a=>({a,distance:Math.hypot(position.x-a.model.position.x,position.z-a.model.position.z)}))
      .filter(({a,distance})=>distance<=range&&hasLineOfSight(position,a.model.position,floors.get(floor).colliders))
      .sort((a,b)=>a.distance-b.distance)[0]?.a;
    if(!target)return {ok:false,reason:'empty'};
    actionCooldown=1.2;target.defeated=true;target.lock=0;target.cooldown=0;
    target.respawnRemaining=20+Math.max(0,Math.min(1,Number(random())||0))*15;
    target.model.visible=false;animateCharacter(target.model,0,0);
    return {ok:true,actor:target.model,targetKind:target.kind,kind,
      text:kind==='talk'?'한 분씩, 차례대로 말씀하세요.':target.kind==='child'?'삐익! 복도에서는 천천히 걸어요.':'삐익! 한 분씩 차례대로요.',
      response:'잠깐 진정하고 올게요!',respawnIn:target.respawnRemaining};
  }
  function update(dt,{position,floor,enabled=true,onEvent}={}){
    actionsEnabled=!!enabled&&!!position&&floors.has(floor);
    if(!actionsEnabled)return;
    dt=Math.max(0,Math.min(.05,Number(dt)||0));clock+=dt;
    actionCooldown=Math.max(0,actionCooldown-dt);
    if(lastFloor!==floor){globalGrace=2;lastFloor=floor;}
    globalGrace=Math.max(0,globalGrace-dt);
    for(const a of actors){
      if(a.floor!==floor)continue;
      a.updates++;a.cooldown=Math.max(0,a.cooldown-dt);a.lock=Math.max(0,a.lock-dt);
      if(a.defeated){a.respawnRemaining-=dt;if(a.respawnRemaining<=0)respawn(a,position);continue;}
      const distance=Math.hypot(position.x-a.model.position.x,position.z-a.model.position.z);
      if(a.kind==='npc'&&distance<2){face(a,position,dt);animateCharacter(a.model,a.phase,0);}
      else if(a.lock>0){face(a,position,dt);animateCharacter(a.model,a.phase,0);}
      else navigate(a,dt);
      if(a.floor!==floor)continue;
      syncQuest(a);
      if(globalGrace>0||a.cooldown>0)continue;
      if(a.kind==='child'&&distance<.72){
        a.cooldown=5;a.lock=.6;onEvent?.({type:'stumble',duration:1,actor:a.model,text:'선생님! 쟤가 먼저 했어요!'});
      }else if(a.kind==='principal'&&inPrincipalView(a.model.position,a.model.rotation.y,position,floors.get(floor).colliders)){
        a.cooldown=20;a.lock=5;onEvent?.({type:'principal',duration:5,actor:a.model,text:'선생님, 잠깐만요~',penalty:1});
      }else if(a.kind==='vice'&&distance<2.1){
        a.cooldown=18;onEvent?.({type:'message',actor:a.model,text:'선생님, 쪽지 확인 부탁드려요!'});
      }else if(a.kind==='parent'&&distance<2.3){
        const lines=['우리 아이 마음도 읽으셨나요?','퇴근하셨어도 답장은 되죠?','지금 잠깐 통화 가능하시죠?'];
        a.cooldown=12;a.lock=2;onEvent?.({type:'complaint',duration:2,actor:a.model,text:lines[a.lineIndex++%lines.length]});
      }
    }
    if(principal.floor===floor)updateCone();
  }
  function reset(){
    clock=0;globalGrace=4;lastFloor=null;principalDirection=-1;actionCooldown=0;actionsEnabled=false;
    principal.floor=5;floors.get(5).inside.add(principal.model);
    for(const a of actors){a.index=1;a.pause=a.wait;a.phase=0;a.cooldown=a.kind==='vice'?8:a.kind==='parent'?5:0;a.lock=0;a.updates=0;a.defeated=false;a.respawnRemaining=0;a.respawns=0;a.lineIndex=0;a.model.visible=true;a.model.position.set(a.route[0].x,0,a.route[0].z);a.model.rotation.set(0,0,0);animateCharacter(a.model,0,0);syncQuest(a);}
    updateCone();
  }
  reset();
  return {update,reset,useAction,actors,principal,vice,getNPC:id=>byMission.get(id)?.model,getNPCAnchor:id=>{const a=byMission.get(id);return a?head(a):null;},getAnchor:model=>model.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,(model.userData.headHeight||2.35)*model.scale.y,0))};
}
