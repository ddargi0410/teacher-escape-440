import * as THREE from './vendor/three.module.js';
import {roomFrontWallSegments} from './stairs.js';

// Static Korean-school details. Reused textures/materials are baked only once;
// world.js merges the opaque geometry with each floor's existing scenery.
export function createSchoolDetails({box,cyl,mesh,geo,mat,collide}) {
  const textures=new Map(),surfaces=new Map();
  const ink='#29483f',cream='#f3f0e4',green='#86a795',wood='#b58e65',silver='#a8b2ad';
  function texture(key,width,height,draw){
    if(textures.has(key))return textures.get(key);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const c=canvas.getContext('2d');draw(c,width,height);
    const result=new THREE.CanvasTexture(canvas);result.name=key;result.colorSpace=THREE.SRGBColorSpace;
    textures.set(key,result);return result;
  }
  function surface(key,width,height,draw){
    if(!surfaces.has(key))surfaces.set(key,new THREE.MeshBasicMaterial({map:texture(key,width,height,draw),side:THREE.DoubleSide}));
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
  function decorateFloor({inside,front,floor,rooms,colliders}){
    inside.userData.koreanSchool=true;
    const tile=panel(inside,'terrazzo-corridor',0,.112,4.95,27.4,5.7,(c,W,H)=>{
      c.fillStyle='#dedfd4';c.fillRect(0,0,W,H);
      // Deterministic terrazzo flecks; no thousands of individual 3D tiles.
      const flecks=['#c6c9bc','#f0eee4','#b7bcae'];
      for(let i=0;i<650;i++){c.fillStyle=flecks[i%3];c.fillRect((i*73+17)%W,(i*47+5)%H,2+(i%3),2);}
      c.strokeStyle='#b2b9aa';c.lineWidth=2;c.beginPath();
      for(let x=0;x<=W;x+=64){c.moveTo(x,0);c.lineTo(x,H);}for(let y=0;y<=H;y+=64){c.moveTo(0,y);c.lineTo(W,y);}c.stroke();
      c.fillStyle='#a5b59f';c.fillRect(0,0,W,14);c.fillRect(0,H-14,W,14);
    },1024,256);tile.rotation.x=-Math.PI/2;
    // Low window sills remain visible in the playable cutaway; the path stays open.
    for(const x of [-8,8]){box(inside,x,.44,7.84,11.6,.86,.1,cream);box(inside,x,.89,7.84,11.6,.08,.18,'#c5ccb8');}
    for(const [index,room]of rooms.entries()){
      const cx=index===0?-7:7,outward=index===0?-1:1;
      const walls=roomFrontWallSegments(cx);
      for(const [wallIndex,side] of [-1,1].entries()){
        const wall=walls[wallIndex];
        // Korean classroom walls are painted darker below the handrail.
        box(inside,wall.x,.55,2.615,wall.w,1.1,.035,green);
        box(inside,wall.x,.12,2.65,wall.w,.15,.06,'#5d796a');
        box(inside,wall.x,1.12,2.67,wall.w,.07,.09,'#a7b49f');
        // Sliding glazed door panels are parked against the solid wall, leaving
        // the existing four-metre doorway and every authored route untouched.
        const dx=cx+side*2.94;
        box(inside,dx,1.25,2.67,1.55,2.36,.08,'#bfc7ba');
        box(inside,dx,1.72,2.723,1.31,1.12,.025,'#b8d0c8');
        box(inside,dx,.59,2.723,1.31,.78,.025,'#e7e7d8');
        box(inside,dx,1.72,2.75,.04,1.14,.025,silver);
        box(inside,dx-side*.57,1.16,2.77,.045,.34,.06,'#596f64');
        box(inside,dx,2.47,2.65,1.7,.06,.09,silver);
        // A recessed shoe cabinet stays behind the standing corridor route.
        if(side===outward){
          const sx=cx+outward*4.97;
          box(inside,sx,.47,2.58,2.28,.87,.32,wood);
          box(inside,sx,.48,2.75,2.08,.68,.025,'#4d5e50');
          for(let row=0;row<2;row++)for(let col=0;col<4;col++){
            const xx=sx-.78+col*.52,yy=.28+row*.36;
            box(inside,xx,yy,2.79,.47,.035,.11,'#dac19a');
            for(const shoe of [-1,1])box(inside,xx+shoe*.10,yy+.07,2.78,.14,.08,.12,col%2?'#e6e2d3':'#7b96a0');
          }
          for(const dd of [-.52,0,.52])box(inside,sx+dd,.49,2.77,.035,.72,.08,wood);
          collide(colliders,sx,2.6,2.3,.42,false);
        }
      }
      // Glazed transom and a large, familiar classroom number plate.
      box(inside,cx,2.94,2.52,4.08,.48,.08,'#b7cec3');
      for(const dx of [-2.04,-.68,.68,2.04])box(inside,cx+dx,2.94,2.57,.05,.49,.04,silver);
      box(inside,cx,3.2,2.55,4.16,.06,.07,silver);
      const roomNumber=room.kind==='classroom'?'6학년 4반':`${floor}층 · ${index+1}호실`;
      plaque(inside,`room-number-${floor}-${index}`,room.name,roomNumber,cx+outward*4.78,2.91,2.7,2.9,.62);
      panel(inside,'school-noticeboard',cx+outward*4.83,1.94,2.72,2.67,1.18,(c,W,H)=>{
        c.fillStyle=wood;c.fillRect(0,0,W,H);c.fillStyle='#b9c6a4';c.fillRect(16,16,W-32,H-32);
        words(c,'알 림 마 당',W/2,57,45);
        const labels=['학교 소식','환경 교육','이번 주 급식'];
        for(let i=0;i<3;i++){const x=40+i*238;c.fillStyle=cream;c.fillRect(x,98,212,248);words(c,labels[i],x+106,141,28);
          c.fillStyle=['#d9ad73','#8ba88e','#c4ac9a'][i];c.fillRect(x+33,184,146,68);
          c.fillStyle='#8f9b89';for(let line=0;line<3;line++)c.fillRect(x+32,275+line*20,145-line*17,5);
          c.fillStyle='#b37056';c.beginPath();c.arc(x+106,102,7,0,Math.PI*2);c.fill();}
      });
      clock(inside,outward*3.55,2.08,2.71);
      // Green lower panels on the room's rear wall reinforce the familiar palette.
      box(inside,cx,.46,-7.6,13.25,.9,.035,'#acc0a5');
      box(inside,cx,.07,-7.56,13.25,.12,.05,'#7c937e');
    }
    // Utility cabinets sit on the remaining walls, outside the open stair mouth.
    box(inside,2.65,.72,2.65,.44,1.02,.22,'#e4ddd0');
    cyl(inside,2.65,.58,2.8,.12,.12,.5,'#b65c48',8);
    box(inside,2.65,.91,2.8,.18,.07,.08,'#3b5148');
    plaque(inside,'fire-extinguisher','소화기','FIRE',2.65,1.31,2.81,.58,.34);
    collide(colliders,2.65,2.65,.46,.28,false);
    box(inside,-2.65,1.0,2.6,.82,1.88,.22,'#c8d1bb');
    box(inside,-2.65,1.0,2.73,.73,1.76,.025,'#dfe3d1');
    box(inside,-2.4,1.0,2.77,.04,.24,.05,'#617d6b');
    plaque(inside,'cleaning-cupboard','청소도구','사용 후 제자리',-2.65,1.45,2.77,.63,.36);
    collide(colliders,-2.65,2.6,.84,.3,false);
    plaque(inside,`floor-wayfinding-${floor}`,`${floor}층 중앙계단`,'E · 위층 / 아래층 이동',0,2.93,2.78,3.7,.66);
    // The central exterior glazing has visible floor landings and handrails.
    box(front,0,.35,8.3,3.7,.12,.4,'#bdc7b6');
    box(front,0,1.23,8.31,3.5,.06,.04,silver);
    for(const x of [-1.6,0,1.6])box(front,x,.83,8.31,.045,.8,.05,silver);
    if(floor===1){
      // Aluminium double entrance doors appear with the outside facade and lift
      // away with it for playable first-floor cutaway/ending movement.
      for(const side of [-1,1]){
        const dx=side*.89;
        box(front,dx,1.4,8.38,1.72,2.75,.08,silver);
        box(front,dx,1.5,8.43,1.57,2.43,.035,'#bdd2c8');
        box(front,dx,1.1,8.46,1.59,.075,.035,cream);
        box(front,side*.17,1.3,8.5,.055,.54,.07,'#4b665a');
      }
    }
  }
  function decorateExterior(exterior,colliders){
    // Typical sheltered entrance and accessible approach, without obstacles in
    // the main +Z exit route or the car's ending-animation lane.
    box(exterior,0,3.18,9.05,7.2,.22,3.4,'#6f8d80');
    box(exterior,0,3.04,10.72,7.2,.12,.18,cream);
    for(const x of [-3.35,3.35]){box(exterior,x,1.51,10.55,.16,3.02,.16,'#91a292');collide(colliders,x,10.55,.16,.16);}
    plaque(exterior,'school-entrance','퇴근초등학교','중앙 현관',0,2.92,10.85,5.6,.65);
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
  return {decorateFloor,decorateExterior};
}
