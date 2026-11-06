import * as THREE from './vendor/three.module.js';
const roomFrontWallSegments=cx=>[-1,1].map(side=>({x:cx+side*2.625,w:2.75}));

// Static Korean-school details. Reused textures/materials are baked only once;
// world.js merges the opaque geometry with each floor's existing scenery.
export function createSchoolDetails({box,cyl,mesh,geo,mat,collide,surfaceMaterial}) {
  const textures=new Map(),surfaces=new Map(),sunPatches=[],cutawayGroups=[];
  const ink='#29483f',cream='#f3f0e4',green='#86a795',wood='#b58e65',silver='#a8b2ad';
  function texture(key,width,height,draw){
    if(textures.has(key))return textures.get(key);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const c=canvas.getContext('2d');draw(c,width,height);
    const result=new THREE.CanvasTexture(canvas);result.name=key;result.colorSpace=THREE.SRGBColorSpace;
    textures.set(key,result);return result;
  }
  function surface(key,width,height,draw){
    if(!surfaces.has(key))surfaces.set(key,new THREE.MeshBasicMaterial({map:texture(key,width,height,draw),side:THREE.FrontSide}));
    return surfaces.get(key);
  }
  function words(c,value,x,y,size,color=ink){c.fillStyle=color;c.font=`800 ${size}px "Malgun Gothic", sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(value,x,y);}
  function panel(parent,key,x,y,z,w,h,paint,width=768,height=384){
    const p=mesh(parent,geo('PlaneGeometry',w,h),surface(key,width,height,paint),x,y,z,false);
    p.userData.schoolDetail=key;return p;
  }
  function plaque(parent,key,title,subtitle,x,y,z,w=2.4,h=.58){
    return panel(parent,key,x,y,z,w,h,(c,W,H)=>{
      c.fillStyle=cream;c.fillRect(0,0,W,H);c.fillStyle=green;c.fillRect(0,0,18,H);
      c.strokeStyle='#567c6b';c.lineWidth=7;c.strokeRect(4,4,W-8,H-8);
      words(c,title,W/2,H*.37,76);words(c,subtitle,W/2,H*.77,38,'#51695c');
    },768,192);
  }
  function clock(parent,x,y,z){
    // A single textured face is clearer and cheaper than dozens of clock parts.
    panel(parent,'corridor-clock',x,y,z,.65,.65,(c,W,H)=>{
      c.fillStyle=cream;c.fillRect(0,0,W,H);c.fillStyle='#435c51';c.beginPath();c.arc(W/2,H/2,124,0,Math.PI*2);c.fill();
      c.fillStyle=cream;c.beginPath();c.arc(W/2,H/2,112,0,Math.PI*2);c.fill();
      for(let n=1;n<=12;n++){const a=n*Math.PI/6;words(c,String(n),128+Math.sin(a)*87,128-Math.cos(a)*87,26);}
      c.strokeStyle=ink;c.lineCap='round';c.lineWidth=9;c.beginPath();c.moveTo(128,128);c.lineTo(170,156);c.stroke();
      c.lineWidth=6;c.beginPath();c.moveTo(128,128);c.lineTo(137,204);c.stroke();
    },256,256);
  }
  function decorateFloor({inside,front,cutaway=inside,floor,rooms,colliders}){
    inside.userData.koreanSchool=true;
    const tile=panel(inside,'terrazzo-corridor',0,.112,4.18,27.4,3,(c,W,H)=>{
      c.fillStyle='#dedfd4';c.fillRect(0,0,W,H);const flecks=['#c6c9bc','#f0eee4','#b7bcae'];
      for(let i=0;i<6800;i++){c.fillStyle=flecks[i%3];c.fillRect((i*73+17)%W,(i*47+5)%H,2+(i%3),2);}
      c.strokeStyle='#b2b9aa';c.lineWidth=2;c.beginPath();
      for(let x=0;x<=W;x+=128){c.moveTo(x,0);c.lineTo(x,H);}for(let y=0;y<=H;y+=128){c.moveTo(0,y);c.lineTo(W,y);}c.stroke();
      c.fillStyle='#a5b59f';c.fillRect(0,0,W,12);c.fillRect(0,H-12,W,12);
    },2048,384);tile.rotation.x=-Math.PI/2;tile.material=new THREE.MeshStandardMaterial({color:'#ffffff',map:tile.material.map,roughness:.78});
    for(const x of [-8,8])box(inside,x,.08,5.64,11.6,.14,.07,'#708b7e');
    for(const [index,room]of rooms.entries()){
      const cx=index===0?-7:7,outward=index===0?-1:1;
      for(const wall of roomFrontWallSegments(cx)){
        box(inside,wall.x,.5,2.705,wall.w,1,.035,green);
        box(inside,wall.x,.10,2.74,wall.w,.13,.06,'#5d796a');
        box(inside,wall.x,1.035,2.75,wall.w,.055,.065,'#a7b49f');
      }
      // Two wooden sliding leaves are parked beside a 2.5 m unobstructed opening.
      for(const side of [-1,1]){
        const dx=cx+side*1.95;
        const door=box(cutaway,dx,1.22,2.74,1.4,2.38,.08,wood);if(surfaceMaterial)door.material=surfaceMaterial('wood');
        box(cutaway,dx,1.68,2.79,1.16,1.03,.025,'#b8d0c8');
        box(cutaway,dx,1.68,2.82,.04,1.05,.025,silver);
        box(cutaway,dx-side*.50,1.11,2.84,.045,.29,.06,'#596f64');
        box(cutaway,dx,2.44,2.73,1.48,.05,.1,silver);
      }
      const sx=cx+outward*3.2;
      box(inside,sx,.42,2.76,1.45,.74,.28,wood);box(inside,sx,.43,2.91,1.31,.6,.025,'#4d5e50');
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const xx=sx-.43+col*.43,yy=.24+row*.3;box(inside,xx,yy,2.94,.39,.035,.1,'#dac19a');
        for(const shoe of [-1,1])box(inside,xx+shoe*.075,yy+.06,2.94,.11,.07,.1,'#e6e2d3');
      }
      collide(colliders,sx,2.76,1.45,.3,false);
      const roomNumber=room.kind==='classroom'?'6학년 4반':`${floor}층 · ${index+1}호실`;
      plaque(cutaway,`room-number-${floor}-${index}`,room.name,roomNumber,cx+outward*3.15,2.57,2.79,1.65,.43);
      if(index===1)panel(cutaway,'school-noticeboard',cx+outward*3.35,1.64,2.79,1.12,.86,(c,W,H)=>{
        c.fillStyle=wood;c.fillRect(0,0,W,H);c.fillStyle='#b9c6a4';c.fillRect(16,16,W-32,H-32);words(c,'알 림 마 당',W/2,57,45);
        const labels=['학교 소식','환경 교육','이번 주 급식'];
        for(let i=0;i<3;i++){const x=40+i*238;c.fillStyle=cream;c.fillRect(x,98,212,248);words(c,labels[i],x+106,141,28);c.fillStyle=['#d9ad73','#8ba88e','#c4ac9a'][i];c.fillRect(x+33,184,146,68);c.fillStyle='#8f9b89';for(let line=0;line<3;line++)c.fillRect(x+32,275+line*20,145-line*17,5);}
      });
      clock(cutaway,cx-outward*3.25,2.1,2.79);
      box(inside,cx,.5,-6.475,8,1,.035,'#acc0a5');box(inside,cx,.07,-6.44,8,.12,.05,'#7c937e');
      for(const side of [-1,1]){box(inside,cx+side*3.985,.5,-2,.035,1,9,'#acc0a5');box(inside,cx+side*3.97,.07,-2,.05,.12,9,'#7c937e');}
    }
    box(inside,2.65,.72,2.81,.44,1.02,.22,'#e4ddd0');cyl(inside,2.65,.58,2.96,.12,.12,.5,'#b65c48',8);
    box(inside,2.65,.91,2.96,.18,.07,.08,'#3b5148');plaque(cutaway,'fire-extinguisher','소화기','FIRE',2.65,1.31,2.97,.58,.34);collide(colliders,2.65,2.81,.46,.28,false);
    box(inside,-2.65,1.0,2.76,.7,1.88,.22,'#c8d1bb');box(inside,-2.65,1.0,2.89,.63,1.76,.025,'#dfe3d1');
    plaque(cutaway,'cleaning-cupboard','청소도구','사용 후 제자리',-2.65,1.45,2.93,.58,.36);collide(colliders,-2.65,2.76,.72,.3,false);
    const board=plaque(cutaway,`floor-wayfinding-${floor}`,`${floor}층 중앙계단`,'E · 위층 / 아래층 이동',0,2.69,2.86,3.4,.47);
    const boardBack=board.clone();boardBack.position.z-=.015;boardBack.rotation.y=Math.PI;cutaway.add(boardBack);
    if(floor===1)for(const side of [-1,1]){box(front,side*2.18,1.3,5.95,.12,2.58,.9,silver);box(front,side*2.18,1.1,6.2,.17,.06,.5,cream);}
    for(const z of [3.4,4.18,4.96])box(cutaway,0,2.99,z,27.4,.02,.025,'#c5cbc3');
    for(let x=-12;x<=12;x+=3)box(cutaway,x,2.99,4.18,.025,.02,3,'#c5cbc3');
    // Classroom fluorescent diffusers are flush below the 3 m acoustic ceiling.
    for(const x of [-9.2,-4.8,4.8,9.2])for(const z of [-4.7,.5]){
      box(cutaway,x,2.96,z,1.24,.08,.56,'#bdc5ba');box(cutaway,x,2.912,z,1.14,.016,.48,'#fffbea',{emissive:'#fff6da',emissiveIntensity:.45});
    }
    for(const [key,x,angle,label]of [['hall-exit',0,Math.PI/2,'←  비상구'],['hall-exit-reverse',-.015,-Math.PI/2,'비상구  →']]){
      const exit=panel(cutaway,key,x,2.64,4.9,1.15,.36,(c,W,H)=>{c.fillStyle='#2c956c';c.fillRect(0,0,W,H);words(c,label,W/2,H/2,67,'#ffffff');},512,160);exit.rotation.y=angle;
    }
    box(cutaway,0,2.9,4.9,.045,.2,.045,'#8c9c8f');
    for(const x of [-11.6,-8.25,-4.9,4.9,8.25,11.6]){
      const patch=mesh(inside,geo('PlaneGeometry',1.2,1.9),new THREE.MeshBasicMaterial({color:'#fff2c9',transparent:true,opacity:.09,depthWrite:false}),x,.125,4.48,false);patch.rotation.x=-Math.PI/2;patch.rotation.z=.16;patch.name='window-sun-patch';sunPatches.push(patch);
    }
  }
  function decorateExterior(exterior,colliders){
    // Typical sheltered entrance and accessible approach, without obstacles in
    // the main +Z exit route or the car's ending-animation lane.
    const canopy=new THREE.Group();canopy.name='entrance-canopy';exterior.add(canopy);cutawayGroups.push(canopy);
    box(canopy,0,3.18,8.2,7.2,.22,5.1,'#6f8d80');
    box(canopy,0,3.04,10.72,7.2,.12,.18,cream);
    for(const x of [-3.35,3.35]){box(canopy,x,1.51,10.55,.16,3.02,.16,'#91a292');collide(colliders,x,10.55,.16,.16);}
    plaque(canopy,'school-entrance','퇴근초등학교','중앙 현관',0,2.92,10.85,5.6,.65);
    box(exterior,0,.075,8.72,3.6,.04,1.65,'#b4bba9');
    for(const x of [-1.55,1.55])for(let i=0;i<6;i++)box(exterior,x,.106,8.15+i*.23,.18,.025,.055,'#e0c96b');
    // Low playground border, reading garden and school gate warning marker.
    box(exterior,-8,.11,10.5,6.4,.025,3.1,'#bba582');
    for(const z of [9.05,11.95])box(exterior,-8,.14,z,6.4,.035,.06,'#f3e7cb');
    for(const x of [-11.16,-4.84])box(exterior,x,.14,10.5,.06,.035,2.9,'#f3e7cb');
    plaque(exterior,'school-garden','학교 생태 정원','관찰하고 · 기록하고 · 함께 배우기',-11.9,1.12,13,3.1,.64);
    box(exterior,-11.9,.53,12.98,.08,1.06,.08,'#708774');
    plaque(exterior,'school-zone','어린이 보호구역','천천히 안전하게',13.2,3.2,16.8,2.1,.58);
  }
  return {decorateFloor,decorateExterior,cutawayGroups,setCameraMode:mode=>{for(const group of cutawayGroups)group.visible=mode!=='overview';},setQuality:value=>{for(const patch of sunPatches)patch.visible=value!=='low';}};
}
