import * as THREE from './vendor/three.module.js';
import {characterAppearance,getAvatarAppearance,normalizeAvatarId} from './character-appearance.js?v=20261106-cute1';

// Cute, round "village friend" proportions: a big soft head, a small bell-shaped
// body and short stubby limbs. Geometry and materials are shared across actors;
// only the joint groups are animated and fixed details are merged by material.
const geometries=new Map(),materials=new Map();
function geo(type,...args){const key=type+JSON.stringify(args);if(!geometries.has(key))geometries.set(key,new THREE[type](...args));return geometries.get(key);}
function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.8,metalness:0}));return materials.get(color);}
function part(parent,geometry,color,x=0,y=0,z=0,scale){const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function ellipsoid(parent,color,x,y,z,sx,sy,sz){
  const size=Math.max(sx,sy,sz),segments=size>.4?[14,10]:size>.25?[10,6]:size>.12?[8,5]:[6,4];
  return part(parent,geo('SphereGeometry',1,...segments),color,x,y,z,[sx,sy,sz]);
}
function box(parent,color,x,y,z,w,h,d){return part(parent,geo('BoxGeometry',w,h,d),color,x,y,z);}
function capsule(parent,color,x,y,z,r,length,sx=1,sz=1){return part(parent,geo('CapsuleGeometry',r,length,2,6),color,x,y,z,[sx,1,sz]);}
// A soft bell silhouette, wider at the hem than the shoulders, like a sweater
// on a round toy figure. Lathe points are plain numbers so the cache key is stable.
const BELL=[[.001,.47],[.31,.47],[.335,.55],[.325,.7],[.295,.84],[.24,.97],[.15,1.08],[.001,1.14]];
const HIPS=[[.001,.36],[.24,.37],[.31,.44],[.315,.53],[.001,.53]];
function lathe(parent,color,profile,sx=1,sz=.82){
  const key='Lathe:'+JSON.stringify(profile);
  if(!geometries.has(key))geometries.set(key,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),12));
  return part(parent,geometries.get(key),color,0,0,0,[sx,1,sz]);
}

function mergeFixed(group){
  for(const child of [...group.children])if(child.isGroup)mergeFixed(child);
  const batches=new Map();
  for(const child of group.children)if(child.isMesh){const list=batches.get(child.material)||[];list.push(child);batches.set(child.material,list);}
  for(const [material,parts] of batches){
    if(parts.length<2)continue;
    parts.forEach(p=>p.updateMatrix());
    const key='fixed:'+parts.map(p=>p.geometry.uuid+':'+p.matrix.elements.join(',')).join('|');
    let combined=geometries.get(key);
    if(!combined){
      const transformed=parts.map(p=>(p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone()).applyMatrix4(p.matrix));
      combined=new THREE.BufferGeometry();
      for(const name of ['position','normal','uv']){
        const size=transformed[0].attributes[name].itemSize;
        const values=new Float32Array(transformed.reduce((sum,g)=>sum+g.attributes[name].array.length,0));let offset=0;
        transformed.forEach(g=>{values.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;});
        combined.setAttribute(name,new THREE.BufferAttribute(values,size));
      }
      combined.computeBoundingSphere();geometries.set(key,combined);transformed.forEach(g=>g.dispose());
    }
    const merged=new THREE.Mesh(combined,material);merged.castShadow=true;merged.receiveShadow=true;group.add(merged);parts.forEach(p=>group.remove(p));
  }
}

// Head geometry (model space, before body scale): a round head that rests
// directly on the shoulders, with a low, friendly face.
const HEAD_Y=1.56,HEAD={x:.46,y:.43,z:.42};

function buildBody(model,appearance){
  const old=model.getObjectByName('character-body');if(old)model.remove(old);
  const body=new THREE.Group();body.name='character-body';body.scale.set(appearance.build,appearance.height,1);model.add(body);
  const arms=[],forearms=[],legs=[],shins=[],hands=[];
  const shirt=appearance.outfit==='vest'?appearance.trim:appearance.top;
  const shoe=appearance.role==='child'?'#e8655a':'#4a3f3a',ink='#2c2826',blush='#f3a3a0';

  // Round sweater body over little shorts/trousers.
  lathe(body,appearance.pants,HIPS,1,.84);
  lathe(body,appearance.top,BELL,1,.82);
  if(appearance.outfit==='cardigan'||appearance.outfit==='jacket'){
    // The open front shows the shirt, with two toy-like buttons.
    ellipsoid(body,appearance.trim,0,.93,.165,.075,.15,.05);
    for(const y of [.7,.86])part(body,geo('CircleGeometry',.028,6),appearance.pants,.1,y,.262);
  }else if(appearance.outfit==='vest'){
    ellipsoid(body,appearance.trim,0,1.0,.15,.11,.12,.06);
    const left=box(body,appearance.top,-.07,.98,.18,.04,.17,.03);left.rotation.z=.5;
    const right=box(body,appearance.top,.07,.98,.18,.04,.17,.03);right.rotation.z=-.5;
  }else{
    // Rounded knit collar.
    ellipsoid(body,appearance.trim,0,1.1,.0,.17,.035,.14);
  }

  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.name=side<0?'left-hip':'right-hip';leg.position.set(side*.15,.45,0);body.add(leg);
    capsule(leg,appearance.pants,0,-.09,0,.1,.06,1,1);
    const shin=new THREE.Group();shin.name=side<0?'left-knee':'right-knee';shin.position.y=-.2;leg.add(shin);
    capsule(shin,appearance.pants,0,-.07,0,.09,.04,1,1);
    // Big rounded shoes, like a toy's.
    ellipsoid(shin,shoe,0,-.175,.045,.12,.075,.165);
    legs.push(leg);shins.push(shin);

    const arm=new THREE.Group();arm.name=side<0?'left-shoulder':'right-shoulder';arm.position.set(side*.27,1.0,0);arm.rotation.z=side*.32;body.add(arm);
    capsule(arm,shirt,0,-.1,0,.085,.1,1,1);
    const forearm=new THREE.Group();forearm.name=side<0?'left-elbow':'right-elbow';forearm.position.y=-.19;arm.add(forearm);
    capsule(forearm,shirt,0,-.06,0,.08,.06,1,1);
    const hand=new THREE.Group();hand.position.set(0,-.17,.01);forearm.add(hand);
    ellipsoid(hand,appearance.skin,0,0,0,.085,.085,.08);
    arms.push(arm);forearms.push(forearm);hands.push(hand);
  }

  const head=new THREE.Group();head.name='character-head';head.position.y=HEAD_Y;body.add(head);
  ellipsoid(head,appearance.skin,0,0,0,HEAD.x,HEAD.y,HEAD.z);
  // Small rounded ears and a button nose share the skin material.
  for(const side of [-1,1])ellipsoid(head,appearance.skin,side*.45,-.04,-.02,.06,.09,.06);
  ellipsoid(head,appearance.skin,0,-.075,.41,.04,.03,.03);
  for(const side of [-1,1]){
    // Tall glossy eyes, set wide and low, with a white sparkle.
    ellipsoid(head,ink,side*.155,-.005,.385,.05,.07,.03);
    part(head,geo('CircleGeometry',.017,6),'#ffffff',side*.143,.025,.416);
    // Rosy cheeks.
    ellipsoid(head,blush,side*.265,-.1,.325,.075,.045,.022);
  }
  const smile=part(head,geo('TorusGeometry',.045,.011,3,8,Math.PI*.7),ink,0,-.135,.393);smile.rotation.z=Math.PI*1.15;smile.rotation.x=-.18;

  const hair=new THREE.Group();hair.name='hair-'+appearance.haircut;head.add(hair);
  // The cap covers the crown and back of the head; the fringe frames the face.
  part(hair,geo('SphereGeometry',1,12,7,0,Math.PI*2,0,Math.PI*.6),appearance.hair,0,.02,-.03,[.485,.46,.455]);
  if(appearance.haircut!=='sweep'){
    ellipsoid(hair,appearance.hair,0,.25,.2,.4,.15,.18);
    for(const side of [-1,1])ellipsoid(hair,appearance.hair,side*.34,.1,.16,.1,.12,.1);
  }
  for(const side of [-1,1]){
    const brow=box(hair,appearance.hair,side*.155,.105,.392,.075,.018,.02);brow.rotation.z=-side*.12;
  }
  if(appearance.haircut==='bob')for(const side of [-1,1])ellipsoid(hair,appearance.hair,side*.38,-.06,-.06,.15,.3,.3);
  if(appearance.haircut==='ponytail'){
    ellipsoid(hair,appearance.hair,0,-.02,-.5,.18,.28,.14);
    ellipsoid(hair,appearance.top,0,.18,-.47,.11,.04,.06);
  }
  if(appearance.haircut==='bun')ellipsoid(hair,appearance.hair,0,.47,-.12,.18,.17,.17);
  if(appearance.haircut==='curly')for(const [x,y,z]of [[-.3,.24,0],[0,.38,.02],[.3,.24,0],[-.16,.3,.24],[.16,.3,.24]])ellipsoid(hair,appearance.hair,x,y,z,.18,.16,.15);
  if(appearance.haircut==='sweep'){
    const fringe=ellipsoid(hair,appearance.hair,.09,.26,.21,.34,.14,.17);fringe.rotation.z=.3;
    ellipsoid(hair,appearance.hair,-.34,.14,.12,.1,.17,.13);
  }
  if(appearance.haircut==='crop')hair.scale.set(1,.94,1);
  if(appearance.glasses){
    const glasses=new THREE.Group();glasses.name='glasses-'+appearance.glasses;head.add(glasses);
    for(const side of [-1,1]){
      if(appearance.glasses==='round'){const ring=part(glasses,geo('TorusGeometry',.1,.013,3,12),ink,side*.155,0,.4);ring.rotation.x=-.05;}
      else{
        for(const dy of [-.075,.075])box(glasses,ink,side*.155,dy,.405,.2,.018,.02);
        for(const dx of [-.095,.095])box(glasses,ink,side*.155+dx,0,.405,.018,.15,.02);
      }
      box(glasses,ink,side*.36,.02,.22,.016,.016,.34);
    }
    box(glasses,ink,0,.01,.425,.075,.014,.02);
  }
  if(appearance.tie){const tie=box(body,appearance.tie,0,.82,.235,.075,.3,.03);tie.rotation.x=-.28;}
  else if(appearance.role!=='child'){
    // A tiny staff name badge on the chest.
    box(body,appearance.trim,-.15,.86,.235,.1,.12,.025);
    box(body,appearance.top,-.15,.89,.249,.07,.03,.008);
  }
  if(appearance.role==='child'){
    // Round school backpack with straps.
    ellipsoid(body,'#f2c14e',0,.82,-.29,.25,.27,.13);
    ellipsoid(body,'#e8a93a',0,.72,-.4,.15,.1,.05);
    for(const side of [-1,1])capsule(body,'#e8a93a',side*.16,.9,.17,.028,.22,1,.7);
  }
  mergeFixed(body);
  const joints=[...arms,...forearms,...legs,...shins,head];
  const footwear=shins.flatMap(shin=>shin.children.filter(child=>child.isMesh&&child.material===mat(shoe)));
  Object.assign(model.userData,{appearance,body,head,arms,forearms,legs,shins,hands,
    footwear,
    headHeight:(appearance.haircut==='bun'?2.32:2.16)*appearance.height,
    baseLimbRotations:joints.map(joint=>({joint,x:joint.rotation.x,y:joint.rotation.y,z:joint.rotation.z})),
    restJointDefaults:joints.map(joint=>({joint,rotation:joint.rotation.clone(),position:joint.position.clone()}))});
  return model;
}

export function createTeacherModel({parent,x=0,y=0,z=0,color='#e3bb82',principal=false,identity={}}={}){
  const model=new THREE.Group();model.position.set(x,y,z);parent?.add(model);
  const appearance=identity.avatarId?getAvatarAppearance(identity.avatarId):characterAppearance(identity.id,identity.role||(principal?'principal':'teacher'),color);
  model.userData.identity={...identity};return buildBody(model,appearance);
}

export function applyTeacherAppearance(model,avatarId){
  if(!model?.isObject3D)return false;
  const value=normalizeAvatarId(avatarId);
  if(model.userData.appearance?.avatarId===value)return true;
  model.userData.identity={...(model.userData.identity||{}),avatarId:value};
  buildBody(model,getAvatarAppearance(value));return true;
}
