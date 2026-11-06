import * as THREE from './vendor/three.module.js';

// Original, lightweight school props. Decorations never award progress or alter
// mission state. Shared materials and small canvas signs are batched by world.js.
export function createSchoolProps({box,cyl,mesh,geo,mat}) {
  const textures=new Map(),surfaces=new Map(),moving=[],speakers=[],copiers=[];
  const palette={ink:'#304d46',wood:'#bd9b72',paper:'#faf4df',metal:'#788c88',green:'#85a18d'};
  let messageRemaining=0,manualJam=null;
  function group(parent,name,x=0,y=0,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);g.userData.schoolProp=name;parent.add(g);return g;}
  function surface(key,width,height,draw){
    if(!surfaces.has(key)){
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
      const texture=new THREE.CanvasTexture(canvas);texture.name='school-prop-'+key;texture.colorSpace=THREE.SRGBColorSpace;textures.set(key,texture);
      surfaces.set(key,new THREE.MeshStandardMaterial({map:texture,color:'#ffffff',roughness:.9,side:THREE.FrontSide}));
    }
    return surfaces.get(key);
  }
  function words(c,text,x,y,size,color=palette.ink){c.fillStyle=color;c.font=`700 ${size}px "Malgun Gothic", sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,x,y);}
  function panel(parent,key,x,y,z,w,h,paint,width=512,height=256){
    const p=mesh(parent,geo('PlaneGeometry',w,h),surface(key,width,height,paint),x,y,z,false);p.userData.schoolProp=key;return p;
  }
  function cup(parent,x,y,z,{half=false,rotation=0}={}){
    const g=group(parent,half?'half-drunk-mix-coffee':'mix-coffee-cup',x,y,z);g.rotation.y=rotation;
    mesh(g,geo('CylinderGeometry',.084,.064,.21,10,1,true),mat(palette.paper),0,.105,0);
    // The lowered coffee surface and cream rim make the two abandoned cups
    // visibly half-full instead of looking like solid brown cylinders.
    const drink=cyl(g,0,half?.135:.19,0,.071,.071,.006,'#95704e',10);drink.userData.coffeeLevel=half?.5:.9;
    const rim=mesh(g,geo('TorusGeometry',.081,.008,3,12),mat('#fff9e8'),0,.211,0,false);rim.rotation.x=Math.PI/2;
    panel(g,'coffee-cup-stripe',0,.105,.078,.12,.065,(c,W,H)=>{c.fillStyle='#d7ad69';c.fillRect(0,0,W,H);},64,32);
    if(half){const stir=box(g,.025,.22,.006,.012,.24,.012,'#d8b589');stir.rotation.z=.16;}
    return g;
  }
  function officeChair(parent,x,z,rotation){
    const g=group(parent,'research-office-chair',x,0,z);g.rotation.y=rotation;
    box(g,0,.52,0,.65,.12,.6,'#607d79');box(g,0,.99,-.24,.65,.78,.13,'#647f79');
    cyl(g,0,.29,0,.045,.055,.45,'#728682',8);
    for(const a of [0,Math.PI/2]){const foot=box(g,0,.08,0,.72,.045,.05,'#617570');foot.rotation.y=a;}
    for(const [x,z]of [[-.33,0],[.33,0],[0,-.33],[0,.33]])cyl(g,x,.055,z,.043,.043,.07,'#374d47',6);
    for(const x of [-.37,.37]){box(g,x,.75,0,.06,.05,.43,'#4c6861');box(g,x,.63,-.1,.04,.22,.045,'#738980');}
    return g;
  }
  function researchTable(parent,cx,centerZ){
    const z=centerZ,g=group(parent,'research-meeting-table',cx,0,z);
    box(g,0,.79,0,2.65,.14,1.35,palette.wood);
    for(const x of [-1.15,1.15])for(const zz of [-.5,.5])box(g,x,.39,zz,.075,.78,.075,'#758b85');
    officeChair(g,-1.75,0,Math.PI/2);officeChair(g,1.75,0,-Math.PI/2);
    officeChair(g,0,-1.12,0);officeChair(g,0,1.12,Math.PI);
    const boxes=[[-.55,-.18,'#d3ac52','믹스'],[-.12,-.18,'#827159','디카페인'],[.32,-.18,'#84967e','진한 맛']];
    for(const [x,zz,color,label]of boxes){
      box(g,x,1.02,zz,.34,.34,.24,color);
      panel(g,'coffee-box-'+label,x,1.04,zz+.126,.29,.22,(c,W,H)=>{c.fillStyle=color;c.fillRect(0,0,W,H);words(c,label,W/2,H/2,label==='디카페인'?31:42,'#fff8e3');},256,160);
    }
    // Individual sticks, biscuits and wrapped snacks are reusable box geometry.
    for(let i=0;i<5;i++){const stick=box(g,-.53+i*.11,.883,.2,.075,.035,.32,['#dfc05b','#a58763','#8b9c7b'][i%3]);stick.rotation.y=-.12+i*.08;}
    box(g,.74,.89,.03,.7,.05,.48,'#d1c5a9');
    for(let i=0;i<4;i++){const snack=box(g,.52+(i%2)*.28,.96+Math.floor(i/2)*.02,-.08+Math.floor(i/2)*.2,.23,.09,.17,['#ba8975','#ccac6a','#99ac98','#b39bba'][i]);snack.rotation.y=i*.07;}
    cyl(g,.75,.95,.37,.12,.12,.055,'#c59b62',10);
    for(const [x,zz,rotation]of [[-1.02,.4,.3],[1.01,-.41,-.2]])cup(g,x,.86,zz,{half:true,rotation});
    g.userData.chairCount=4;g.userData.halfDrunkCups=2;
    return {root:g,collider:{x:cx,z,w:2.65,d:1.35,blocksSight:false}};
  }
  function childrenArt(parent,x,y,z){
    return panel(parent,'children-art',x,y,z,1.85,.94,(c,W,H)=>{
      c.fillStyle=palette.wood;c.fillRect(0,0,W,H);c.fillStyle='#d8d9b5';c.fillRect(12,12,W-24,H-24);
      words(c,'우리 반 작은 미술관',W/2,31,23);
      for(let i=0;i<3;i++){
        const xx=24+i*160;c.fillStyle='#fff9e9';c.fillRect(xx,55,144,177);c.fillStyle=['#c9e1dc','#d4e0b7','#d6dbeb'][i];c.fillRect(xx+8,63,128,161);
        c.fillStyle='#ebc16f';c.beginPath();c.arc(xx+112,88,14,0,Math.PI*2);c.fill();
        c.fillStyle=['#93b188','#90ae8a','#a0b591'][i];c.beginPath();c.moveTo(xx+8,182);c.lineTo(xx+64,109);c.lineTo(xx+131,183);c.fill();
        c.fillStyle=['#bd8f79','#d8a76e','#af94ae'][i];c.fillRect(xx+34,161,50,44);
        c.fillStyle='#f2ddac';c.fillRect(xx+51,174,16,31);c.fillStyle='#7c6050';c.beginPath();c.moveTo(xx+25,163);c.lineTo(xx+59,136);c.lineTo(xx+94,163);c.fill();
      }
    });
  }
  function safetyPoster(parent,x,y,z){
    return panel(parent,'safety-poster',x,y,z,.62,.87,(c,W,H)=>{
      c.fillStyle='#fff8e6';c.fillRect(0,0,W,H);c.fillStyle='#719687';c.fillRect(0,0,W,78);words(c,'복도에서는',W/2,39,37,'#fff8e9');
      words(c,'천천히 걸어요',W/2,H-62,38);c.strokeStyle='#678779';c.lineWidth=17;c.lineCap='round';
      c.beginPath();c.arc(W/2,147,29,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(W/2,182);c.lineTo(W/2-7,280);c.lineTo(W/2-55,346);c.moveTo(W/2-7,280);c.lineTo(W/2+49,346);c.moveTo(W/2,212);c.lineTo(W/2-65,253);c.moveTo(W/2,212);c.lineTo(W/2+60,250);c.stroke();
    },384,512);
  }
  function face(parent,{speaker=false}={}){
    const f=group(parent,speaker?'speaker-expression':'copier-expression');moving.push(f);
    const eyes=[],brows=[];
    for(const side of [-1,1]){
      const white=mesh(f,geo('SphereGeometry',1,8,5),mat('#f6f1dd'),side*.14,.055,0,false);white.scale.set(.087,.105,.025);
      const pupil=mesh(f,geo('SphereGeometry',1,6,4),mat('#2f4843'),side*.14,.055,.026,false);pupil.scale.set(.036,.052,.018);eyes.push(pupil);
      const brow=box(f,side*.14,.192,.02,.15,.035,.025,'#3e554d');brows.push(brow);
    }
    const mouth=box(f,0,-.14,.02,.12,.028,.024,'#3c514a');
    return {root:f,eyes,brows,mouth};
  }
  function copier(parent,x,z){
    const g=group(parent,'paper-jam-copier',x,0,z);
    box(g,0,.62,0,.98,1.1,.76,'#c4cbc1');box(g,0,1.23,-.01,1.08,.15,.85,'#e0e3d7');box(g,0,1.335,-.02,.89,.06,.68,'#71867c');
    box(g,0,.21,.39,.83,.2,.035,'#b0baae');box(g,0,.44,.39,.83,.2,.035,'#b8c1b4');
    for(const y of [.21,.44])box(g,0,y+.06,.416,.24,.027,.032,'#71867c');
    box(g,.36,1.34,.31,.24,.06,.14,'#3c5951');box(g,.36,1.375,.32,.17,.013,.09,'#a7ceae',{emissive:'#86b68f',emissiveIntensity:.12});
    const f=face(g);f.root.position.set(0,.86,.397);
    const jamPaper=box(g,.52,.88,.1,.48,.025,.5,'#f6f1dd');jamPaper.rotation.z=-.12;moving.push(jamPaper);
    const led=box(g,.35,.65,.397,.065,.045,.024,'#d8ad6c');moving.push(led);
    panel(g,'copier-label',0,1.16,.434,.51,.11,(c,W,H)=>{c.fillStyle='#e8e9dd';c.fillRect(0,0,W,H);words(c,'복사 대기 중',W/2,H/2,25);},256,64);
    const item={root:g,face:f.root,eyes:f.eyes,brows:f.brows,mouth:f.mouth,jamPaper,led};copiers.push(item);return g;
  }
  function speaker(parent,x,y,z){
    const g=group(parent,'messenger-speaker',x,y,z);
    box(g,0,0,0,.68,.58,.2,'#7d9589');box(g,0,0,.11,.58,.48,.04,'#c4cdbb');
    const f=face(g,{speaker:true});f.root.position.z=.15;f.root.scale.set(.9,.9,1);
    box(g,0,-.36,-.03,.08,.18,.07,'#70877c');
    panel(g,'messenger-speaker-label',0,.37,.13,.7,.15,(c,W,H)=>{c.fillStyle='#fff5de';c.fillRect(0,0,W,H);words(c,'퇴근톡 알림',W/2,H/2,31);},256,64);
    const item={root:g,face:f.root,eyes:f.eyes,brows:f.brows,mouth:f.mouth};speakers.push(item);return g;
  }
  function decorateRoom({parent,room,cx,centerZ=-2,width=8,depth=9,colliders,collide}){
    const backZ=centerZ-depth/2+.18,frontZ=centerZ+depth/2-.19;
    if(room.kind==='classroom'){
      panel(parent,'blackboard-today',cx,1.68,backZ+.08,6.1,1.02,(c,W,H)=>{
        c.fillStyle='#46675d';c.fillRect(0,0,W,H);words(c,'11월 ○일 · 오늘도 정시 퇴근',W/2,H*.36,49,'#f0ead8');
        words(c,'서로의 다름을 존중하는 우리 반',W/2,H*.75,31,'#d4d9bd');
      },1024,256);
      const lockers=group(parent,'classroom-back-lockers',cx,0,frontZ-.14);
      // Two side banks leave the central door and teacher approach open.
      for(const side of [-1,1])for(let col=0;col<2;col++)for(let row=0;row<2;row++){
        const x=side*(width/2-1.1+col*.52),y=.35+row*.61;
        box(lockers,x,y,0,.49,.56,.39,['#b6c1a4','#bdcdb9','#c2c9ad','#aebfb1'][(row+col)%4]);
        box(lockers,x,y,.21,.43,.5,.025,'#d8deca');box(lockers,x+.12,y+.04,.233,.027,.1,.025,'#819688');
      }
    }
    if(room.kind==='staff'){
      const table=researchTable(parent,cx,centerZ);if(colliders&&collide)collide(colliders,table.collider.x,table.collider.z,table.collider.w,table.collider.d,false);
      return table;
    }
    if(room.kind==='office'){
      const copierX=cx+width/2-.78,copierZ=.4;
      copier(parent,copierX,copierZ);
      if(colliders)colliders.push({x:copierX,z:copierZ,w:1.08,d:.85,height:1.4,blocksSight:false});
      // Existing staff desks carry monitors and papers; these cups finish them.
      for(const x of [cx-width*.3,cx+width*.3])cup(parent,x+.45,1.03,centerZ-1.2);
    }
    return null;
  }
  function decorateCorridor({parent,floor,x=-3,z=2.73,ceiling=3}){
    childrenArt(parent,x,1.84,z);safetyPoster(parent,x+1.45,1.83,z);
    // One original speaker character per floor, so new notes have a visible
    // reaction on whichever floor the teacher is exploring.
    speaker(parent,-x,ceiling-.46,z+.04).userData.floor=floor;
  }
  function notifyMessage(){messageRemaining=1.5;}
  function setCopierJam(value){manualJam=typeof value==='boolean'?value:null;}
  function update(dt,time){
    messageRemaining=Math.max(0,messageRemaining-Math.max(0,Number(dt)||0));
    const surprised=messageRemaining>0;
    for(const s of speakers){
      s.root.userData.expression=surprised?'surprised':'calm';
      for(const eye of s.eyes)eye.scale.y=surprised?.071:.052;
      s.brows[0].rotation.z=surprised?-.14:0;s.brows[1].rotation.z=surprised?.14:0;
      s.mouth.scale.set(surprised?.55:1,surprised?3.7:1,1);
      s.face.rotation.z=surprised?Math.sin((Number(time)||0)*21)*.045:0;
    }
    const jam=manualJam??((Number(time)||0)%25>17);
    for(const c of copiers){
      c.root.userData.expression=jam?'paper-jam':'calm';c.jamPaper.visible=jam;
      c.brows[0].rotation.z=jam?-.33:0;c.brows[1].rotation.z=jam?.33:0;
      c.mouth.scale.y=jam?1.6:1;c.mouth.rotation.z=jam?-.13:0;
      c.led.material=mat(jam?'#c77b5a':'#91b294',{emissive:jam?'#a64429':'#5f956e',emissiveIntensity:.2});
    }
  }
  return {decorateRoom,decorateCorridor,notifyMessage,setCopierJam,update,moving,textures,speakers,copiers};
}
