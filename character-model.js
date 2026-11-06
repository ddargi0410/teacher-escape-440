import * as THREE from './vendor/three.module.js';
import {characterAppearance,getAvatarAppearance,normalizeAvatarId} from './character-appearance.js?v=20261106-immersive1';

// Geometry and materials are shared across actors and appearance changes.
// Only the joint groups are animated; fixed details are merged by material.
const geometries=new Map(),materials=new Map();
function geo(type,...args){const key=type+JSON.stringify(args);if(!geometries.has(key))geometries.set(key,new THREE[type](...args));return geometries.get(key);}
function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82,metalness:0}));return materials.get(color);}
function part(parent,geometry,color,x=0,y=0,z=0,scale){const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function ellipsoid(parent,color,x,y,z,sx,sy,sz){
  const size=Math.max(sx,sy,sz),segments=size>.32?[12,8]:size>.15?[8,5]:[6,4];
  return part(parent,geo('SphereGeometry',1,...segments),color,x,y,z,[sx,sy,sz]);
}
function box(parent,color,x,y,z,w,h,d){return part(parent,geo('BoxGeometry',w,h,d),color,x,y,z);}
function capsule(parent,color,x,y,z,r,length,sx=1,sz=1){return part(parent,geo('CapsuleGeometry',r,length,2,6),color,x,y,z,[sx,1,sz]);}

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

function buildBody(model,appearance){
  const old=model.getObjectByName('character-body');if(old)model.remove(old);
  const body=new THREE.Group();body.name='character-body';body.scale.set(appearance.build,appearance.height,1);model.add(body);
  const arms=[],forearms=[],legs=[],shins=[],hands=[];
  const shirt=appearance.outfit==='vest'?appearance.trim:appearance.top;
  const shoe='#34413e',ink='#343c38';

  // Tapered, rounded knit silhouette with a visible shirt collar and hem.
  capsule(body,appearance.top,0,1.075,0,.265,.31,1.03,.69);
  ellipsoid(body,appearance.pants,0,.755,0,.255,.16,.175);
  if(appearance.outfit==='cardigan'||appearance.outfit==='jacket'){
    ellipsoid(body,appearance.trim,0,1.09,.174,.098,.29,.035);
    for(const x of [-.117,.117])box(body,appearance.top,x,1.08,.18,.046,.5,.025);
    for(const y of [.94,1.08,1.22])box(body,appearance.pants,.11,y,.205,.029,.029,.012);
  }else if(appearance.outfit==='vest'){
    ellipsoid(body,appearance.trim,0,1.28,.16,.14,.12,.04);
    const left=box(body,appearance.top,-.085,1.27,.195,.04,.2,.025);left.rotation.z=.47;
    const right=box(body,appearance.top,.085,1.27,.195,.04,.2,.025);right.rotation.z=-.47;
  }else{
    ellipsoid(body,appearance.trim,0,1.395,.018,.13,.035,.1);
    capsule(body,appearance.top,0,.8,0,.235,.015,1,.71);
  }
  capsule(body,appearance.skin,0,1.49,0,.095,.12,1,.93);

  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.name=side<0?'left-hip':'right-hip';leg.position.set(side*.14,.73,0);body.add(leg);
    capsule(leg,appearance.pants,0,-.16,0,.108,.16,.97,1.05);
    const shin=new THREE.Group();shin.name=side<0?'left-knee':'right-knee';shin.position.y=-.34;leg.add(shin);
    capsule(shin,appearance.pants,0,-.135,0,.094,.145,1,1.04);
    ellipsoid(shin,shoe,0,-.31,.068,.12,.085,.205);
    box(shin,shoe,0,-.357,.078,.21,.035,.33);
    legs.push(leg);shins.push(shin);

    const arm=new THREE.Group();arm.name=side<0?'left-shoulder':'right-shoulder';arm.position.set(side*.35,1.38,0);arm.rotation.z=-side*.1;body.add(arm);
    capsule(arm,shirt,0,-.16,0,.105,.16,1,.98);
    const forearm=new THREE.Group();forearm.name=side<0?'left-elbow':'right-elbow';forearm.position.y=-.32;arm.add(forearm);
    capsule(forearm,shirt,0,-.12,0,.09,.145,1,1);
    const hand=new THREE.Group();hand.position.set(0,-.3,.01);forearm.add(hand);
    ellipsoid(hand,appearance.skin,0,0,0,.085,.115,.08);
    ellipsoid(hand,appearance.skin,-side*.067,.022,.038,.034,.06,.035);
    arms.push(arm);forearms.push(forearm);hands.push(hand);
  }

  const head=new THREE.Group();head.name='character-head';head.position.y=1.81;body.add(head);
  ellipsoid(head,appearance.skin,0,0,0,.335,.375,.305);
  for(const side of [-1,1])ellipsoid(head,appearance.skin,side*.327,-.012,-.015,.055,.095,.057);
  ellipsoid(head,appearance.skin,0,-.025,.305,.045,.065,.047);
  for(const side of [-1,1]){
    ellipsoid(head,'#fff7e9',side*.115,.055,.28,.066,.052,.026);
    ellipsoid(head,ink,side*.115,.052,.306,.029,.037,.014);
    part(head,geo('CircleGeometry',.008,6),'#fff7e9',side*.108,.064,.321);
    const eyebrow=box(head,appearance.hair,side*.12,.145,.281,.103,.018,.017);eyebrow.rotation.z=-side*.08;
  }
  const smile=part(head,geo('TorusGeometry',.065,.008,4,10,Math.PI*.62),ink,0,-.105,.29);smile.rotation.z=Math.PI*1.19;

  const hair=new THREE.Group();hair.name='hair-'+appearance.haircut;head.add(hair);
  part(hair,geo('SphereGeometry',1,12,8,0,Math.PI*2,0,Math.PI*.59),appearance.hair,0,.035,-.026,[.35,.36,.32]);
  ellipsoid(hair,appearance.hair,0,.21,.22,.29,.09,.13);
  if(appearance.haircut==='bob')for(const side of [-1,1])ellipsoid(hair,appearance.hair,side*.275,-.035,-.12,.105,.26,.2);
  if(appearance.haircut==='ponytail'){
    ellipsoid(hair,appearance.hair,0,-.08,-.32,.17,.3,.13);
    ellipsoid(hair,appearance.top,0,.08,-.348,.13,.035,.055);
  }
  if(appearance.haircut==='bun')ellipsoid(hair,appearance.hair,0,.38,-.15,.155,.15,.15);
  if(appearance.haircut==='curly')for(const [x,y,z]of [[-.23,.22,.01],[0,.34,0],[.23,.22,.01],[-.12,.25,.22],[.13,.25,.22]])ellipsoid(hair,appearance.hair,x,y,z,.145,.14,.13);
  if(appearance.haircut==='sweep'){
    const fringe=ellipsoid(hair,appearance.hair,.07,.23,.215,.25,.1,.13);fringe.rotation.z=.28;
    ellipsoid(hair,appearance.hair,-.25,.13,.1,.08,.15,.11);
  }
  if(appearance.haircut==='crop')hair.scale.y=.88;
  if(appearance.glasses){
    const glasses=new THREE.Group();glasses.name='glasses-'+appearance.glasses;head.add(glasses);
    for(const side of [-1,1]){
      if(appearance.glasses==='round')part(glasses,geo('TorusGeometry',.086,.011,3,10),ink,side*.118,.051,.332);
      else{
        for(const dy of [-.066,.066])box(glasses,ink,side*.118,.051+dy,.332,.182,.017,.022);
        for(const dx of [-.083,.083])box(glasses,ink,side*.118+dx,.051,.332,.017,.132,.022);
      }
      box(glasses,ink,side*.26,.055,.23,.017,.017,.2);
    }
    box(glasses,ink,0,.054,.339,.07,.013,.022);
  }
  if(appearance.tie){const tie=box(body,appearance.tie,0,1.2,.205,.065,.3,.025);tie.rotation.z=.025;}
  else if(appearance.role!=='child'){
    box(body,appearance.trim,-.17,1.145,.19,.105,.14,.022);
    box(body,appearance.top,-.17,1.18,.204,.077,.035,.008);
  }
  if(appearance.role==='child'){
    capsule(body,'#5b7181',0,1.08,-.215,.22,.16,1,.65);
    for(const side of [-1,1])capsule(body,'#80979f',side*.17,1.16,.16,.023,.35,1,.8);
  }
  mergeFixed(body);
  const joints=[...arms,...forearms,...legs,...shins,head];
  const footwear=shins.flatMap(shin=>shin.children.filter(child=>child.isMesh&&child.material===mat(shoe)));
  Object.assign(model.userData,{appearance,body,head,arms,forearms,legs,shins,hands,
    footwear,
    headHeight:(appearance.haircut==='bun'?2.45:2.34)*appearance.height,
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
