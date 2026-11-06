import * as THREE from './vendor/three.module.js';

// The annex is a room to inhabit: ordinary windows, clear aisles and a lake
// beyond the garden. All coordinates are local to the first-floor interior.
export const NURSE_BED_LAYOUT = Object.freeze([
  {id:'bed-1',x:16.2,z:-3.65}, {id:'bed-2',x:20,z:-3.65}, {id:'bed-3',x:23.8,z:-3.65},
  {id:'bed-4',x:17.7,z:2.3}, {id:'bed-5',x:22.3,z:2.3}
]);
const UP = new THREE.Vector3(0,1,0);
function flowerGeometry(){
  const positions=[];
  for(let n=0;n<20;n++){const a=n*Math.PI/10,b=(n+1)*Math.PI/10;const r=t=>.11+.025*Math.cos(t*5);positions.push(0,.015,0,Math.cos(a)*r(a),0,Math.sin(a)*r(a),Math.cos(b)*r(b),0,Math.sin(b)*r(b));}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}

function roundedBox(width,height,depth,radius=.08){
  const g=new THREE.BoxGeometry(width,height,depth,3,2,3),p=g.attributes.position;
  const core=new THREE.Vector3(width/2-radius,height/2-radius,depth/2-radius);
  const v=new THREE.Vector3(),q=new THREE.Vector3();
  for(let n=0;n<p.count;n++){
    v.fromBufferAttribute(p,n);q.set(Math.max(-core.x,Math.min(core.x,v.x)),Math.max(-core.y,Math.min(core.y,v.y)),Math.max(-core.z,Math.min(core.z,v.z)));
    v.sub(q).normalize().multiplyScalar(radius).add(q);p.setXYZ(n,v.x,v.y,v.z);
  }
  g.computeVertexNormals();return g;
}
function leafGeometry(){
  const points=[],uvs=[];
  for(let n=0;n<5;n++){
    const a=n/5,b=(n+1)/5;
    for(const side of [-1,1]){
      const left=t=>[side*Math.sin(Math.PI*t)*.25,t,.12*Math.sin(Math.PI*t)];
      const middle=t=>[0,t,.17*Math.sin(Math.PI*t)];
      for(const p of [middle(a),left(a),left(b),middle(a),left(b),middle(b)]){points.push(...p);uvs.push(p[0]+.5,p[1]);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}

// A closed cloth surface: the middle rises over the legs, while all four
// side edges drape onto the mattress; the neck edge follows the waist.
// This is not a rigid box lifted into the air.
function quiltGeometry(occupied=false){
  const nx=8,nz=12,w=1.84,d=2.0,positions=[],uvs=[];
  const point=(ix,iz)=>{
    const x=(ix/nx-.5)*w,z=(iz/nz-.5)*d;
    const across=Math.pow(Math.max(0,Math.cos((x/(w/2))*Math.PI/2)),.65);
    const t=iz/nz;
    const along=t<.65?.92+.08*Math.sin(t/.65*Math.PI):Math.pow(Math.max(0,Math.cos((t-.65)/.35*Math.PI/2)),.75);
    const y=.025+(occupied?.445:.016)*across*along+Math.sin(ix*1.7+iz*.8)*.006*across;
    return [x,y,z];
  };
  const tri=(a,b,c)=>{for(const v of [a,b,c]){positions.push(...v);uvs.push(v[0]/w+.5,v[2]/d+.5);}};
  for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
    const a=point(ix,iz),b=point(ix+1,iz),c=point(ix+1,iz+1),e=point(ix,iz+1);tri(a,e,b);tri(b,e,c);
  }
  const edge=(a,b)=>{const c=[b[0],-.07,b[2]],d=[a[0],-.07,a[2]];tri(a,b,c);tri(a,c,d);};
  for(let n=0;n<nx;n++){edge(point(n,0),point(n+1,0));edge(point(n+1,nz),point(n,nz));}
  for(let n=0;n<nz;n++){edge(point(0,n+1),point(0,n));edge(point(nx,n),point(nx,n+1));}
  tri([-w/2,-.07,-d/2],[w/2,-.07,-d/2],[-w/2,-.07,d/2]);tri([w/2,-.07,-d/2],[w/2,-.07,d/2],[-w/2,-.07,d/2]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}

export function createNurseRoom({inside,colliders,beds,interactables,helpers,cx=20}){
  const {box,cyl,ball,mesh,geo,mat,sign,badge,collide}=helpers;
  const room=new THREE.Group();room.name='lake-infirmary';inside.add(room);
  const architecture=new THREE.Group();architecture.name='infirmary-cutaway-shell';room.add(architecture);
  let cameraMode='third',backdropEnabled=false;
  const cameraColliders=[],windows=[],moving=[],sleepers=new Map(),duvets=new Map(),bedMarkers=new Map();
  const shapes={mattress:roundedBox(1.86,.23,3.35,.095),pillow:roundedBox(1.28,.22,.66,.1),duvet:quiltGeometry(false),sleepingDuvet:quiltGeometry(true),fold:roundedBox(1.84,.055,.22,.025),leaf:leafGeometry(),flower:flowerGeometry()};
  function soft(parent,geometry,x,y,z,color){return mesh(parent,geometry,mat(color,{roughness:.98}),x,y,z);}
  function solid(x,y,z,w,h,d,color,blocksSight=true){
    const obj=box(room,x,y,z,w,h,d,color);collide(colliders,x,z,w,d,blocksSight);
    cameraColliders.push({x,z,w,d,minY:y-h/2,maxY:y+h/2});return obj;
  }
  function wall(...args){const object=solid(...args);architecture.add(object);return object;}
  function stem(parent,a,b,r,color='#5c7d48'){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.sub(start);
    const object=cyl(parent,...start.clone().addScaledVector(delta,.5).toArray(),r,r,delta.length(),color,5);
    object.quaternion.setFromUnitVectors(UP,delta.normalize());return object;
  }
  function plant(x,z,size=1,flower=false,potColor='#b77f62'){
    const g=new THREE.Group();g.name=flower?'indoor-flower-pot':'indoor-leaf-plant';g.position.set(x,0,z);room.add(g);
    cyl(g,0,.22*size,0,.25*size,.18*size,.44*size,potColor,10);
    cyl(g,0,.44*size,0,.27*size,.27*size,.065*size,potColor,10);
    cyl(g,0,.477*size,0,.225*size,.225*size,.015*size,'#5b5143',10);
    for(let i=0;i<(flower?6:10);i++){
      const angle=i*2.39996,ht=(flower?.52:.7)+(i%3)*.14;
      const tip=[Math.cos(angle)*.26*size,ht*size+size*.45,Math.sin(angle)*.26*size];
      stem(g,[0,.46*size,0],tip,.012*size);
      const leaf=mesh(g,shapes.leaf,mat(i%3?'#557d4b':'#7a995c',{side:THREE.DoubleSide}),...tip);
      leaf.scale.set(size*(flower?.48:.9),size*(flower?.34:.7),size);leaf.rotation.set(.65+((i%2)*.32),angle,-.6+(i%3)*.6);
      if(flower){
        const colors=['#f5e2c7','#d7a1a4','#e9c15f'];
        const [tx,ty,tz]=tip;
        const blossom=mesh(g,shapes.flower,mat(colors[i%3],{side:THREE.DoubleSide}),tx,ty+.035*size,tz);blossom.scale.setScalar(size);
        const center=mesh(g,geo('IcosahedronGeometry',.027,0),mat('#b48b35'),tx,ty+.05*size,tz);center.scale.setScalar(size);
      }
    }
    return g;
  }

  // Warm vinyl floor, painted plaster, a real suspended ceiling and skirting.
  box(room,cx,.035,0,11.8,.10,15.5,'#ded9cc');
  for(let n=0;n<22;n++)box(room,14.25+n*.535,.092,0,.51,.012,15.35,n%3===0?'#e1ddd2':'#e7e3d9');
  box(architecture,cx,3.08,0,12,.16,15.6,'#eeeee8');
  cameraColliders.push({x:cx,z:0,w:12,d:15.6,minY:3,maxY:3.16});
  for(const z of [-6,-2,2,6]){
    box(architecture,cx,2.985,z,1.05,.025,1.55,'#fffdf0',{emissive:'#fff9e6',emissiveIntensity:.32});
    for(const x of [17,23])box(architecture,x,2.985,z,.55,.022,1.2,'#f9f8ed');
  }
  wall(25.92,1.5,0,.22,3,15.7,'#e8e7dc');
  wall(cx,1.5,7.86,12,3,.22,'#ece9df');
  wall(14.08,1.5,-2.4,.22,3,10.8,'#ece9df');
  wall(14.08,1.5,7.1,.22,3,1.4,'#ece9df');
  box(architecture,14.08,2.7,4.7,.22,.6,3.4,'#ece9df');
  cameraColliders.push({x:14.08,z:4.7,w:.22,d:3.4,minY:2.4,maxY:3});
  for(const x of [14.22,25.78]){
    if(x<20){box(room,x,.6,-2.4,.035,1.05,10.8,'#bdcfc0');box(room,x,.6,7.1,.035,1.05,1.4,'#bdcfc0');}
    else box(room,x,.6,0,.035,1.05,15.6,'#bdcfc0');
  }
  box(room,cx,.6,7.72,11.7,1.05,.04,'#bdcfc0');
  for(const x of [14.24,25.76])box(room,x,.15,0,.035,.15,15.4,'#9ea89a');
  box(room,cx,.15,7.7,11.6,.15,.035,'#9ea89a');

  // Three classroom-scale openings: sill1.04m, top2.6m, with proper wall piers.
  wall(cx,.52,-7.74,12,1.04,.23,'#e9e7dc');
  wall(cx,2.8,-7.74,12,.4,.23,'#e9e7dc');
  for(const [x,w] of [[14.45,.9],[18.1,.6],[21.9,.6],[25.55,.9]])wall(x,1.82,-7.74,w,1.56,.23,'#e9e7dc');
  // The room boundary remains impassable at window height for gameplay.
  collide(colliders,cx,-7.9,12,.25);
  for(const x of [16.2,20,23.8]){
    windows.push({x,y:1.82,z:-7.72,width:3.05,height:1.56,sill:1.04,top:2.6});
    for(const xx of [x-1.55,x,x+1.55])box(architecture,xx,1.82,-7.63,.045,1.62,.1,'#e2e2d7');
    for(const y of [1.04,1.82,2.60])box(architecture,x,y,-7.61,3.14,.05,.1,'#e2e2d7');
    box(architecture,x,1,-7.47,3.32,.10,.44,'#c4c5b8');
    // No opaque glass billboard: a tiny tint preserves lake visibility.
    const pane=box(architecture,x,1.82,-7.65,3.04,1.52,.008,'#cee2df',{transparent:true,opacity:.055,depthWrite:false});pane.castShadow=false;pane.name='infirmary-window';pane.userData.window=windows[windows.length-1];
    cyl(architecture,x,2.78,-7.36,.026,.026,3.4,'#b5b4a7',8).rotation.z=Math.PI/2;
    for(const side of [-1,1])for(let fold=0;fold<4;fold++){
      const curtain=box(architecture,x+side*(1.39-fold*.065),1.85,-7.35+((fold%2)*.04),.095,1.75,.05,fold%2?'#d8dfd0':'#e5e9db');curtain.name='linen-window-curtain';
    }
  }
  sign(architecture,'보건실',14.24,2.1,6.75,1.8,.45,'#476459','#f4f1e7').rotation.y=Math.PI/2;
  sign(architecture,'오늘은 천천히',cx,2.83,-7.59,2.8,.22,'#6b8171','#e9e7dc');

  // Beds sit in two rows with 1.9m side aisles and a broad cross aisle.
  const palette=['#a9bfa9','#9ebac3','#c6afb2','#b4adc8','#d2c4a0'];
  for(const [index,layout] of NURSE_BED_LAYOUT.entries()){
    const {id,x,z}=layout;
    box(room,x,.53,z,1.91,.25,3.4,'#b5c2b7');
    soft(room,shapes.mattress,x,.77,z,'#f3f1e8');
    soft(room,shapes.pillow,x,.98,z-1.15,'#fffaf0');
    for(const dx of [-.78,.78])for(const dz of [-1.38,1.38]){
      cyl(room,x+dx,.28,z+dz,.047,.047,.52,'#9da99c',8);
      cyl(room,x+dx,.09,z+dz,.08,.08,.12,'#737e74',8).rotation.z=Math.PI/2;
    }
    box(room,x,.91,z-1.73,1.94,.86,.1,'#a1b8ab');
    box(room,x,1.3,z-1.73,1.94,.055,.12,'#d3dbce');
    box(room,x,.61,z+1.73,1.94,.4,.08,'#a1b8ab');
    const duvet=new THREE.Group();duvet.name=`rest-duvet-${index+1}`;duvet.position.set(x,.94,z+.65);room.add(duvet);moving.push(duvet);
    const cloth=soft(duvet,shapes.duvet,0,0,0,palette[index]);cloth.name='draped-blanket';
    const fold=soft(duvet,shapes.fold,0,.035,-.87,'#e2e8d9');duvet.userData.fold=fold;duvet.userData.cloth=cloth;duvets.set(id,duvet);
    collide(colliders,x,z,1.96,3.6,false);
    cameraColliders.push({x,z,w:1.96,d:3.6,minY:0,maxY:1.03});
    const exitPoint={x,y:0,z:z+2.25};
    const side=x<=20?-1:1, cameraOffset=z<0&&x!==20?1.6:2.2;
    const bed={id,kind:'bed',floor:1,x,y:0,z:exitPoint.z,label:`보건실 침대 ${index+1} · 잠깐 멍때리기`,
      center:{x,z},mattress:{width:1.86,depth:3.35,top:.885},
      bedPose:{x,y:1.07,z:z+.62,rotationX:-Math.PI/2,yaw:0},exitPoint,
      approachPath:z<0?[{x:20,z:5.35},{x:20,z:-.1},{x,z:-.1},exitPoint]:[{x:20,z:5.35},{x,z:5.35},exitPoint],
      cameraPose:{position:{x:x+side*cameraOffset,y:2.3,z:z+2.3},target:{x:x-side*.08,y:1.30,z:z-.8}},
      blanketColor:palette[index]};
    beds.set(id,bed);interactables.push(bed);
    const marker=badge(room,String(index+1),x,.62,z+1.85,palette[index],.36);marker.name=`rest-bed-marker-${index+1}`;marker.material.depthTest=true;marker.material.depthWrite=false;bedMarkers.set(id,marker);
  }

  // Nurse's working corner keeps the space recognisably a school infirmary.
  solid(15.25,.8,6.9,1.7,1.6,.62,'#e2dfd1',false);
  box(room,15.25,1.64,6.9,1.8,.09,.72,'#bfae8c');
  for(const x of [14.9,15.6]){box(room,x,1.02,6.56,.55,.62,.025,'#edeadf');box(room,x,1.04,6.53,.18,.025,.03,'#829185');}
  cyl(room,15.8,1.83,6.9,.12,.12,.28,'#f9f6e9',10);
  box(room,15.4,1.72,6.85,.4,.08,.28,'#dbd4ba');
  solid(24.7,1.1,6.85,1.65,2.2,.65,'#dbe1d5');
  for(const y of [.5,1.1,1.7]){box(room,24.7,y,6.5,1.5,.045,.025,'#b9c8b7');box(room,24.7,y+.13,6.48,.11,.08,.02,'#85978b');}
  sign(architecture,'구급함',24.7,2.33,7.68,1.2,.34,'#688676','#ece9df').rotation.y=Math.PI;
  box(architecture,24.7,2.74,7.68,.13,.36,.03,'#b37566');box(architecture,24.7,2.74,7.67,.36,.13,.04,'#b37566');
  // A quiet bench and tissue box, rather than a huge wall of glass.
  box(room,25.15,.47,3.6,.85,.13,1.6,'#c8bb9e');box(room,25.53,.9,3.6,.1,.8,1.6,'#c8bb9e');
  for(const z of [3.05,4.15])box(room,25.15,.25,z,.65,.5,.075,'#95a58f');
  collide(colliders,25.15,3.6,1,1.6,false);
  sign(architecture,'잠깐 쉬어도 괜찮아요',cx,2.5,7.72,4.9,.48,'#5f7864','#ece9df').rotation.y=Math.PI;
  sign(architecture,'물 한 잔 · 깊은 숨 한 번',cx,1.98,7.71,3.6,.28,'#81917b','#ece9df').rotation.y=Math.PI;

  // Varied living plants: low flowers by beds, taller leaves at room corners.
  plant(14.8,-6.7,1.18,false,'#c9b291');plant(25.1,-6.7,1.3,false,'#d4d0bd');
  plant(18.15,-6.9,.7,true,'#d8c5a8');plant(21.85,-6.9,.76,true,'#b99887');
  plant(14.8,-.3,1.2,false,'#c7c4af');plant(25.1,-.15,.95,true,'#ba8b75');
  plant(21.2,6.9,1.15,false,'#c9b291');
  for(const [x,z] of [[18.2,-3.7],[21.8,-3.7],[20,2.25]]){
    box(room,x,.46,z,.58,.08,.58,'#bfab8d');for(const dx of [-.21,.21])box(room,x+dx,.24,z,.055,.48,.45,'#a99980');
    const p=plant(x,z,.48,true,'#ede3cd');p.position.y=.5;
  }

  // Actual near shoreline and water give parallax; the photograph sits far away.
  const landscape=new THREE.Group();landscape.name='infirmary-lake-view';landscape.visible=false;room.add(landscape);
  box(landscape,cx,-.08,-9.8,30,.12,4.2,'#9eaf89');
  box(landscape,cx,-.22,-24,48,.12,28,'#729c9d',{roughness:.29,metalness:.08});
  for(let n=0;n<16;n++)box(landscape,6+(n%5)*6.3,-.14,-13-Math.floor(n/5)*5,3.2+(n%3),.012,.055,n%2?'#a1bbb0':'#8badac');
  for(const [x,z,s] of [[10,-10,1.1],[29,-12,1.2],[31,-15,.9],[9,-18,.8]]){
    cyl(landscape,x,s,z,.13*s,.2*s,2*s,'#8e8267',8);
    ball(landscape,x,s*2.5,z,.95*s,'#7d9d78',[1,1.4,1]);ball(landscape,x+.5*s,s*2.7,z,.7*s,'#9cb28b');
  }
  for(let n=0;n<17;n++){
    const x=7+n*1.6,z=-10.7+(n%3)*.18;
    if(x>14.7&&x<25.3)continue;
    stem(landscape,[x,-.1,z],[x+.1,.65+(n%3)*.13,z],.025,'#81956e');
  }
  // Tests and software-only hosts may have no HTML image loader; the real 3D
  // shore remains a complete fallback rather than a missing-image wall.
  if(typeof Image!=='undefined'){
    const texture=new THREE.TextureLoader().load(new URL('./assets/environment/lake-view.webp',import.meta.url).href);
    texture.colorSpace=THREE.SRGBColorSpace;
    const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(60,40),new THREE.MeshBasicMaterial({map:texture,color:'#e9f0e3',fog:true}));
    backdrop.name='lake-panorama';backdrop.position.set(cx,4,-39);landscape.add(backdrop);
  }
  // Fallback distant hills also hide the water-plane edges in oblique views.
  for(const [x,z,s] of [[-8,-45,15],[14,-50,18],[40,-47,16],[58,-52,15]])ball(landscape,x,-4,z,s,'#a4b5a3',[1.5,.53,.6]);

  function snapshot(model){
    const refs=new Set([model.userData.body,model.userData.head,...(model.userData.arms||[]),...(model.userData.forearms||[]),...(model.userData.legs||[]),...(model.userData.shins||[]),...(model.userData.footwear||[])].filter(Boolean));
    return [...refs].map(node=>({node,rotation:node.rotation.clone(),scale:node.scale.clone(),position:node.position.clone(),visible:node.visible}));
  }
  function restore(record){for(const saved of record?.original||[]){saved.node.rotation.copy(saved.rotation);saved.node.scale.copy(saved.scale);saved.node.position.copy(saved.position);saved.node.visible=saved.visible;}}
  function clearRestPose(model){
    if(!model)return;
    const record=sleepers.get(model);if(!record&&!model.userData.restingBed)return;restore(record);sleepers.delete(model);
    model.rotation.set(0,0,0);delete model.userData.restingBed;delete model.userData.restPosture;
    refreshDuvets();
  }
  function refreshDuvets(){
    for(const [id,duvet] of duvets){const occupied=[...sleepers.values()].some(record=>record.id===id);duvet.userData.cloth.geometry=occupied?shapes.sleepingDuvet:shapes.duvet;duvet.position.y=.94;duvet.scale.y=1;duvet.userData.fold.visible=!occupied;bedMarkers.get(id).visible=!occupied;}
  }
  function setRestPose(model,id,posture='back'){
    const bed=beds.get(id);if(!model||!bed)return false;
    const side=posture==='side',previous=sleepers.get(model);
    if(previous?.id===id&&previous?.posture===posture&&previous.body===model.userData.body){model.visible=true;return true;}
    if(previous)restore(previous);
    // Walking angles are transient. Capture neutral rig angles so standing up
    // never leaves an elbow, knee or breathing scale stuck in the sleeping pose.
    for(const saved of model.userData.restJointDefaults||[]){saved.joint.rotation.copy(saved.rotation);saved.joint.position.copy(saved.position);}
    for(const part of [...(model.userData.arms||[]),...(model.userData.forearms||[]),...(model.userData.legs||[]),...(model.userData.shins||[])]){
      part.rotation.x=0;part.rotation.y=0;
      if((model.userData.forearms||[]).includes(part)||(model.userData.shins||[]).includes(part))part.rotation.z=0;
    }
    const original=snapshot(model),p=bed.bedPose;
    const facing=bed.cameraPose.position.x>p.x?1:-1;
    model.position.set(p.x,side?1.15:p.y,p.z);model.rotation.set(-Math.PI/2,side?facing*Math.PI/2:0,0);model.visible=true;
    (model.userData.arms||[]).forEach((arm,n)=>{
      const upper=(facing===1?n===0:n===1);
      arm.rotation.x=side?-.10:-.035;
      arm.rotation.z=side?(upper?facing*.42:-facing*.08):(n?-.06:.06);
      if(side&&!upper)arm.position.x=facing*.22;
    });
    (model.userData.forearms||[]).forEach((arm,n)=>{const upper=(facing===1?n===0:n===1);arm.rotation.x=side?(upper?-.42:-.18):-.16;});
    (model.userData.legs||[]).forEach((leg,n)=>{leg.rotation.x=side?-.20:-.035;if(side)leg.position.x=(n?1:-1)*.08;});
    (model.userData.shins||[]).forEach(shin=>{shin.rotation.x=side?.34:.06;});
    // Slip shoes off before lying on clean bedding; they return on standing.
    for(const shoe of model.userData.footwear||[])shoe.visible=false;
    if(model.userData.head){
      model.userData.head.rotation.y=side?facing*.05:.06;model.userData.head.rotation.z=side?-facing*.04:.02;
      if(side)model.userData.head.position.x=-facing*.20;else model.userData.head.position.z=.20;
    }
    model.userData.restingBed=id;model.userData.restPosture=side?'side':'back';
    sleepers.set(model,{id,posture:side?'side':'back',body:model.userData.body,original,phase:Number(id.slice(-1))*.7});refreshDuvets();return true;
  }
  function updateResting(dt,time=0){
    let changed=false;
    for(const [model,record] of sleepers){
      if(!model.parent||!model.visible||model.userData.restingBed!==record.id){restore(record);sleepers.delete(model);delete model.userData.restingBed;delete model.userData.restPosture;changed=true;continue;}
      const body=record.body,base=record.original.find(item=>item.node===body);
      if(body&&base)body.scale.z=base.scale.z*(1+Math.sin(time*1.45+record.phase)*.008);
    }
    if(changed)refreshDuvets();
  }
  function setCameraMode(mode){cameraMode=mode;architecture.visible=mode!=='overview';landscape.visible=backdropEnabled&&mode!=='overview';}
  function setBackdropVisible(value){backdropEnabled=!!value;landscape.visible=backdropEnabled&&cameraMode!=='overview';}
  return {root:room,cameraColliders,windows,moving,beds,cutawayGroups:[architecture],backdropGroup:landscape,setCameraMode,setBackdropVisible,setRestPose,clearRestPose,updateResting};
}
