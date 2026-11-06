import * as THREE from './vendor/three.module.js';
import {createCrowd,animateCharacter} from './crowd.js?v=20261106-cute1';
import {createSchoolDetails} from './school-details.js?v=20261106-cute1';
import {createSchoolProps} from './school-props.js?v=20261106-cute1';
const roomFrontWallSegments=cx=>[-1,1].map(side=>({x:cx+side*2.625,w:2.75}));
import {createTeacherModel,applyTeacherAppearance} from './character-model.js?v=20261106-cute1';
import {createImmersiveMaterials} from './immersive-materials.js?v=20261106-cute1';
import {createNurseRoom} from './nurse-room-world.js?v=20261106-cute1';
import {createOvertimeWorld} from './overtime-world.js?v=20261106-cute1';
import {createHallOfFameWorld} from './hall-of-fame-world.js?v=20261106-cute1';

// A small, entirely procedural school. No downloaded models or textures.
const COLORS = {
  brick: '#c97858', trim: '#f7ecd6', mint: '#4f8fd6', dark: '#2f3e5c',
  roof: '#a3adb8', glass: '#a8cbe6', floor: '#e8d9b6', skin: '#e8b18e',
  paper: '#fff8ec', coral: '#e78968', yellow: '#f2c869', green: '#a7d1a1',
};
// Korean schools often colour-code each storey for wayfinding. The facade
// band, corridor wainscot, pillars and room signs share the floor colour.
const STUDENT_CHAIRS = ['#f2a03d', '#4f8fd6', '#7cc36b', '#e86f5a'];
export const FLOOR_ACCENTS = Object.freeze({
  1: Object.freeze({paint: '#f6c445', dark: '#a8740c', name: '노랑'}),
  2: Object.freeze({paint: '#f29a5c', dark: '#b5531c', name: '주황'}),
  3: Object.freeze({paint: '#f28ca6', dark: '#b2456a', name: '분홍'}),
  4: Object.freeze({paint: '#6fb7e8', dark: '#2b6c9e', name: '하늘'}),
  5: Object.freeze({paint: '#a58fe0', dark: '#5d48a3', name: '보라'}),
});
const ROOMS = {
  5: [{id: 1, name: '6학년 교실', kind: 'classroom', color: '#e9b16c', npc: '오늘도 담임'}, {id: 2, name: '학년 연구실', kind: 'staff', color: '#f2d49b', npc: '믹스커피 동료'}],
  4: [{id: 3, name: '교무실', kind: 'office', color: '#b5c5d2', npc: '쪽지메신저 담당'}, {id: 4, name: '도서관', kind: 'library', color: '#cdb0a3', npc: '사서 선생님'}],
  3: [{id: 5, name: '컴퓨터실', kind: 'computer', color: '#b9d6f0', npc: '정보 담당 교사'}, {id: 6, name: '과학실', kind: 'lab', color: '#e6e0f5', npc: '과학 전담 교사'}],
  2: [{id: 7, name: '행정실', kind: 'admin', color: '#d5b7a4', npc: '행정실 주무관'}, {id: 8, name: '방송실', kind: 'broadcast', color: '#b3adcc', npc: '방송 담당 교사'}],
  1: [{id: 9, name: '급식실', kind: 'cafeteria', color: '#d6cc99', npc: '영양 선생님'}, {id: 0, name: '중앙현관', kind: 'lobby', color: '#f0dcc0', npc: ''}],
};

export function createWorld(scene) {
  const world = new THREE.Group(); world.name = '퇴근초등학교'; scene.add(world);
  const exterior = new THREE.Group(); world.add(exterior);
  const floors = new Map(), animated = [], questObjects = new Map();
  const beds = new Map();
  const specialRooms = [
    {id:'learning-room',kind:'learning',label:'배움터 · 바이브 코딩 첫걸음',floor:1,entry:{x:-20,y:0,z:1.2}},
    {id:'nurse-room',kind:'nurse',label:'보건실 · 아무것도 안 해도 되는 방',floor:1,entry:{x:20,y:0,z:5.5}}
  ];
  const materials = new Map(), geometries = new Map();
  const immersiveMaterials=createImmersiveMaterials();
  let nurseRoom=null;
  let currentFloor = null, completed = new Set(), gateOpen = false, gateAngle = 0,cameraMode='shoulder',quality='medium';
  const viewPosition={x:Infinity,y:Infinity,z:Infinity};
  const daylightState={golden:0,night:0};

  function mat(color, options = {}) {
    const key = color + JSON.stringify(options);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({color, roughness: .88, metalness: 0, ...options}));
    return materials.get(key);
  }
  function geo(type, ...args) {
    const key = type + args.join('/');
    if (!geometries.has(key)) geometries.set(key, new THREE[type](...args));
    return geometries.get(key);
  }
  function mesh(parent, geometry, material, x, y, z, shadow = true) {
    const object = new THREE.Mesh(geometry, material); object.position.set(x,y,z);
    object.castShadow = shadow; object.receiveShadow = true; parent.add(object); return object;
  }
  function box(parent,x,y,z,w,h,d,color,options) { return mesh(parent,geo('BoxGeometry',w,h,d),mat(color,options),x,y,z); }
  function cyl(parent,x,y,z,r1,r2,h,color,n=10) { return mesh(parent,geo('CylinderGeometry',r1,r2,h,n),mat(color),x,y,z); }
  function ball(parent,x,y,z,r,color,scale=[1,1,1]) { const o=mesh(parent,geo('IcosahedronGeometry',r,1),mat(color),x,y,z);o.scale.set(...scale);return o; }
  function collide(list,x,z,w,d,blocksSight=true) { list.push({x,z,w,d,blocksSight}); }
  function textTexture(text, {color='#fff8ec',background='#2f3e5c',width=768,height=160,fontSize=66,border=false}={}) {
    const c=document.createElement('canvas'); c.width=width;c.height=height;
    const ctx=c.getContext('2d');
    if(background){ctx.fillStyle=background;ctx.fillRect(0,0,width,height);}
    if(border){ctx.strokeStyle=color;ctx.lineWidth=5;ctx.strokeRect(12,12,width-24,height-24);}
    ctx.font=`800 ${fontSize}px "Noto Sans KR", "Malgun Gothic", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,width/2,height/2+4,width-36);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  function sign(parent,text,x,y,z,w=3,h=.65,color='#fff8ec',background='#2f3e5c') {
    const o=mesh(parent,geo('PlaneGeometry',w,h),new THREE.MeshBasicMaterial({map:textTexture(text,{color,background}),side:THREE.FrontSide}),x,y,z,false);return o;
  }
  function badge(parent,text,x,y,z,color='#f2c869',scale=.95) {
    const c=document.createElement('canvas');c.width=c.height=192;const q=c.getContext('2d');
    q.fillStyle='#2f3e5c';q.beginPath();q.arc(96,96,90,0,Math.PI*2);q.fill();q.strokeStyle=color;q.lineWidth=9;q.stroke();q.fillStyle=color;q.font='800 94px sans-serif';q.textAlign='center';q.textBaseline='middle';q.fillText(text,96,102);
    const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,depthTest:true,depthWrite:false}));s.position.set(x,y,z);s.scale.set(scale,scale,1);parent.add(s);return s;
  }
  function plant(parent,x,y,z,size=1) {
    cyl(parent,x,y+.25*size,z,.28*size,.22*size,.5*size,'#bb7b58');
    cyl(parent,x,y+.65*size,z,.035*size,.045*size,.8*size,'#536c46',6);
    ball(parent,x,y+.95*size,z,.45*size,'#81a976',[1,.85,1]);
    ball(parent,x+.22*size,y+1.15*size,z-.1*size,.3*size,'#aac18c',[.7,1,.7]);
  }
  function chair(parent,x,y,z,color='#f2a03d',rot=0) {
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);
    box(g,0,.48,0,.65,.12,.65,color);box(g,0,.96,.29,.65,.85,.12,color);
    for(const dx of [-.25,.25])for(const dz of [-.25,.25])box(g,dx,.23,dz,.06,.46,.06,'#67706a');
    return g;
  }
  function desk(parent,x,y,z,w=1.6,d=.9,color='#c89969',list) {
    box(parent,x,y+.95,z,w,.14,d,color);
    for(const dx of [-w/2+.12,w/2-.12])for(const dz of [-d/2+.12,d/2-.12])box(parent,x+dx,y+.45,z+dz,.09,.9,.09,'#7d8794');
    if(list)collide(list,x,z,w,d,false);
  }
  function monitor(parent,x,y,z) {
    box(parent,x,y+.22,z,.08,.4,.08,'#2f3e5c');box(parent,x,y,z,.45,.04,.28,'#2f3e5c');
    box(parent,x,y+.5,z,.88,.58,.09,'#2f3e5c');box(parent,x,y+.5,z+.05,.75,.46,.012,'#9fd0f5',{emissive:'#3d6f9e',emissiveIntensity:.15});
    for(let i=0;i<3;i++)box(parent,x-.18,y+.62-i*.11,z+.058,.25+i*.06,.025,.012,i===0?'#f4d08b':'#e8f4ff');
    box(parent,x,y+.06,z+.38,.6,.035,.25,'#5d6470');
  }
  function paperStack(parent,x,y,z,count=4) {for(let i=0;i<count;i++)box(parent,x+(i%2)*.025,y+i*.05,z,.55,.045,.4,i===count-1?'#ffd98a':COLORS.paper);}
  function bookshelf(parent,x,y,z,w=2.4,color='#a8794f') {
    box(parent,x,y+1.15,z,w,2.3,.55,color);
    const bookColors=['#5aa9e6','#f2c14e','#e86f5a','#a58fe0','#7cc36b'];
    for(let row=0;row<3;row++){
      box(parent,x,y+.16+row*.7,z+.3,w,.08,.6,'#c9a06e');
      for(let i=0;i<8;i++){const h=.38+(i%3)*.09;box(parent,x-w/2+.2+i*(w-.3)/8,y+.2+row*.7+h/2,z+.33,.16,h,.25,bookColors[(i+row)%5]);}
    }
  }
  function teacher(parent,x,y,z,color='#e3bb82',principal=false,identity={}) {
    return createTeacherModel({parent,x,y,z,color,principal,identity,helpers:{mat,geo,mesh,box,cyl,ball}});
  }
  function quest(parent,id,x,y,z,color,label,npcColor) {
    const npc=teacher(parent,x,y,z,npcColor,id===10,{id:'mission-npc-'+id,role:id===10?'principal':'teacher'});
    const ring=mesh(parent,geo('TorusGeometry',.78,.055,5,28),mat(color,{emissive:color,emissiveIntensity:.16}),x,y+.035,z,false);ring.rotation.x=Math.PI/2;
    const crystal=mesh(parent,geo('OctahedronGeometry',.22),mat(color,{emissive:color,emissiveIntensity:.3}),x,y+2.65,z,false);
    const number=badge(parent,String(id).padStart(2,'0'),x,y+3.23,z,color,.75);
    const item={npc,ring,crystal,number,base:y,done:false};animated.push(item);questObjects.set(id,item);
    return {id:'mission-'+id,missionId:id,x,y,z,label};
  }
  const schoolDetails=createSchoolDetails({box,cyl,mesh,geo,mat,collide,surfaceMaterial:immersiveMaterials.material});
  const schoolProps=createSchoolProps({box,cyl,mesh,geo,mat});

  // Landscaped courtyard and school surroundings.
  box(exterior,0,-.8,3,58,1.25,54,'#8ca386');
  box(exterior,0,-.18,3,44,.3,44,'#dcc8a0');
  box(exterior,0,-.01,10,31,.16,32,'#efe3cc');
  box(exterior,0,.09,11,3.4,.07,15,'#f3ead8');
  for(let i=0;i<7;i++)box(exterior,0,.14,9+i*1.7,3.3,.035,.07,'#d8cdb8');
  box(exterior,0,.03,23,37,.18,7,'#7b7f86');
  for(let x=-14;x<=14;x+=4)box(exterior,x,.14,23,.08,.035,5.4,'#f4f1ea');
  box(exterior,0,.14,26.5,39,.07,.2,'#f4f1ea');
  // Planters, trunks and layered rounded low-poly canopies.
  function tree(x,z,s=1){
    box(exterior,x,.25,z,2.4*s,.6,2.4*s,'#c9a77f');box(exterior,x,.56,z,2.15*s,.06,2.15*s,'#7d9470');
    cyl(exterior,x,1.9*s,z,.18*s,.27*s,3.8*s,'#92704f',8);
    ball(exterior,x,4.3*s,z,1.7*s,'#7a9b72',[1,1.1,1]);
    ball(exterior,x-.8*s,3.7*s,z+.2*s,1.2*s,'#91ad7b');
    ball(exterior,x+.6*s,4.8*s,z-.2*s,1.3*s,'#a9bd83');
  }
  // The first-floor quiet wings occupy the old side planters. Their trees now
  // shade the outside of the annexes instead of growing through the rooms.
  [[-28,-6,1.1],[-28,3,1],[-18,14,.95],[28,-6,1.15],[28,4,1],[17,15,.85],[-7,-13,.8],[7,-13,.9]].forEach(v=>tree(...v));
  function bench(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;exterior.add(g);for(let j=0;j<3;j++)box(g,0,.65,-.36+j*.25,2.6,.13,.18,'#ab7955');for(let j=0;j<2;j++)box(g,0,1.1+j*.23,-.5,2.6,.16,.1,'#ab7955');for(const dx of [-.9,.9])box(g,dx,.3,0,.12,.6,.9,'#3f6fb0');}
  bench(-10,12);bench(10,12,Math.PI);plant(exterior,-13,0,11,1.5);plant(exterior,13,0,11,1.5);
  const hallOfFame=createHallOfFameWorld({parent:exterior,box,cyl,mesh,geo,mat,teacher,sign});
  // Layered hills and a distant treeline give upstairs windows a horizon.
  // Shared low-poly geometry and the exterior material batch keep this cheap.
  function distantHill(x,y,z,sx,sy,sz,color){const shape=mesh(exterior,geo('IcosahedronGeometry',1,1),mat(color),x,y,z,false);shape.scale.set(sx,sy,sz);}
  for(const hill of [
    [-41,1,76,34,16,16,'#aac3d6'],[-5,2,84,39,21,17,'#aac3d6'],[36,0,79,35,18,18,'#aac3d6'],
    [-37,-1,59,25,11,12,'#829e8a'],[-3,-1,64,30,14,13,'#829e8a'],[32,-1,61,27,12,13,'#829e8a']
  ])distantHill(...hill);
  for(let n=0;n<18;n++){
    const x=-42+n*4.9,z=43+(n%3)*2.7,h=3.5+(n%4)*.5;
    const trunk=mesh(exterior,geo('CylinderGeometry',.12,.18,h,6),mat('#82775e'),x,h/2-.35,z,false);
    const canopy=mesh(exterior,geo('IcosahedronGeometry',1,0),mat(n%3?'#668b70':'#78977b'),x,h+.7,z,false);canopy.scale.set(2.4,2.2,2.1);
  }
  // Evening: a moon, a sprinkle of stars and four yard lamps that glow at dusk.
  const nightSky=new THREE.Group();nightSky.name='night-sky';nightSky.visible=false;exterior.add(nightSky);
  const moon=new THREE.Mesh(geo('SphereGeometry',3.2,16,10),new THREE.MeshBasicMaterial({color:'#fff6d8',fog:false,transparent:true,opacity:0}));
  moon.position.set(-34,44,92);moon.name='moon';nightSky.add(moon);
  {
    let seed=4401;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const stars=[];for(let n=0;n<160;n++){const a=random()*Math.PI*2,h=.22+random()*.7,r=150;stars.push(Math.cos(a)*Math.cos(h)*r,Math.sin(h)*r,Math.sin(a)*Math.cos(h)*r);}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
    const starField=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#ffffff',size:2,sizeAttenuation:false,fog:false,transparent:true,opacity:0,depthWrite:false}));
    starField.name='stars';nightSky.add(starField);
  }
  const yardLamps=[];
  for(const [x,z] of [[-2.7,13.8],[2.7,13.8],[-12,19.2],[12,19.2]]){
    const lamp=new THREE.Group();lamp.name='yard-lamp';lamp.position.set(x,0,z);exterior.add(lamp);
    cyl(lamp,0,1.7,0,.06,.08,3.4,'#3f4a5c',6);
    cyl(lamp,0,3.48,0,.26,.18,.18,'#3f4a5c',8);
    const bulb=mesh(lamp,geo('SphereGeometry',.17,10,6),new THREE.MeshBasicMaterial({color:'#e9e4d6'}),0,3.33,0,false);bulb.name='yard-lamp-bulb';
    const pool=mesh(lamp,geo('CircleGeometry',2.4,18),new THREE.MeshBasicMaterial({color:'#ffd98a',transparent:true,opacity:0,depthWrite:false}),0,.2,0,false);
    pool.rotation.x=-Math.PI/2;pool.name='yard-lamp-glow';pool.visible=false;
    yardLamps.push({lamp,bulb,pool});
  }
  // One original school plaque and flagpole; no external graphics.
  cyl(exterior,-16,4.2,-5,.055,.055,8.4,'#e9e6df',8);
  const flag=box(exterior,-15.2,7.6,-5,1.6,.85,.035,'#ffffff');
  sign(exterior,'배움 · 쉼',-15.2,7.6,-4.975,1.45,.6,'#3a6fb0','#ffffff');
  box(exterior,-13.2,1.4,16,1.4,2.8,1.4,'#c96f50');box(exterior,13.2,1.4,16,1.4,2.8,1.4,'#c96f50');
  sign(exterior,'퇴근초등학교',-13.2,1.6,16.72,1.25,.65,'#2f3e5c','#fff4dc');
  for(const side of [-1,1])for(let i=0;i<10;i++){const x=side*(2.2+i);box(exterior,x,1,16,.055,1.65,.055,'#3f6fb0');}
  for(const side of [-1,1])box(exterior,side*7,1.5,16,9.7,.075,.08,'#3f6fb0');
  const gateLeft=new THREE.Group(),gateRight=new THREE.Group();gateLeft.position.set(-1.8,0,16);gateRight.position.set(1.8,0,16);exterior.add(gateLeft,gateRight);
  for(const [g,sgn] of [[gateLeft,1],[gateRight,-1]]){for(let i=0;i<6;i++)box(g,sgn*(.15+i*.3),1,0,.06,1.8,.07,'#2f5d9a');box(g,sgn*.9,1.65,0,1.8,.12,.09,'#2f5d9a');box(g,sgn*.9,.45,0,1.8,.12,.09,'#2f5d9a');}
  const farewellSign=sign(exterior,'오늘도 수고했어요',0,2.75,16,5.5,.7,'#fff8ec','#e0703f');
  const farewellReverse=farewellSign.clone();farewellReverse.position.z-=.02;farewellReverse.rotation.y=Math.PI;exterior.add(farewellReverse);
  // Car used by the ending animation. Its local forward direction is +Z.
  const car=new THREE.Group();car.position.set(7,0,22.2);exterior.add(car);
  box(car,0,.62,0,1.9,.65,3.7,'#e7b477');box(car,0,1.15,-.15,1.65,.65,1.95,'#d8a773');
  box(car,0,1.18,.84,1.46,.48,.025,'#9cc3dd');box(car,0,1.18,-1.13,1.46,.48,.025,'#9cc3dd');
  for(const side of [-1,1]){box(car,side*.84,1.18,-.15,.035,.47,1.65,'#a8cbe6');for(const zz of [-1.12,1.15]){const wh=cyl(car,side*.96,.4,zz,.36,.36,.2,'#33363b',12);wh.rotation.z=Math.PI/2;}}
  box(car,0,.65,1.87,1.15,.2,.03,'#ece7c3');box(car,0,.65,-1.87,1.1,.13,.03,'#c56c59');sign(car,'퇴 근',0,.43,1.9,.65,.2,'#2f3e5c','#f1e8cf');

  // The five floors have independent interior geometry and collision data.
  for(let floor=1;floor<=5;floor++){
    const base=(floor-1)*4, root=new THREE.Group();root.position.y=base;world.add(root);
    const shell=new THREE.Group(),inside=new THREE.Group(),front=new THREE.Group(),cap=new THREE.Group(),cutaway=new THREE.Group();root.add(shell,inside,front,cap,cutaway);
    const colliders=[],interactables=[],accent=FLOOR_ACCENTS[floor];
    floors.set(floor,{root,shell,inside,front,cap,cutaway,colliders,interactables,accent});
    box(shell,0,-.16,-1.05,28.5,.3,14.1,COLORS.trim);
    // Human-scale room geometry: 8 × 9 m teaching rooms, a 3 m clear
    // corridor (z 2.68..5.68), and a ceiling underside exactly 3 m high.
    for(const x of [-13.85,13.85])for(const z of [-7.85,5.8])box(shell,x,1.5,z,.38,3,.38,COLORS.brick);
    const ceiling=box(cap,0,3.09,-1.05,28.55,.18,14.1,'#ecece2');
    ceiling.material=immersiveMaterials.material('ceiling');ceiling.name='interior-ceiling';
    const rear=box(shell,0,1.5,-7.95,28,3,.24,'#eeeae0');rear.material=immersiveMaterials.material('plaster');
    box(shell,0,.5,-7.78,27.6,1,.04,accent.paint);
    for(const side of [-1,1]){
      const spans=floor===1?[{z:-2.5,d:11}]:[{z:-1.075,d:13.75}];
      for(const span of spans){
        const wall=box(cap,side*13.96,1.5,span.z,.23,3,span.d,'#eeeae0');wall.material=immersiveMaterials.material('plaster');
        box(inside,side*13.81,.5,span.z,.06,1,span.d,accent.paint);
      }
      if(floor===1)box(cap,side*13.96,2.8,4.4,.23,.4,2.8,'#eeeae0');
    }
    // Close the service void above the 3m ceiling without moving saved floor elevations.
    for(const z of [-7.95,5.8]){const fascia=box(z>0?front:shell,0,3.5,z,28,1,.24,'#eeeae0');fascia.material=immersiveMaterials.material('plaster');}
    for(const side of [-1,1]){const fascia=box(cap,side*13.96,3.5,-1.075,.23,1,13.75,'#eeeae0');fascia.material=immersiveMaterials.material('plaster');}
    const facadeWindows=[-11.6,-8.25,-4.9,4.9,8.25,11.6];
    for(const side of [-1,1]){
      const low=box(front,side*8,.52,5.8,12,1.04,.24,accent.paint);low.material=immersiveMaterials.material('paint',accent.paint);
      const high=box(front,side*8,2.83,5.8,12,.34,.24,'#eeeae0');high.material=immersiveMaterials.material('plaster');
      for(const x of [side*2.7,side*6.57,side*9.925,side*13.7]){
        const pillar=box(front,x,1.85,5.8,.51,1.62,.24,'#eeeae0');pillar.material=immersiveMaterials.material('plaster');
      }
    }
    for(const x of facadeWindows){
      box(front,x,1.04,5.63,2.93,.11,.36,'#e6e8ea');
      box(front,x,2.66,5.8,2.9,.085,.17,'#f2f3f4');
      for(const dx of [-1.4,0,1.4])box(front,x+dx,1.85,5.78,.065,1.62,.16,'#f2f3f4');
      box(front,x,1.58,5.78,2.84,.045,.13,'#f2f3f4');box(front,x+.07,1.79,5.67,.045,.25,.07,'#7a8983');
      const view=mesh(front,geo('PlaneGeometry',2.8,1.62),immersiveMaterials.windowMaterial(),x,1.85,5.94,false);view.rotation.y=Math.PI;view.name='ordinary-window-view';
    }
    if(floor===1){
      box(front,0,2.8,5.8,4,.4,.24,'#f4f1ea');
      for(const side of [-1,1])box(front,side*1.96,1.3,5.8,.1,2.6,.3,'#c9cdd3');
    }else{
      const centreLow=box(front,0,.52,5.8,4,1.04,.24,accent.paint);centreLow.material=immersiveMaterials.material('paint',accent.paint);box(front,0,2.83,5.8,4,.34,.24,'#eeeae0');
      for(const x of [-1.95,0,1.95])box(front,x,1.85,5.8,.07,1.62,.16,'#f2f3f4');
      const view=mesh(front,geo('PlaneGeometry',3.9,1.62),immersiveMaterials.windowMaterial(),0,1.85,5.94,false);view.rotation.y=Math.PI;
    }
    sign(front,String(floor)+'F',-13,2.08,5.98,.75,.44,'#ffffff',accent.dark);
    box(inside,0,.06,4.18,27.4,.09,3,'#d8d6d0');
    // The room divider stops behind the stair landing, never through the steps.
    box(cutaway,0,1.5,-5.15,.25,3,5.3,COLORS.trim);
    collide(colliders,0,-5.15,.3,5.3);collide(colliders,0,-8,28,.3);
    for(const side of [-1,1]){
      if(floor===1){collide(colliders,side*13.9,-2.5,.25,11);}
      else collide(colliders,side*13.9,-1.075,.25,13.75);
    }
    if(floor>1)collide(colliders,0,5.8,28,.24);
    else {collide(colliders,-8,5.8,12,.24);collide(colliders,8,5.8,12,.24);}
    // Real hiding places: geometry and sight/movement collisions stay aligned.
    for(const x of [-4,4]){box(cutaway,x,1.5,5.34,.5,3,.5,accent.paint);collide(colliders,x,5.34,.5,.5);}
    bookshelf(inside,-12.3,0,3.0,1.35);collide(colliders,-12.3,3.0,1.35,.6);
    // Open central staircase with a full-width entry and a clear rear landing.
    // Use E at the landing to choose the adjacent floor.
    box(inside,0,.15,3.45,4,.12,1.3,'#d5d2cb');
    for(let step=0;step<10;step++){
      const h=.15+step*.22,z=2.4-step*.38;
      box(inside,0,h/2,z,3.35,h,.4,'#dedbd4');
      box(inside,0,h+.015,z+.17,3.35,.025,.045,'#f2c14e');
    }
    box(inside,0,2.13/2,-1.79,3.35,2.13,1.14,'#dedbd4');
    for(const direction of [-1,1]){
      for(let n=0;n<6;n++){
        const z=2.55-n*.7,y=.65+n*.4;
        box(inside,direction*1.68,y,z,.055,1.1,.055,'#7d8794');
      }
      const rail=box(inside,direction*1.68,2, .5,.07,.07,4.35,'#f2a03d');rail.rotation.x=.52;
    }
    badge(inside,'↗',0,2.58,4.3,'#f5dd93',.55);
    const stairLabel=sign(inside,'E · 층 이동',0,.225,3.65,2.5,.55,'#2f3e5c','#fff4dc');stairLabel.rotation.x=-Math.PI/2;
    interactables.push({id:'central-stairs',kind:'stairs',x:0,y:base,z:4.7,label:'중앙계단 · 한 층씩 이동',floor});
    for(const [side,room] of ROOMS[floor].entries()){
      const cx=side===0?-7:7;
      const roomFloor=box(inside,cx,.04,-2,8,.12,9,room.color);roomFloor.material=immersiveMaterials.material(['classroom','staff','library'].includes(room.kind)?'wood':'terrazzo');
      for(const side of [-1,1]){const wall=box(cutaway,cx+side*4.09,1.5,-2,.18,3,9.18,'#eeeae0');wall.material=immersiveMaterials.material('plaster');collide(colliders,cx+side*4.09,-2,.18,9.18);}
      const rearWall=box(cutaway,cx,1.5,-6.59,8.36,3,.18,'#eeeae0');collide(colliders,cx,-6.59,8.36,.18);rearWall.material=immersiveMaterials.material('plaster');
      // Wide room door at x=±7. Transoms and side walls outline it.
      for(const wall of roomFrontWallSegments(cx)){
        const roomWall=box(cutaway,wall.x,1.5,2.59,wall.w,3,.18,'#eeeae0');roomWall.material=immersiveMaterials.material('plaster');
        collide(colliders,wall.x,2.59,wall.w,.18);
      }
      box(cutaway,cx,2.7,2.59,2.5,.6,.2,'#eeeae0');
      sign(cutaway,room.name,cx,2.55,2.71,2.3,.32,'#ffffff',accent.dark);
      plant(inside,cx+(side===0?-3.35:3.35),.15,1.1,.85);
      if(room.kind!=='classroom')sign(cutaway,room.kind==='lobby'?'퇴근은 권리입니다':'배움은 즐겁게 · 퇴근은 빠르게',cx,2.3,-6.47,5.8,.55,'#3a5a8c','#fff1d0');
      if(room.id){const item=quest(inside,room.id,cx,0,room.kind==='staff'?-2.2:-3,'#f5d27d',room.npc,side===0?'#d79d75':'#5aa9e6');item.y=base;item.floor=floor;interactables.push(item);}
      const left=cx-2.5,right=cx+2.5;
      if(['classroom','computer'].includes(room.kind)){
        box(cutaway,cx,1.56,-6.38,6.6,1.55,.12,room.kind==='computer'?'#c7ccd4':'#2f5a48');
        if(room.kind==='computer')sign(cutaway,'작동은 하는데… 왜 되는 거지?',cx,1.6,-6.3,6.3,1.2,'#2f5d9a','#f7f9fb');
        for(const x of [left,right])for(const z of [-4.6,-.8]){
          desk(inside,x,0,z,2.1,1.05,'#d1a774',colliders);chair(inside,x,0,z+1.1,room.kind==='computer'?'#4f8fd6':STUDENT_CHAIRS[(x>cx?1:0)+(z>-2?2:0)]);
          if(room.kind==='computer')monitor(inside,x,1.06,z-.15);else {box(inside,x,1.05,z,.7,.05,.5,'#f4f1ea');box(inside,x+.25,1.1,z+.2,.4,.025,.035,'#e0703f');}
        }
        if(room.kind==='classroom'){
          // The two running children now live in the active floor's corridor.
        }
      }else if(['staff','office','admin'].includes(room.kind)){
        for(const x of room.kind==='staff'?[]:[left,right]){
          desk(inside,x,0,-3.3,2.4,1.4,'#bd956b',colliders);monitor(inside,x,1.06,-3.45);chair(inside,x,0,-4.5,'#4f74d6',Math.PI);paperStack(inside,x+.8,1.05,-3.2,room.kind==='admin'?8:4);
        }
        for(const x of room.kind==='office'?[cx-2.65]:[cx-2.65,cx+2.65]){box(inside,x,1,-5.95,2.3,2,.65,'#d9dde3');for(let j=0;j<4;j++){box(inside,x,.3+j*.45,-5.6,2.1,.36,.06,'#eef0f3');box(inside,x,.3+j*.45,-5.55,.25,.04,.05,'#8a929c');}collide(colliders,x,-5.95,2.3,.7);}
        if(room.kind==='office')sign(inside,'읽지 않은 쪽지 99+',cx,1.3,-6.35,3.1,.7,'#fff0d5','#b56d54');
      }else if(room.kind==='library'){
        for(const x of [left,right])for(const z of [-5.8,-1]){bookshelf(inside,x,0,z,1.7);collide(colliders,x,z,1.7,.8);}
        desk(inside,cx,0,-5.8,2.7,1,'#b99770',colliders);box(inside,cx,1.06,-5.8,.9,.06,.65,'#c6ad84');
      }else if(room.kind==='lab'){
        for(const x of [left,right]){
          desk(inside,x,0,-3.5,2.8,1.5,'#e3e8ee',colliders);
          box(inside,x-.6,1.3,-3.5,.75,.48,.55,'#9fd0f5',{transparent:true,opacity:.65});
          ball(inside,x-.65,1.25,-3.5,.12,'#e6c77d');
          cyl(inside,x+.65,1.27,-3.5,.12,.22,.4,'#bfe3f7');cyl(inside,x+.65,1.55,-3.5,.09,.09,.22,'#e2f2fb');
          plant(inside,x+.35,1.04,-4,.4);
        }
        box(inside,cx,1.2,-5.95,3,2.4,.6,'#6fb7e8');sign(inside,'관찰 → 질문 → 확인',cx,1.7,-5.61,2.6,.8,'#2f3e5c','#fff3c4');collide(colliders,cx,-5.95,3,.7);
      }else if(room.kind==='broadcast'){
        desk(inside,left,0,-3.5,2.6,1.4,'#4a4e69',colliders);monitor(inside,left,1.06,-3.8);
        for(let i=0;i<7;i++){box(inside,left-.9+i*.3,1.07,-3.1,.07,.03,.5,'#c8b9a2');box(inside,left-.9+i*.3,1.12,-3.1+(i%3)*.1,.14,.04,.12,'#e8c17c');}
        box(inside,right,1.15,-5,1.2,2.3,1,'#2b2f36');for(const yy of [.65,1.65]){const cone=cyl(inside,right,yy,-4.47,.37,.37,.06,'#8a929c',16);cone.rotation.x=Math.PI/2;}collide(colliders,right,-5,1.2,1);
        cyl(inside,right,1.1,-1.2,.045,.045,2.2,'#3a3f4a');box(inside,right,2.2,-1.2,.28,.4,.28,'#c7ccd4');
        sign(inside,'ON AIR',cx,2.6,-6.46,2.7,.55,'#ffe2b0','#b36e58');
      }else if(room.kind==='cafeteria'){
        for(const x of [left,right]){
          desk(inside,x,0,-2.4,2.8,1.8,'#f4efe6',colliders);
          for(const zz of [-3.7,-1.1]){box(inside,x,.55,zz,2.8,.14,.5,'#f2a03d');for(const dx of [-1,1])box(inside,x+dx,.28,zz,.12,.55,.4,'#8a929c');}
          box(inside,x,1.06,-2.4,.8,.06,.6,'#cfd6de');cyl(inside,x-.17,1.13,-2.4,.19,.19,.07,'#e3dbc0');
        }
        box(inside,cx,.9,-5.95,7.4,1.8,1.2,'#cfd6de');sign(inside,'오늘의 메뉴 : 퇴근이 고프다',cx,2.2,-5.33,5.5,.65,'#c2502f','#f1dca7');collide(colliders,cx,-5.95,7.4,1.2);
      }else{
        box(inside,cx,1.1,-6.25,6,2.2,.35,'#3a6fb0');sign(inside,'선생님의 하루를 응원합니다',cx,1.65,-6.05,5.5,.55,'#f1e7c6','#3a6fb0');
        sign(inside,'정시 퇴근 추진 위원회',cx,1,-6.04,5,.45,'#fff1d0','#3a6fb0');
        bench(18,10);plant(inside,left,0,-2,1.2);plant(inside,right,0,-2,1.2);
      }
      schoolProps.decorateRoom({parent:inside,room,cx,centerZ:-2,width:8,depth:9,colliders,collide});
    }
    for(const side of [-1,1]){const wall=box(cutaway,side*12.4,1.5,2.59,2.8,3,.18,'#eeeae0');wall.material=immersiveMaterials.material('plaster');box(inside,side*12.4,.5,2.705,2.8,1,.035,accent.paint);collide(colliders,side*12.4,2.59,2.8,.18);}
    schoolDetails.decorateFloor({inside,front,cutaway,floor,rooms:ROOMS[floor],colliders,accent});
    schoolProps.decorateCorridor({parent:inside,floor,x:-12.2,z:2.9,ceiling:3});
    if(floor===1){
      const boss=quest(inside,10,7,0,7,'#e99a76','교장선생님','#3b5a8c');boss.floor=1;interactables.push(boss);
      for(const side of [-1,1]){
        const cx=side*20, learning=side<0, color=learning?'#f3dfb8':'#d6e9f5';
        const roomName=learning?'배움터':'보건실';
        if(!learning){
          nurseRoom=createNurseRoom({inside,colliders,beds,interactables,cx,helpers:{box,cyl,ball,mesh,geo,mat,sign,badge,collide}});
          root.add(nurseRoom.root);
          box(shell,cx,-.16,0,12.4,.3,16.5,COLORS.trim);
          collide(colliders,side*19.9,17.1,12.4,18.2);
          sign(inside,'보건실 →',13.15,2.15,4.78,2.3,.48,'#2f3e5c','#f3e7c6');
          continue;
        }
        box(shell,cx,-.16,0,12.4,.3,16.5,COLORS.trim);
        box(cap,cx,3.09,0,12.4,.18,16.55,COLORS.trim);
        box(cap,side*26.05,1.5,0,.22,3,16,'#f6d27a');
        box(front,cx,1.5,7.95,12.25,3,.22,'#f6d27a');
        for(const x of [cx-3,cx+3]){
          box(front,x,1.9,8.08,2.8,1.6,.08,'#ffffff');
          box(front,x,1.9,8.14,2.6,1.4,.04,'#bfe0f5');
          box(front,x,1.9,8.18,.06,1.5,.025,COLORS.trim);
        }
        sign(front,roomName,cx,2.9,8.12,3.3,.55);
        box(inside,cx,.04,0,11.8,.12,15.5,color);
        if(learning)box(inside,cx,1.4,-7.7,12,2.8,.2,'#fff4dc');
        else {box(inside,cx,.35,-7.7,12,.7,.2,'#f6f1e7');box(inside,cx,3.28,-7.7,12,.2,.2,'#f8f2e3');}
        box(inside,side*25.8,learning?.5:.22,0,.25,learning?1:.44,16,learning?'#7cc36b':'#e6dccb');
        box(inside,cx,learning?.45:.22,7.8,12,learning?.9:.44,.22,learning?'#7cc36b':'#e6dccb');
        box(inside,cx,.12,4.7,11.5,.025,2.3,'#fff1d6');
        for(const z of [-3.9,-1.9,.1])box(inside,side*15.2,.12,z,.12,.02,.65,'#fff8e8');
        collide(colliders,side*26,0,.25,16);
        collide(colliders,cx,-8,12.2,.3);
        collide(colliders,cx,8,12.2,.3);
        // Keep expanded movement bounds from creating an escape around the gate.
        collide(colliders,side*19.9,17.1,12.4,18.2);
        sign(inside,roomName,cx,2.7,-7.56,4.4,.7,'#2f3e5c','#fff4dc');
        if(learning)sign(inside,'처음이어도 괜찮아요',cx,1.9,-7.55,6.5,.5,'#c2502f','#fff4dc');
        plant(inside,cx-4.6,0,-6.5,1.1);plant(inside,cx+4.6,0,-6.5,1.1);
        sign(inside,learning?'← 배움터':'보건실 →',side*13.15,2.15,4.78,2.3,.48,'#2f3e5c','#f3e7c6');
        if(learning){
          box(inside,cx,1.35,-6.9,5.3,2.1,.18,'#3a6fb0');
          sign(inside,'말로 부탁 → 실행 → 확인',cx,1.55,-6.78,4.9,1,'#fff3d5','#3a6fb0');
          desk(inside,cx,0,-3.7,3.5,1.3,'#be9b6d',colliders);
          monitor(inside,cx-.8,1.06,-3.9);paperStack(inside,cx+.9,1.05,-3.7,3);
          chair(inside,cx-.8,0,-2.6,'#f28ca6');
          for(const dx of [-3.5,3.5]){
            box(inside,cx+dx,.55,-1.4,1.9,.65,1.5,'#5aa9e6');
            box(inside,cx+dx,1.15,-2.03,1.9,.65,.23,'#5aa9e6');
            collide(colliders,cx+dx,-1.4,1.9,1.5,false);
          }
          const item={id:'learning-room',kind:'learning',x:cx,y:0,z:.2,label:'배움터 · 바이브 코딩 첫걸음',floor:1};
          interactables.push(item);
          badge(inside,'?',cx,1.3,.2,'#dfd29a',.82);
          sign(inside,'기초부터 3분 · 선택 학습',cx,.62,.25,3,.38,'#2f3e5c','#fff4dc');
        }
      }
    }
  }

  const roof=new THREE.Group();roof.position.y=20;world.add(roof);
  schoolDetails.decorateExterior(exterior,floors.get(1).colliders);
  box(roof,0,-.22,0,29,.42,17,COLORS.roof);
  for(const z of [-8.1,8.1])box(roof,0,.22,z,28.8,.7,.23,COLORS.trim);
  for(const x of [-14.3,14.3])box(roof,x,.22,0,.23,.7,16.4,COLORS.trim);
  box(roof,-.8,.9,6.9,15.2,1.9,.7,'#3a6fb0');sign(roof,'퇴근초등학교',0,1,7.28,10.5,1.25,'#ffffff','#3a6fb0');
  // The facade clock belongs to the roof parapet, above every occupied floor.
  // Its opaque back must never sit across a fifth-floor window at eye level.
  const clockX=-6.8,clockY=1.02,clockZ=7.31;
  const clock=cyl(roof,clockX,clockY,clockZ,.68,.68,.08,'#f0dfba',24);clock.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const mark=box(roof,clockX+Math.sin(a)*.55,clockY+Math.cos(a)*.55,clockZ+.06,.04,.08,.025,'#2f3e5c');mark.rotation.z=-a;}
  const hour=box(roof,clockX+.15,clockY-.08,clockZ+.09,.045,.4,.025,'#2f3e5c');hour.rotation.z=-2.35;
  const minute=box(roof,clockX+.03,clockY-.24,clockZ+.10,.04,.52,.025,'#ba7657');minute.rotation.z=-3.04;
  box(roof,-8,.45,-3,3.4,.8,2,'#c3c9d0');box(roof,-8,.9,-3,3.1,.15,1.8,'#9aa3ad');
  for(let i=0;i<4;i++){const p=box(roof,6,.4,-4+i*1.25,6,.08,1.1,'#2f4f7f');p.rotation.x=.14;}
  const aerial=cyl(roof,10,1.1,4,.035,.035,2.2,'#e6dbc1',6);box(roof,10,2,4,1.1,.06,.06,'#e6dbc1');

  const crowd=createCrowd({floors,questObjects,teacher,mesh,geo,mat});
  for(const actor of crowd.actors){
    if(actor.kind==='npc'&&actor.missionId!==10){
      const center=actor.route[0].x;for(const point of actor.route)point.x=center+(point.x-center)*.65;
      if(actor.missionId===2)actor.route=[{x:7,z:.45},{x:8.6,z:.45},{x:8.6,z:1.1},{x:6.05,z:1.1}];
    }else for(const point of actor.route)point.z=3.3+(point.z-3.35)*1.45/3.75;
  }
  crowd.reset();
  const overtime=createOvertimeWorld({root:world,floors,teacher,box,mesh,geo,mat});
  const overtimeGuard=world.getObjectByName('overtime-security-guard');
  const fluorescent=[];
  for(const f of floors.values()){const lights=f.inside.getObjectByName(`overtime-lights-${[...floors.entries()].find(([,v])=>v===f)[0]}`);if(lights){lights.position.y=-.23;for(const fixture of lights.children){const lamp=fixture.getObjectByName('lamp');lamp.material=new THREE.MeshStandardMaterial({color:'#fff2bd',emissive:'#fff2bd',emissiveIntensity:.65,roughness:.85});fluorescent.push({fixture,lamp});}}}

  // Merge fixed scenery by material. The detailed school stays inexpensive to
  // draw, while NPCs, quest markers, lift sprites, car and gate remain movable.
  world.updateMatrixWorld(true);
  for(const {lamp} of yardLamps)collide(floors.get(1).colliders,lamp.position.x,lamp.position.z,.24,.24,false);
  const moving=new Set([car,gateLeft,gateRight,flag,nightSky,...yardLamps.flatMap(item=>[item.bulb,item.pool]),...Object.values(hallOfFame.statues),...(nurseRoom?.moving||[]),...(nurseRoom?.cutawayGroups||[]),...(nurseRoom?.backdropGroup?[nurseRoom.backdropGroup]:[]),...schoolDetails.cutawayGroups,...schoolProps.moving]);
  for(const q of animated)for(const object of [q.npc,q.ring,q.crystal,q.number])moving.add(object);
  for(const actor of crowd.actors)moving.add(actor.model);
  for(const object of overtime.moving)moving.add(object);
  function batchStatic(parent){
    const batches=new Map(),inverse=new THREE.Matrix4().copy(parent.matrixWorld).invert();
    function visit(node){
      if(moving.has(node))return;
      if(node.isMesh&&!Array.isArray(node.material)&&!node.material.transparent){
        const key=node.material.uuid;
        if(!batches.has(key))batches.set(key,{material:node.material,parts:[],sources:[]});
        const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
        batches.get(key).parts.push(g);batches.get(key).sources.push(node);
      }
      for(const child of [...node.children])visit(child);
    }
    for(const child of [...parent.children])visit(child);
    for(const {material,parts,sources}of batches.values()){
      if(parts.length<2){parts.forEach(g=>g.dispose());continue;}
      const merged=new THREE.BufferGeometry();
      for(const key of ['position','normal','uv']){
        if(parts.some(g=>!g.attributes[key]))continue;
        const size=parts[0].attributes[key].itemSize,length=parts.reduce((n,g)=>n+g.attributes[key].array.length,0);
        const array=new Float32Array(length);let offset=0;
        for(const g of parts){array.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length;}
        merged.setAttribute(key,new THREE.BufferAttribute(array,size));
      }
      merged.computeBoundingSphere();
      const combined=new THREE.Mesh(merged,material);combined.castShadow=true;combined.receiveShadow=true;parent.add(combined);
      for(const source of sources)source.parent?.remove(source);
      parts.forEach(g=>g.dispose());
    }
  }
  for(const statue of Object.values(hallOfFame.statues))batchStatic(statue);
  batchStatic(exterior);batchStatic(roof);if(nurseRoom?.root)batchStatic(nurseRoom.root);
  for(const group of [...(nurseRoom?.cutawayGroups||[]),...(nurseRoom?.backdropGroup?[nurseRoom.backdropGroup]:[]),...schoolDetails.cutawayGroups])batchStatic(group);
  for(const f of floors.values())for(const group of [f.inside,f.shell,f.front,f.cap,f.cutaway])batchStatic(group);

  function updateNurseBackdrop(){
    const p=viewPosition;
    nurseRoom?.setBackdropVisible?.(currentFloor===1&&cameraMode!=='overview'&&p.x>14&&p.x<26&&p.z>-7.7&&p.z<7.8&&p.y>0&&p.y<3.15);
  }
  function setFloor(floor) {
    currentFloor=Number.isInteger(floor)&&floor>=1&&floor<=5?floor:null;
    roof.visible=cameraMode!=='overview'||currentFloor===null;
    for(const q of animated){q.number.position.y=q.base+(cameraMode==='overview'?3.23:2.68);q.number.scale.set(cameraMode==='overview'?.75:.46,cameraMode==='overview'?.75:.46,1);q.crystal.visible=cameraMode==='overview'&&!q.done;}
    if(nurseRoom?.root)nurseRoom.root.visible=currentFloor===null||currentFloor===1;
    nurseRoom?.setCameraMode?.(cameraMode);updateNurseBackdrop();schoolDetails.setCameraMode(cameraMode);
    // Ground-floor monuments need no draw calls while exploring upper floors.
    for(const statue of Object.values(hallOfFame.statues))statue.visible=currentFloor===null||currentFloor===1;
    for(const [n,f] of floors){
      f.root.visible=cameraMode!=='overview'||currentFloor===null||n<=currentFloor;
      f.inside.visible=currentFloor===n;
      f.front.visible=cameraMode!=='overview'||currentFloor!==n;
      f.cap.visible=cameraMode!=='overview'||currentFloor!==n;
      f.cutaway.visible=currentFloor===n&&cameraMode!=='overview';
      // Human-height play keeps walls, windows and ceilings physically present.
    }
    return api;
  }
  function setCompleted(ids) {
    completed=new Set(ids||[]);
    for(const [id,q]of questObjects){
      const done=completed.has(id);if(q.done===done)continue;q.done=done;
      q.ring.material=mat(done?'#8fcea7':'#f5d27d',{emissive:done?'#8fcea7':'#f5d27d',emissiveIntensity:.2});
      q.crystal.visible=cameraMode==='overview'&&!done;q.number.material.opacity=done?.55:1;
    }
  }
  // Cache world-space camera barriers once. Unlike movement colliders these
  // include actual overhead slabs and doorway transoms, and exclude low desks.
  const cameraEnvelopes=new Map();
  for(const [number,f] of floors){
    const base=(number-1)*4;
    const list=f.colliders.filter(c=>c.blocksSight!==false).map(c=>({...c,minY:base,maxY:base+3}));
    list.push({x:0,z:-1.05,w:28.5,d:14.1,minY:base+3,maxY:base+3.18});
    for(const x of [-7,7])list.push({x,z:2.59,w:2.5,d:.2,minY:base+2.4,maxY:base+3});
    if(number===1){
      list.push({x:-20,z:0,w:12.4,d:16.5,minY:3,maxY:3.18});
      list.push(...(nurseRoom?.cameraColliders||[]));
      list.push({x:0,z:8.2,w:7.2,d:5.1,minY:3.07,maxY:3.29});
    }
    cameraEnvelopes.set(number,list);
  }
  const closedGateCameraEnvelope=[...cameraEnvelopes.get(1),{x:0,z:16,w:26.6,d:.25,minY:0,maxY:2.05}];
  const api={
    root:world, car, specialRooms,
    dimensions:Object.freeze({classroom:{width:8,depth:9},corridorWidth:3,ceilingHeight:3}),
    setCameraMode(mode){cameraMode=['shoulder','first','overview'].includes(mode)?mode:'shoulder';setFloor(currentFloor);},
    setViewPosition(position){viewPosition.x=position.x;viewPosition.y=position.y;viewPosition.z=position.z;updateNurseBackdrop();},
    setQuality(value){quality=['low','medium','high'].includes(value)?value:'medium';schoolDetails.setQuality?.(quality);},
    notifyMessage:schoolProps.notifyMessage,
    getRoomView(kind){
      if(kind==='exterior')return {floor:1,position:{x:0,y:0,z:12.5},lookYaw:0};
      if(kind==='staff')return {floor:5,position:{x:9.6,y:16,z:0},lookYaw:.7,cameraMode:'first'};
      if(kind==='copier')return {floor:4,position:{x:-5.4,y:12,z:1.5},lookYaw:-1,cameraMode:'first'};
      if(kind==='office')return {floor:4,position:{x:-7,y:12,z:-.4},lookYaw:0};
      return {floor:5,position:{x:-7,y:16,z:-.8},lookYaw:0};
    },
    getApproachPoint(item){if(!item)return null;return {x:item.missionId===2?7:item.x,y:item.y,z:item.missionId===10?4.6:item.missionId===2?1.3:Math.min(4.7,item.z+2.2)};},
    hallOfFameAnchors:hallOfFame.anchors,hallOfFameStatues:hallOfFame.statues,
    getBed(id){return beds.get(id)||null;},
    setRestPose(model,id,posture='back'){return nurseRoom?.setRestPose(model,id,posture)||false;},
    clearRestPose(model){nurseRoom?.clearRestPose(model);},
    updateResting:(dt,time)=>nurseRoom?.updateResting(dt,time),
    applyTeacherAppearance,
    get characters(){return crowd.actors;},
    /** Actors that may be hidden while they cross the camera lens. */
    get cameraOccluders(){return overtimeGuard?.visible?[...crowd.actors,{model:overtimeGuard,floor:currentFloor}]:crowd.actors;},
    getNPC:crowd.getNPC, getNPCAnchor:crowd.getNPCAnchor, getCharacterAnchor:crowd.getAnchor,
    updateCrowd:crowd.update, resetCrowd:crowd.reset, animateCharacter,
    updateOvertime(minutes,dt,options={}){overtime.update(minutes,dt,{...options,floor:currentFloor});for(const {fixture,lamp}of fluorescent)lamp.material.emissiveIntensity=fixture.userData.lit?.65:0;},
    /** Sky-dependent surfaces: window views, the infirmary lake, moon, stars and yard lamps. */
    setDaylight({golden=0,night=0,window}={}){
      daylightState.golden=golden;daylightState.night=night;
      if(window?.isColor){immersiveMaterials.setWindowTint(window);nurseRoom?.setSkyTint?.(window);}
      const dark=Math.max(0,Math.min(1,(night-.35)/.5));
      nightSky.visible=dark>0;moon.material.opacity=dark;nightSky.getObjectByName('stars').material.opacity=dark*.9;
      const glow=Math.max(0,Math.min(1,(night-.15)/.4));
      for(const {bulb,pool} of yardLamps){bulb.material.color.set(glow>.05?'#fff1c2':'#e9e4d6');pool.visible=glow>0;pool.material.opacity=glow*.32;}
    },
    get daylight(){return {...daylightState};},
    /** True when the camera stands in the open air of the school yard. */
    isOutdoors(p){
      if(!p||currentFloor!==1||cameraMode==='overview')return false;
      if(p.y>3.4)return true;
      if(Math.abs(p.x)>26.2||p.z<-8.1)return true;
      if(Math.abs(p.x)>14.1)return p.z>7.95;
      return p.z>5.95;
    },
    useCorridorAction:(kind,position)=>crowd.useAction(kind,position,currentFloor),
    heroTarget:new THREE.Vector3(0,8,1), heroCamera:new THREE.Vector3(42,31,44),
    get floor(){return currentFloor;},
    get colliders(){
      if(currentFloor===null)return [];
      const list=currentFloor===1?[...floors.get(1).colliders,...hallOfFame.colliders]:floors.get(currentFloor).colliders;
      if(currentFloor===1&&!gateOpen)return [...list,{x:0,z:16,w:26.6,d:.25}];
      return list;
    },
    get cameraColliders(){return currentFloor===1&&!gateOpen?closedGateCameraEnvelope:cameraEnvelopes.get(currentFloor)||[];},
    get interactables(){return currentFloor===null?[]:floors.get(currentFloor).interactables;},
    get bounds(){return currentFloor===1?{minX:-25.7,maxX:25.7,minZ:-7.7,maxZ:26}:{minX:-13.6,maxX:13.6,minZ:-7.7,maxZ:5.55};},
    // The first-floor entrance canopy spans x=-3.6..3.6; start beside it.
    spawn(floor){return {x:floor===1?-5:0,y:(floor-1)*4,z:4.65};},
    createTeacher(color='#e6bf83',identity={}){const holder=new THREE.Group();return teacher(holder,0,0,0,color,false,identity);},
    setFloor,setCompleted,
    openGate(){gateOpen=true;},
    reset(){
      gateOpen=false;gateAngle=0;gateLeft.rotation.y=0;gateRight.rotation.y=0;
      car.position.set(7,0,22.2);car.rotation.set(0,0,0);car.visible=true;
      setCompleted([]);crowd.reset();overtime.update(0,0);
    },
    update(dt,time,ids){
      schoolProps.update(dt,time);
      if(ids)setCompleted(ids);
      for(const q of animated){q.crystal.position.y=q.base+2.65+Math.sin(time*2+q.npc.position.x)*.12;q.crystal.rotation.y=time*.8;}
      const target=gateOpen?Math.PI*.53:0;gateAngle+=(target-gateAngle)*Math.min(1,dt*3);
      gateLeft.rotation.y=-gateAngle;gateRight.rotation.y=gateAngle;
      flag.rotation.y=Math.sin(time*.8)*.07;
    },
  };
  setFloor(null);return api;
}
