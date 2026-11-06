import * as THREE from '../vendor/three.module.js';
import {SoftwareRenderer} from '../software-renderer.js?v=20261106-immersive1';
import {wantsSoftwareRenderer} from '../visual-test.js?v=20261106-cute1';

const BOUNDS={minX:-6.3,maxX:6.3,minZ:-2.25,maxZ:4.8};
const SHELF={x:0,z:-3.25},BIN={x:5.65,z:-2.8};
const SPAWNS=[[-4.8,0.1],[-1.7,1],[1.8,0.3],[4.7,1.6],[-4.5,3.2],[-1.6,3.8],[1.6,3.5],[4.4,4.1]];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/** Rules are independent of rendering: failed insertions always return the book. */
export function createLibraryState(books,order){
  if(!Array.isArray(books)||books.length!==8||!Array.isArray(order)||order.length!==7||new Set(books.map(b=>b.id)).size!==8||new Set(order).size!==7||books.filter(b=>b.trap).length!==1||order.some(id=>!books.some(b=>b.id===id&&!b.trap)))throw new Error('Library requires seven ordered books and one trap.');
  return {books:books.map(b=>({...b})),order:[...order],placed:[],returned:[],holding:null,complete:false};
}
export function resolveLibraryAction(state,action,id){
  if(state.complete)return {state,event:'ignored'};
  const next={...state,placed:[...state.placed],returned:[...state.returned]};
  let event='ignored';
  if(action==='pickup'&&!state.holding&&state.books.some(b=>b.id===id)&&!state.placed.includes(id)&&!state.returned.includes(id)){next.holding=id;event='picked';}
  else if(action==='drop'&&state.holding){next.holding=null;event='dropped';}
  else if(action==='shelve'&&state.holding){
    const held=state.books.find(b=>b.id===state.holding);
    next.holding=null;
    if(!held.trap&&state.order[state.placed.length]===held.id){next.placed.push(held.id);event='shelved';}
    else event='ejected';
  }else if(action==='return'&&state.holding){
    const held=state.books.find(b=>b.id===state.holding);next.holding=null;
    if(held.trap){next.returned.push(held.id);event='returned';}else event='ejected';
  }
  next.complete=next.placed.length===state.order.length&&next.returned.length===state.books.filter(b=>b.trap).length;
  return {state:next,event};
}

export function start({container,data,onWin=()=>{},onFail=()=>{}}){
  const config=data.arcade;
  let state=createLibraryState(config?.books,config?.order);
  const duration=config.duration||90;
  const root=document.createElement('section');root.className='m04-room';root.setAttribute('aria-label',config.title||'제작 순서 책 꽂기');
  root.innerHTML=`<style>
  .m04-room{position:relative;width:100%;height:100%;min-height:360px;overflow:hidden;background:#efe6cf;color:#264c43;touch-action:none;isolation:isolate}.m04-room canvas{display:block;width:100%;height:100%;touch-action:none}.m04-room button{font:inherit;cursor:pointer}.m04-room .m04-top{position:absolute;left:5%;right:5%;top:18px;display:flex;justify-content:space-between;gap:12px;pointer-events:none;font-size:clamp(18px,2vw,24px);font-weight:900;text-shadow:0 2px 5px #fff}.m04-room .m04-progress{letter-spacing:0}.m04-room .m04-time{font-variant-numeric:tabular-nums}.m04-room .m04-object{position:absolute;transform:translate(-50%,-50%);border:1px solid #60785d;background:#fffcf0ed;color:#274f43;border-radius:9px;padding:6px 8px;max-width:160px;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;line-height:1.25;font-size:clamp(16px,1.35vw,20px);font-weight:800;box-shadow:0 3px 7px #324b3821}.m04-room .m04-object.is-next{border:3px solid #e0a92a;background:#fff2a5}.m04-room .m04-object:focus-visible,.m04-room button:focus-visible{outline:4px solid #db7955;outline-offset:3px}.m04-room .m04-object[hidden],.m04-room .m04-retry[hidden]{display:none}.m04-room .m04-feedback{position:absolute;top:34%;left:50%;transform:translate(-50%,-50%);font-size:clamp(16px,2.4vw,28px);font-weight:900;text-align:center;text-shadow:0 1px 8px #fff,0 0 15px #fff;pointer-events:none;white-space:nowrap}.m04-room .m04-feedback strong{display:block;font-size:48px}.m04-room .m04-bottom{position:absolute;bottom:17px;left:16px;right:16px;text-align:center;font-size:clamp(16px,1.4vw,18px);font-weight:800;text-shadow:0 1px 6px white;pointer-events:none}.m04-room .m04-pad{position:absolute;left:18px;bottom:54px;display:grid;grid-template-columns:repeat(3,43px);grid-template-rows:repeat(2,43px);gap:5px}.m04-room .m04-key{border:2px solid #68856a;border-radius:12px;background:#fffdf0e8;font-size:24px;color:#315947;touch-action:none;user-select:none}.m04-room .m04-key[data-dir=up]{grid-column:2}.m04-room .m04-key[data-dir=left]{grid-row:2;grid-column:1}.m04-room .m04-key[data-dir=down]{grid-row:2;grid-column:2}.m04-room .m04-key[data-dir=right]{grid-row:2;grid-column:3}.m04-room .m04-act{position:absolute;right:22px;bottom:67px;min-width:150px;max-width:42%;padding:15px 18px;background:#285345;color:#fff9e8;border:2px solid #e3c983;border-radius:18px;font-weight:900;font-size:clamp(16px,1.5vw,20px);box-shadow:0 4px 0 #173d31}.m04-room .m04-retry{position:absolute;left:50%;top:58%;transform:translateX(-50%);padding:15px 25px;border:0;border-radius:99px;background:#285345;color:white;font-weight:800;font-size:20px}.m04-room .m04-held{position:absolute;left:50%;top:64px;transform:translateX(-50%);font-weight:800;background:#fff9dfdc;border-radius:99px;padding:9px 16px;font-size:18px;white-space:normal;max-width:90%;width:max-content;text-align:center;line-height:1.4}.m04-room.m04-shake{animation:m04-shake .25s linear}@keyframes m04-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}@media(max-width:600px){.m04-room .m04-object{padding:7px 6px;font-size:16px;max-width:108px;min-width:72px}.m04-room .m04-held{top:60px;font-size:17px}.m04-room .m04-bottom{font-size:16px;bottom:10px;line-height:1.35}.m04-room .m04-top{left:12px;right:12px;font-size:17px}.m04-room .m04-pad{grid-template-columns:repeat(3,40px);grid-template-rows:repeat(2,40px)}.m04-room .m04-act{right:12px;min-width:120px;padding:12px}.m04-room .m04-feedback{top:31%}}@media(prefers-reduced-motion:reduce){.m04-room.m04-shake{animation:none}}
  </style><canvas tabindex="0" aria-label="도서관을 걸어 책을 주워 책장에 순서대로 꽂으세요"></canvas><div class="m04-top"><span class="m04-progress"></span><span class="m04-time"></span></div><div class="m04-held" aria-live="polite"></div><div class="m04-feedback" role="status" aria-live="polite"></div><div class="m04-pad" aria-label="도서관 이동"><button class="m04-key" data-dir="up" aria-label="앞으로 이동">↑</button><button class="m04-key" data-dir="left" aria-label="왼쪽으로 이동">←</button><button class="m04-key" data-dir="down" aria-label="뒤로 이동">↓</button><button class="m04-key" data-dir="right" aria-label="오른쪽으로 이동">→</button></div><button class="m04-act">E · 가까이 가기</button><div class="m04-bottom">⌨ 이동 WASD · E 줍기/꽂기 · 책을 눌러 이동</div><button class="m04-retry" hidden>↻ 다시 정리하기</button>`;
  container.append(root);
  const canvas=root.querySelector('canvas'),progress=root.querySelector('.m04-progress'),clock=root.querySelector('.m04-time'),held=root.querySelector('.m04-held'),feedback=root.querySelector('.m04-feedback'),actionButton=root.querySelector('.m04-act'),retry=root.querySelector('.m04-retry');
  const cleanups=[],textures=new Set(),materials=new Set(),geometries=new Set(),keys=new Set(),directions=new Map();
  let destroyed=false,paused=false,won=false,timedOut=false,elapsed=0,sceneTime=0,last=performance.now(),raf=0,width=1,height=1,target=null,tipLeft=0,hintLeft=0;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eee7d3');const camera=new THREE.PerspectiveCamera(47,1,.1,100);
  scene.add(new THREE.HemisphereLight('#fff5dd','#718d74',3));const light=new THREE.DirectionalLight('#ffe8be',2.4);light.position.set(-5,12,7);scene.add(light);
  let renderer;try{renderer=wantsSoftwareRenderer()?new SoftwareRenderer({canvas}):new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});}catch{renderer=new SoftwareRenderer({canvas});}
  canvas.dataset.renderer=renderer.isSoftware?'software':'webgl';
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(renderer.isSoftware ? .8 : Math.min(globalThis.devicePixelRatio||1,1.5));
  function mat(color,basic=false,options={}){const m=basic?new THREE.MeshBasicMaterial({color,...options}):new THREE.MeshStandardMaterial({color,roughness:.9,...options});materials.add(m);return m;}
  function mesh(g,m,parent=scene,pos=[0,0,0]){geometries.add(g);const o=new THREE.Mesh(g,m);o.position.set(...pos);parent.add(o);return o;}
  function box(x,y,z,w,h,d,color,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),mat(color),parent,[x,y,z]);}
  function ball(x,y,z,r,color,parent=scene){return mesh(new THREE.IcosahedronGeometry(r,1),mat(color),parent,[x,y,z]);}
  function texture(label,icon,bg){const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,512);ctx.strokeStyle='#fff6de';ctx.lineWidth=10;ctx.strokeRect(20,20,472,472);ctx.fillStyle='#234c43';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 110px sans-serif';ctx.fillText(icon||'▤',256,155);ctx.font='900 52px sans-serif';const words=String(label).split(' ');if(words.length>1){ctx.fillText(words.slice(0,Math.ceil(words.length/2)).join(' '),256,295,450);ctx.fillText(words.slice(Math.ceil(words.length/2)).join(' '),256,367,450);}else ctx.fillText(label,256,330,450);const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;textures.add(tx);return tx;}
  // All decoration sits outside the walkable rectangular floor.
  box(0,-.15,0,15,.3,12,'#d5bd94');box(0,2.4,-5.9,15,4.8,.25,'#eee1c4');
  for(let x=-7;x<8;x+=1.5)box(x,.01,0,.025,.02,11.7,'#c4ac83');
  for(const x of [-7.2,7.2]){box(x,1.5,-.5,.2,3,10.8,'#d8c9a9');for(const z of [-3.7,-.8,2.2]){box(x*.96,1.3,z,.35,2.6,2.35,'#a17c52');for(let j=0;j<5;j++)box(x*.93,.8+j*.3,z-.75+(j%3)*.55,.4,.24,.45,['#82a593','#d39c6f','#d4c46d'][j%3]);}}
  box(0,1.4,-4.1,8.7,2.8,.4,'#947148');for(const y of [.35,1.4,2.55])box(0,y,-3.68,9,.15,1.1,'#b7905d');for(const x of [-4.45,4.45])box(x,1.4,-3.75,.18,2.8,1.1,'#b7905d');
  const slotMaterials=[];for(let i=0;i<7;i++){const m=mat('#e1d7bb',true);slotMaterials.push(m);mesh(new THREE.BoxGeometry(.9,.03,.75),m,scene,[-3.45+i*1.15,.45,-3.65]);}
  box(BIN.x,.5,BIN.z,1.4,1,1.3,'#6f958a');box(BIN.x,1.05,BIN.z,1.6,.15,1.45,'#315f51');box(BIN.x,1.14,BIN.z,.95,.06,.7,'#193e35');
  const avatar=new THREE.Group();avatar.name="m04-player";scene.add(avatar);const legs=[],arms=[];
  for(const s of [-1,1]){const leg=new THREE.Group();leg.position.set(s*.16,.65,0);avatar.add(leg);box(0,-.25,0,.23,.5,.28,'#4c5b50',leg);box(0,-.54,.07,.27,.14,.36,'#34443b',leg);legs.push(leg);const arm=new THREE.Group();arm.position.set(s*.4,1.25,0);avatar.add(arm);box(0,-.22,0,.19,.45,.25,'#537e64',arm);ball(0,-.49,0,.12,'#e3b08d',arm);arms.push(arm);}
  box(0,1,0,.62,.7,.4,'#537e64',avatar);ball(0,1.73,0,.36,'#e3b08d',avatar);const hair=ball(0,1.94,-.03,.35,'#64513c',avatar);hair.scale.y=.55;for(const x of [-.12,.12])ball(x,1.77,.32,.028,'#324b3c',avatar);avatar.position.set(0,0,4.5);
  function objectButton(label,kind,id){const b=document.createElement('button');b.className='m04-object';b.textContent=label;b.dataset.libraryKind=kind;if(id)b.dataset.bookId=id;root.append(b);return b;}
  const shelfButton=objectButton('▤ 제작 순서 책장','shelf'),binButton=objectButton('↩ 함정 반납함','bin');
  const palette=['#b9d8a9','#e8c57d','#d7b8a0','#9fc8c5','#c0b8d9','#d5d494','#a6c4b9','#e5a58a'];
  // A fixed mixed placement gives every book a reachable route, without making its
  // correct sequence coincide with the order along the floor.
  const placement=[3,6,0,5,2,7,1,4];
  const bookObjects=config.books.map((b,i)=>{const g=new THREE.Group();scene.add(g);box(0,0,0,1.12,.15,1.37,palette[i],g);box(0,.05,.02,1.01,.11,1.24,'#fff6e2',g);const cover=mesh(new THREE.PlaneGeometry(1.13,1.38),mat('#ffffff',true,{map:texture(b.label,b.icon,palette[i]),side:THREE.DoubleSide}),g,[0,.12,0]);cover.rotation.x=-Math.PI/2;const spawn=SPAWNS[placement[i]];g.position.set(spawn[0],.12,spawn[1]);g.rotation.y=(i%2?.1:-.08);return {data:b,mesh:g,spawn:{x:spawn[0],z:spawn[1]},floor:{x:spawn[0],z:spawn[1]},button:objectButton(`${b.icon||'▤'} ${b.label}`,'book',b.id),bounce:0,flight:null};});
  const projected=new THREE.Vector3(),raycaster=new THREE.Raycaster(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),groundPoint=new THREE.Vector3();
  function listen(o,type,fn,opts){o.addEventListener(type,fn,opts);cleanups.push(()=>o.removeEventListener(type,fn,opts));}
  function clearInput(){keys.clear();directions.clear();target=null;}
  function canPlay(){return !destroyed&&!paused&&!document.hidden&&!won&&!timedOut;}
  function cue(name){data.runtime?.playSound?.(name);}
  function show(icon,tip='',bad=false){feedback.replaceChildren();const glyph=document.createElement('strong');glyph.textContent=icon;feedback.append(glyph,document.createTextNode(tip));feedback.style.color=bad?'#a64435':'#285345';tipLeft=1.6;if(bad){root.classList.remove('m04-shake');void root.offsetWidth;root.classList.add('m04-shake');cue('error');}else cue('success');}
  function nearest(){if(state.holding){if(Math.hypot(avatar.position.x-SHELF.x,avatar.position.z-SHELF.z)<2.8)return {action:'shelve'};if(Math.hypot(avatar.position.x-BIN.x,avatar.position.z-BIN.z)<2)return {action:'return'};return {action:'drop'};}let chosen=null,distance=1.65;for(const book of bookObjects){if(state.placed.includes(book.data.id)||state.returned.includes(book.data.id))continue;const d=Math.hypot(avatar.position.x-book.floor.x,avatar.position.z-book.floor.z);if(d<distance){chosen=book;distance=d;}}return chosen?{action:'pickup',book:chosen}:null;}
  function eject(book){book.floor={x:clamp(avatar.position.x+(avatar.position.x>4?-.5:.5),BOUNDS.minX,BOUNDS.maxX),z:clamp(avatar.position.z+.8,BOUNDS.minZ+.3,BOUNDS.maxZ)};book.bounce=.75;book.flight={x:book.mesh.position.x,y:book.mesh.position.y,z:book.mesh.position.z};}
  function interact(){if(!canPlay()||target)return;const near=nearest();if(!near){show('↔','책 가까이 다가가세요.');return;}const oldHeld=state.holding;const result=resolveLibraryAction(state,near.action,near.book?.data.id);state=result.state;const current=bookObjects.find(b=>b.data.id===(oldHeld||state.holding));target=null;
    if(result.event==='picked'){cue('click');}
    else if(result.event==='shelved'){show('✓');}
    else if(result.event==='returned'){show('✓','한꺼번에 만들기는 반납!');}
    else if(result.event==='dropped'){current.floor={x:avatar.position.x,z:clamp(avatar.position.z+.7,BOUNDS.minZ,BOUNDS.maxZ)};cue('click');}
    else if(result.event==='ejected'){eject(current);hintLeft=2;const tip=current.data.trap?'함정 책은 반납함으로!':'빛나는 다음 책부터 꽂으세요.';show('↶',tip,true);onFail({reason:'wrong-book-order',tip});}
    if(destroyed)return;
    updateHUD();if(state.complete&&!won){won=true;clearInput();show('✓','제작 순서, 정리 끝!');onWin({books:7,trapReturned:true,elapsed});}
  }
  function updateHUD(){const setText=(element,value)=>{if(element.textContent!==value)element.textContent=value;};setText(progress,`책 ${state.placed.length}/7 · 함정 ${state.returned.length}/1`);setText(held,state.holding?`들고 있는 책 · ${config.books.find(b=>b.id===state.holding).label}`:'순서대로 꽂고, 함정은 반납!');const near=nearest();actionButton.disabled=!!target||won||timedOut;setText(actionButton,target?'이동 중…':near?({pickup:'E · 책 줍기',shelve:'E · 책장에 꽂기',return:'E · 반납함에 던지기',drop:'E · 내려놓기'}[near.action]):'E · 책 가까이 가기');}
  function timeout(){timedOut=true;clearInput();show('⌛','천천히 다시 정리해 볼까요?',true);retry.hidden=false;actionButton.disabled=true;onFail({reason:'timeout',tip:'작은 단계부터 차례로 꽂아요.'});retry.focus();}
  function restart(){if(destroyed)return;state=createLibraryState(config.books,config.order);elapsed=0;timedOut=false;won=false;retry.hidden=true;actionButton.disabled=false;avatar.position.set(0,0,4.5);bookObjects.forEach(b=>{b.floor={...b.spawn};b.bounce=0;b.flight=null;});feedback.textContent='';tipLeft=0;hintLeft=0;clearInput();last=performance.now();updateHUD();canvas.focus();}
  const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
  listen(window,'keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;if(!canPlay())return;if(movement.has(e.code)){e.preventDefault();e.stopPropagation();keys.add(e.code);target=null;}else if(e.code==='KeyE'&&!e.repeat){e.preventDefault();e.stopPropagation();interact();}});
  listen(window,'keyup',e=>keys.delete(e.code));listen(window,'blur',()=>{clearInput();last=performance.now();});listen(document,'visibilitychange',()=>{clearInput();last=performance.now();});
  root.querySelectorAll('[data-dir]').forEach(b=>{listen(b,'pointerdown',e=>{if(!canPlay())return;e.preventDefault();b.setPointerCapture?.(e.pointerId);directions.set(e.pointerId,b.dataset.dir);target=null;});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(b,type,e=>directions.delete(e.pointerId));});
  function walkTo(x,z){if(canPlay()){target={x:clamp(x,BOUNDS.minX,BOUNDS.maxX),z:clamp(z,BOUNDS.minZ,BOUNDS.maxZ)};updateHUD();}}
  for(const b of bookObjects)listen(b.button,'click',()=>walkTo(b.floor.x,b.floor.z));listen(shelfButton,'click',()=>walkTo(0,-2));listen(binButton,'click',()=>walkTo(BIN.x,-1.7));
  listen(actionButton,'click',interact);listen(retry,'click',restart);listen(canvas,'pointerdown',e=>{if(!canPlay())return;e.preventDefault();canvas.focus({preventScroll:true});const r=canvas.getBoundingClientRect();raycaster.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2},camera);if(raycaster.ray.intersectPlane(ground,groundPoint))walkTo(groundPoint.x,groundPoint.z);});
  function resize(){if(destroyed)return;const r=root.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setSize(width,height);camera.aspect=width/height;const d=camera.aspect<1.05?20/Math.max(.5,camera.aspect):20;camera.position.set(0,d*.83,d*.68);camera.lookAt(0,.4,-.25);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);render();}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(root);listen(window,'resize',resize);
  function project(button,x,y,z){projected.set(x,y,z).project(camera);button.style.left=`${clamp((projected.x+1)*width/2,62,width-62)}px`;button.style.top=`${clamp((1-projected.y)*height/2,118,height-156)}px`;}
  function move(dt){let dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));let dz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));for(const dir of directions.values()){if(dir==='left')dx--;if(dir==='right')dx++;if(dir==='up')dz--;if(dir==='down')dz++;}if(target&&!dx&&!dz){dx=target.x-avatar.position.x;dz=target.z-avatar.position.z;if(Math.hypot(dx,dz)<.08){target=null;dx=dz=0;}}const len=Math.hypot(dx,dz);if(len){const step=Math.min(5.4*dt,target?len:Infinity);avatar.position.x=clamp(avatar.position.x+dx/len*step,BOUNDS.minX,BOUNDS.maxX);avatar.position.z=clamp(avatar.position.z+dz/len*step,BOUNDS.minZ,BOUNDS.maxZ);avatar.rotation.y=Math.atan2(dx,dz);}const swing=len?Math.sin(sceneTime*11)*.55:0;legs[0].rotation.x=swing;legs[1].rotation.x=-swing;arms[0].rotation.x=state.holding?-.8:-swing*.8;arms[1].rotation.x=state.holding?-.8:swing*.8;}
  function render(){const next=state.order[state.placed.length];for(const b of bookObjects){const placed=state.placed.indexOf(b.data.id),returned=state.returned.includes(b.data.id),carried=state.holding===b.data.id;b.mesh.visible=!returned;b.button.hidden=placed>=0||returned||carried; b.button.classList.toggle('is-next',hintLeft>0&&b.data.id===next);if(carried){b.mesh.position.set(avatar.position.x,1.15,avatar.position.z+.45);b.mesh.rotation.set(.4,0,0);}else if(placed>=0){b.mesh.position.set(-3.45+placed*1.15,.65,-3.68);b.mesh.rotation.set(-Math.PI/2,0,0);}else if(b.bounce>0&&b.flight){const p=1-b.bounce/.75;b.mesh.position.set(b.flight.x+(b.floor.x-b.flight.x)*p,b.flight.y*(1-p)+.22*p+Math.sin(p*Math.PI)*1.8,b.flight.z+(b.floor.z-b.flight.z)*p);b.mesh.rotation.set(0,p*Math.PI*2,p*Math.PI);}else{b.mesh.position.set(b.floor.x,.2,b.floor.z);b.mesh.rotation.set(0,.05,0);}if(!b.button.hidden)project(b.button,b.floor.x,.65,b.floor.z);}
    project(shelfButton,0,2.95,-3.8);project(binButton,BIN.x,1.5,BIN.z);for(let i=0;i<7;i++)slotMaterials[i].color.set(i<state.placed.length?'#b2d684':i===state.placed.length?'#f2cf6d':'#e1d7bb');renderer.render(scene,camera);}
  function frame(now){if(destroyed)return;raf=requestAnimationFrame(frame);const clockDt=Math.max(0,(now-last)/1000),dt=Math.min(.08,clockDt);last=now;if(paused||document.hidden)return;if(!won&&!timedOut){elapsed+=clockDt;sceneTime+=clockDt;tipLeft-=clockDt;hintLeft-=clockDt;if(tipLeft<=0)feedback.textContent='';if(elapsed>=duration){timeout();if(destroyed)return;}else move(clockDt);for(const b of bookObjects)b.bounce=Math.max(0,b.bounce-dt);clock.textContent=`◷ ${Math.max(0,Math.ceil(duration-elapsed))}초`;updateHUD();}render();}
  updateHUD();resize();raf=requestAnimationFrame(frame);
  return {pause(){paused=true;clearInput();},resume(){if(destroyed)return;paused=false;last=performance.now();},hint(){if(!canPlay())return;hintLeft=4;show('▤',state.placed.length<7?'빛나는 책이 다음 단계예요.':'함정 책을 반납함에 넣으세요.');},destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(raf);clearInput();observer?.disconnect();cleanups.forEach(fn=>fn());textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();scene.clear();root.remove();}};
}
