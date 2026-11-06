import * as THREE from './vendor/three.module.js';

// Original, lightweight school props. Decorations never award progress or alter
// mission state. Shared materials and small canvas signs are batched by world.js.
export function createSchoolProps({box,cyl,mesh,geo,mat}) {
  const textures=new Map(),surfaces=new Map(),moving=[],speakers=[],copiers=[];
  const palette={ink:'#2f3e5c',wood:'#bd9b72',paper:'#faf4df',metal:'#8a929c',green:'#7cc36b'};
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
    box(g,0,.52,0,.65,.12,.6,'#4f74d6');box(g,0,.99,-.24,.65,.78,.13,'#5580dc');
    cyl(g,0,.29,0,.045,.055,.45,'#8a929c',8);
    for(const a of [0,Math.PI/2]){const foot=box(g,0,.08,0,.72,.045,.05,'#6d737a');foot.rotation.y=a;}
    for(const [x,z]of [[-.33,0],[.33,0],[0,-.33],[0,.33]])cyl(g,x,.055,z,.043,.043,.07,'#2b2f36',6);
    for(const x of [-.37,.37]){box(g,x,.75,0,.06,.05,.43,'#3a3f4a');box(g,x,.63,-.1,.04,.22,.045,'#8a929c');}
    return g;
  }
  function researchTable(parent,cx,centerZ){
    const z=centerZ,g=group(parent,'research-meeting-table',cx,0,z);
    box(g,0,.79,0,2.65,.14,1.35,palette.wood);
    for(const x of [-1.15,1.15])for(const zz of [-.5,.5])box(g,x,.39,zz,.075,.78,.075,'#8a929c');
    officeChair(g,-1.75,0,Math.PI/2);officeChair(g,1.75,0,-Math.PI/2);
    officeChair(g,0,-1.12,0);officeChair(g,0,1.12,Math.PI);
    const boxes=[[-.55,-.18,'#d3ac52','믹스'],[-.12,-.18,'#827159','디카페인'],[.32,-.18,'#3f6fb0','진한 맛']];
    for(const [x,zz,color,label]of boxes){
      box(g,x,1.02,zz,.34,.34,.24,color);
      panel(g,'coffee-box-'+label,x,1.04,zz+.126,.29,.22,(c,W,H)=>{c.fillStyle=color;c.fillRect(0,0,W,H);words(c,label,W/2,H/2,label==='디카페인'?31:42,'#fff8e3');},256,160);
    }
    // Individual sticks, biscuits and wrapped snacks are reusable box geometry.
    for(let i=0;i<5;i++){const stick=box(g,-.53+i*.11,.883,.2,.075,.035,.32,['#dfc05b','#a58763','#7cc36b'][i%3]);stick.rotation.y=-.12+i*.08;}
    box(g,.74,.89,.03,.7,.05,.48,'#d1c5a9');
    for(let i=0;i<4;i++){const snack=box(g,.52+(i%2)*.28,.96+Math.floor(i/2)*.02,-.08+Math.floor(i/2)*.2,.23,.09,.17,['#ba8975','#ccac6a','#5aa9e6','#b39bba'][i]);snack.rotation.y=i*.07;}
    cyl(g,.75,.95,.37,.12,.12,.055,'#c59b62',10);
    for(const [x,zz,rotation]of [[-1.02,.4,.3],[1.01,-.41,-.2]])cup(g,x,.86,zz,{half:true,rotation});
    g.userData.chairCount=4;g.userData.halfDrunkCups=2;
    return {root:g,collider:{x:cx,z,w:2.65,d:1.35,blocksSight:false}};
  }
  function teachingCabinet(parent,x,z,{craft=false}={}){
    // The open shelves replace the plain drawer fronts, within the existing
    // cupboard footprint; room navigation and collision boxes stay unchanged.
    const g=group(parent,'research-teaching-cabinet',x,0,z);
    g.userData.contents=craft?'만들기 · 놀이':'수학 · 과학';
    box(g,0,1,-.285,2.3,2,.08,'#bd9b72');
    for(const side of [-1,1])box(g,side*1.1,1,0,.1,2,.65,'#d1a774');
    for(const y of [.08,.79,1.36,1.96])box(g,0,y,0,2.3,.08,.65,'#d1a774');
    box(g,0,1.38,0,.06,1.14,.6,'#d1a774');
    for(const side of [-1,1]){
      box(g,side*.55,.42,.29,1.04,.56,.055,craft?'#9fd0f5':'#e6c77d');
      box(g,side*.13,.44,.33,.035,.15,.025,'#8a929c');
    }
    panel(g,'teaching-cabinet-'+(craft?'craft':'science'),0,.42,.324,1.64,.16,(c,W,H)=>{
      c.fillStyle=craft?'#9fd0f5':'#e6c77d';c.fillRect(0,0,W,H);
      words(c,craft?'만들기 · 놀이 교구':'수학 · 과학 교구',W/2,H/2,30);
    },512,64);
    if(craft){
      // Labelled shallow tubs, coloured paper and a pencil pot make the
      // contents readable as teaching materials rather than office files.
      for(const [i,color]of ['#f2c14e','#6fb7e8','#a58fe0'].entries()){
        box(g,-.53,.89+i*.125,.02,.77,.1,.46,color);
        box(g,-.53,.89+i*.125,.258,.2,.043,.01,'#faf4df');
      }
      for(let i=0;i<6;i++)box(g,.51,.85+i*.039,.04,.81,.034,.47,['#faf4df','#f29a5c','#6fb7e8','#7cc36b'][i%4]);
      cyl(g,-.53,1.53,.04,.14,.12,.26,'#f2c14e',10);
      for(let i=0;i<5;i++){const pencil=box(g,-.62+i*.045,1.76,.045,.025,.42,.025,['#f29a5c','#6fb7e8','#a58fe0'][i%3]);pencil.rotation.z=(i-2)*.06;}
      for(let i=0;i<4;i++)box(g,.23+i*.17,1.62,.03,.13,.43,.4,['#f2c14e','#6fb7e8','#a58fe0','#f29a5c'][i]);
    }else{
      const globe=mesh(g,geo('SphereGeometry',.22,12,8),mat('#9fd0f5'),-.52,1.68,.04);globe.userData.teachingMaterial='globe';
      cyl(g,-.52,1.44,.04,.15,.15,.04,'#8a929c',10);
      const meridian=mesh(g,geo('TorusGeometry',.235,.012,3,18),mat('#d8b589'),-.52,1.68,.04);meridian.rotation.z=-.34;
      for(const [xx,yy,s]of [[.25,1.49,.2],[.54,1.49,.2],[.4,1.7,.18]])box(g,xx,yy,.02,s,s,.23,['#f2c14e','#7cc36b','#a58fe0'][Math.round(xx*10)%3]);
      for(let i=0;i<5;i++)box(g,-.85+i*.15,1.03,.03,.11,.39+(i%2)*.07,.4,['#6fb7e8','#f2c14e','#f29a5c'][i%3]);
      box(g,.54,1.04,.03,.73,.42,.44,'#7cc36b');
      panel(g,'math-materials-bin',.54,1.04,.256,.6,.15,(c,W,H)=>{c.fillStyle='#faf4df';c.fillRect(0,0,W,H);words(c,'수 모형',W/2,H/2,29);},256,64);
    }
    return g;
  }
  function broadcastPreview(c,W,H,{multiview=false}={}){
    c.fillStyle='#152737';c.fillRect(0,0,W,H);
    const views=multiview?[[18,45,W*.45,H*.56],[W*.52,45,W*.45,H*.56]]:[[18,45,W-36,H*.56]];
    views.forEach(([x,y,w,h],i)=>{
      c.fillStyle=i?'#dce3d5':'#c9e2ef';c.fillRect(x,y,w,h);
      c.fillStyle=i?'#91ab9b':'#b9cca2';c.fillRect(x,y+h*.57,w,h*.43);
      if(i){c.fillStyle='#3b6350';c.fillRect(x+w*.2,y+h*.15,w*.6,h*.32);}
      else {c.fillStyle='#e8decb';c.fillRect(x+w*.16,y+h*.22,w*.68,h*.52);c.fillStyle='#69879c';for(let j=0;j<5;j++)c.fillRect(x+w*(.21+j*.12),y+h*.34,w*.065,h*.17);}
      c.strokeStyle='#e9f4ec';c.lineWidth=2;c.strokeRect(x+6,y+6,w-12,h-12);
    });
    words(c,multiview?'CAM 01     ·     CAM 02':'교내 방송 · 송출 미리보기',W/2,24,20,'#ecf3f4');
    c.fillStyle='#ed7770';c.beginPath();c.arc(28,H-27,6,0,Math.PI*2);c.fill();
    c.textAlign='left';c.font='700 17px sans-serif';c.fillStyle='#edf5ef';c.fillText('LIVE',43,H-25);
    for(let i=0;i<13;i++){c.fillStyle=i>10?'#f0cb73':'#91cfad';c.fillRect(W*.49+i*12,H-40,7,25-i%3*4);}
  }
  function broadcastMonitor(parent,x,y,z,{multiview=false}={}){
    const g=group(parent,'broadcast-program-monitor',x,y,z);
    box(g,0,0,0,1.95,1.12,.12,'#2b2f36');
    const screen=panel(g,multiview?'broadcast-multiview':'broadcast-program',0,.015,.066,1.8,.94,(c,W,H)=>broadcastPreview(c,W,H,{multiview}),512,288);
    screen.material.emissive=new THREE.Color('#ffffff');screen.material.emissiveMap=screen.material.map;screen.material.emissiveIntensity=.25;
    box(g,.82,-.5,.071,.035,.015,.01,'#91cfad',{emissive:'#91cfad',emissiveIntensity:.35});
    return g;
  }
  function broadcastCamera(parent,x,z){
    const g=group(parent,'broadcast-tripod-camera',x,0,z);g.rotation.y=-.38;
    cyl(g,0,.84,0,.035,.04,1.25,'#8a929c',8);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3,foot=new THREE.Vector3(Math.cos(a)*.42,.09,Math.sin(a)*.42),top=new THREE.Vector3(0,1.11,0);
      const leg=mesh(g,geo('CylinderGeometry',.028,.038,top.distanceTo(foot),6),mat('#3a3f4a'),0,0,0);
      leg.position.copy(top).add(foot).multiplyScalar(.5);leg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),top.clone().sub(foot).normalize());
    }
    box(g,0,1.41,0,.4,.3,.62,'#3a3f4a');
    box(g,0,1.64,-.08,.31,.055,.36,'#2b2f36');box(g,0,1.56,-.22,.08,.2,.06,'#2b2f36');
    const lens=cyl(g,0,1.43,.39,.155,.155,.22,'#2b2f36',12);lens.rotation.x=Math.PI/2;
    const glass=cyl(g,0,1.43,.505,.124,.124,.012,'#557e98',12);glass.rotation.x=Math.PI/2;
    const shine=cyl(g,-.034,1.466,.514,.037,.037,.008,'#b7d7e4',8);shine.rotation.x=Math.PI/2;
    box(g,.31,1.45,-.1,.23,.22,.04,'#2b2f36');
    panel(g,'camera-flip-screen',.31,1.45,-.075,.19,.17,(c,W,H)=>{c.fillStyle='#9cc8d9';c.fillRect(0,0,W,H);c.fillStyle='#bdd0ac';c.fillRect(0,H*.55,W,H*.45);},128,128);
    box(g,-.14,1.51,.32,.055,.035,.018,'#ed7770',{emissive:'#ed7770',emissiveIntensity:.35});
    const handle=box(g,-.12,1.15,-.43,.03,.03,.45,'#2b2f36');handle.rotation.x=-.3;
    return g;
  }
  function broadcastEquipment(parent,cx){
    const g=group(parent,'broadcast-equipment');
    broadcastMonitor(g,cx-1.16,1.74,-6.28,{multiview:true});broadcastMonitor(g,cx+1.16,1.74,-6.28);
    const rack=group(g,'broadcast-equipment-rack',cx,0,-6.04);
    box(rack,0,.56,0,1.28,1.05,.57,'#3a3f4a');
    for(let i=0;i<3;i++){
      box(rack,0,.28+i*.28,.3,1.14,.22,.035,'#5d6470');
      for(let j=0;j<6;j++)box(rack,-.43+j*.1,.28+i*.28,.325,.045,.02,.012,'#91cfad',{emissive:'#91cfad',emissiveIntensity:.2});
      const dial=cyl(rack,.41,.28+i*.28,.34,.055,.055,.04,'#c7ccd4',8);dial.rotation.x=Math.PI/2;
    }
    broadcastCamera(g,cx+2.5,-1.2);
    // A gooseneck mic and headphones sit on the existing mixing desk.
    const mic=group(g,'broadcast-desk-microphone',cx-3.4,1.03,-3.25);
    cyl(mic,0,.02,0,.14,.14,.04,'#2b2f36',10);
    const stem=box(mic,0,.25,0,.025,.43,.025,'#8a929c');stem.rotation.z=-.2;
    const head=cyl(mic,.047,.48,0,.052,.052,.19,'#2b2f36',8);head.rotation.z=-.2;
    const headphones=group(g,'broadcast-headphones',cx-1.5,1.03,-3.25);
    const band=mesh(headphones,geo('TorusGeometry',.16,.028,4,12,Math.PI),mat('#3a3f4a'),0,.12,0);
    for(const side of [-1,1])box(headphones,side*.16,.07,0,.09,.16,.12,'#2b2f36');
    panel(g,'broadcast-audio-console',cx-2.5,1.12,-2.792,1.85,.11,(c,W,H)=>{c.fillStyle='#3a3f4a';c.fillRect(0,0,W,H);words(c,'MIC 1    MIC 2    BGM    MASTER',W/2,H/2,20,'#faf4df');},512,64);
    return g;
  }
  function childrenArt(parent,x,y,z){
    return panel(parent,'children-art',x,y,z,1.85,.94,(c,W,H)=>{
      c.fillStyle=palette.wood;c.fillRect(0,0,W,H);c.fillStyle='#fff3d6';c.fillRect(12,12,W-24,H-24);
      words(c,'우리 반 작은 미술관',W/2,31,23);
      for(let i=0;i<3;i++){
        const xx=24+i*160;c.fillStyle='#fff9e9';c.fillRect(xx,55,144,177);c.fillStyle=['#cfe9fb','#ffe9b0','#d6dbeb'][i];c.fillRect(xx+8,63,128,161);
        c.fillStyle='#ebc16f';c.beginPath();c.arc(xx+112,88,14,0,Math.PI*2);c.fill();
        c.fillStyle=['#93b188','#90ae8a','#a0b591'][i];c.beginPath();c.moveTo(xx+8,182);c.lineTo(xx+64,109);c.lineTo(xx+131,183);c.fill();
        c.fillStyle=['#bd8f79','#d8a76e','#af94ae'][i];c.fillRect(xx+34,161,50,44);
        c.fillStyle='#f2ddac';c.fillRect(xx+51,174,16,31);c.fillStyle='#7c6050';c.beginPath();c.moveTo(xx+25,163);c.lineTo(xx+59,136);c.lineTo(xx+94,163);c.fill();
      }
    });
  }
  function safetyPoster(parent,x,y,z){
    return panel(parent,'safety-poster',x,y,z,.62,.87,(c,W,H)=>{
      c.fillStyle='#fff8e6';c.fillRect(0,0,W,H);c.fillStyle='#e0703f';c.fillRect(0,0,W,78);words(c,'복도에서는',W/2,39,37,'#fff8e9');
      words(c,'천천히 걸어요',W/2,H-62,38);c.strokeStyle='#e0703f';c.lineWidth=17;c.lineCap='round';
      c.beginPath();c.arc(W/2,147,29,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(W/2,182);c.lineTo(W/2-7,280);c.lineTo(W/2-55,346);c.moveTo(W/2-7,280);c.lineTo(W/2+49,346);c.moveTo(W/2,212);c.lineTo(W/2-65,253);c.moveTo(W/2,212);c.lineTo(W/2+60,250);c.stroke();
    },384,512);
  }
  function face(parent,{speaker=false}={}){
    const f=group(parent,speaker?'speaker-expression':'copier-expression');moving.push(f);
    const eyes=[],brows=[];
    for(const side of [-1,1]){
      const white=mesh(f,geo('SphereGeometry',1,8,5),mat('#f6f1dd'),side*.14,.055,0,false);white.scale.set(.087,.105,.025);
      const pupil=mesh(f,geo('SphereGeometry',1,6,4),mat('#2c2826'),side*.14,.055,.026,false);pupil.scale.set(.036,.052,.018);eyes.push(pupil);
      const brow=box(f,side*.14,.192,.02,.15,.035,.025,'#3a3f4a');brows.push(brow);
    }
    const mouth=mesh(f,geo('TorusGeometry',.061,.012,3,12,speaker?Math.PI*2:Math.PI),mat('#3a3f4a'),0,-.14,.02,false);
    // A real smile/frown arc reads from the corridor; the speaker's ring
    // stretches into a small surprised O without needing any new game event.
    mouth.rotation.z=speaker?0:Math.PI;
    mouth.scale.y=speaker?.24:1;
    return {root:f,eyes,brows,mouth};
  }
  function copier(parent,x,z){
    const g=group(parent,'paper-jam-copier',x,0,z);
    box(g,0,.62,0,.98,1.1,.76,'#d9dde3');box(g,0,1.23,-.01,1.08,.15,.85,'#eef0f3');box(g,0,1.335,-.02,.89,.06,.68,'#5d6470');
    box(g,0,.21,.39,.83,.2,.035,'#c7ccd4');box(g,0,.44,.39,.83,.2,.035,'#cfd4da');
    for(const y of [.21,.44])box(g,0,y+.06,.416,.24,.027,.032,'#5d6470');
    box(g,.36,1.34,.31,.24,.06,.14,'#2b2f36');box(g,.36,1.375,.32,.17,.013,.09,'#9fd0f5',{emissive:'#6fa8dc',emissiveIntensity:.12});
    const f=face(g);f.root.position.set(0,.86,.397);
    const jamPaper=box(g,.52,.88,.1,.48,.025,.5,'#f6f1dd');jamPaper.rotation.z=-.12;moving.push(jamPaper);
    const led=box(g,.35,.65,.397,.065,.045,.024,'#d8ad6c');moving.push(led);
    panel(g,'copier-label',0,1.16,.434,.51,.11,(c,W,H)=>{c.fillStyle='#f4f1ea';c.fillRect(0,0,W,H);words(c,'복사 대기 중',W/2,H/2,25);},256,64);
    const item={root:g,face:f.root,eyes:f.eyes,brows:f.brows,mouth:f.mouth,jamPaper,led};copiers.push(item);return g;
  }
  function speaker(parent,x,y,z){
    const g=group(parent,'messenger-speaker',x,y,z);
    box(g,0,0,0,.68,.58,.2,'#f2a03d');box(g,0,0,.11,.58,.48,.04,'#fff1d6');
    const f=face(g,{speaker:true});f.root.position.z=.15;f.root.scale.set(.9,.9,1);
    box(g,0,-.36,-.03,.08,.18,.07,'#8a929c');
    panel(g,'messenger-speaker-label',0,.37,.13,.7,.15,(c,W,H)=>{c.fillStyle='#fff5de';c.fillRect(0,0,W,H);words(c,'퇴근톡 알림',W/2,H/2,31);},256,64);
    const item={root:g,face:f.root,eyes:f.eyes,brows:f.brows,mouth:f.mouth};speakers.push(item);return g;
  }
  function decorateRoom({parent,room,cx,centerZ=-2,width=8,depth=9,colliders,collide}){
    const backZ=centerZ-depth/2+.18,frontZ=centerZ+depth/2-.19;
    if(room.kind==='classroom'){
      panel(parent,'blackboard-today',cx,1.68,backZ+.08,6.1,1.02,(c,W,H)=>{
        c.fillStyle='#2f5a48';c.fillRect(0,0,W,H);words(c,'11월 ○일 · 오늘도 정시 퇴근',W/2,H*.36,49,'#f0ead8');
        words(c,'서로의 다름을 존중하는 우리 반',W/2,H*.75,31,'#ffe9b0');
      },1024,256);
      const lockers=group(parent,'classroom-back-lockers',cx,0,frontZ-.14);
      // Two side banks leave the central door and teacher approach open.
      for(const side of [-1,1])for(let col=0;col<2;col++)for(let row=0;row<2;row++){
        const x=side*(width/2-1.1+col*.52),y=.35+row*.61;
        box(lockers,x,y,0,.49,.56,.39,['#f6c445','#6fb7e8','#f29a5c','#a58fe0'][(row+col)%4]);
        box(lockers,x,y,.21,.43,.5,.025,'#fffaf0');box(lockers,x+.12,y+.04,.233,.027,.1,.025,'#5d6470');
      }
    }
    if(room.kind==='staff'){
      const table=researchTable(parent,cx,centerZ);if(colliders&&collide)collide(colliders,table.collider.x,table.collider.z,table.collider.w,table.collider.d,false);
      teachingCabinet(parent,cx-2.65,-5.95);teachingCabinet(parent,cx+2.65,-5.95,{craft:true});
      return table;
    }
    if(room.kind==='broadcast')broadcastEquipment(parent,cx);
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
      s.mouth.scale.set(surprised?.72:1,surprised?1.2:.24,1);
      s.face.rotation.z=surprised?Math.sin((Number(time)||0)*21)*.045:0;
    }
    const jam=manualJam??((Number(time)||0)%25>17);
    for(const c of copiers){
      c.root.userData.expression=jam?'paper-jam':'calm';c.jamPaper.visible=jam;
      c.brows[0].rotation.z=jam?-.33:0;c.brows[1].rotation.z=jam?.33:0;
      c.mouth.scale.y=jam?1.15:1;c.mouth.rotation.z=jam?0:Math.PI;
      c.led.material=mat(jam?'#c77b5a':'#7cc36b',{emissive:jam?'#a64429':'#5f956e',emissiveIntensity:.2});
    }
  }
  return {decorateRoom,decorateCorridor,notifyMessage,setCopierJam,update,moving,textures,speakers,copiers};
}
