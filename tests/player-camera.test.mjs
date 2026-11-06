import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createPlayer } from '../player.js';
import { cameraHitFraction, keepCameraClear, WALK_CAMERA, OVERVIEW_CAMERA } from '../camera-rig.js';
import { createWorld } from '../world.js';

class Target {
  constructor() { this.handlers = new Map(); this.style = {}; this.classList = { add(){}, remove(){} }; }
  addEventListener(name, fn) { if (!this.handlers.has(name)) this.handlers.set(name, new Set()); this.handlers.get(name).add(fn); }
  removeEventListener(name, fn) { this.handlers.get(name)?.delete(fn); }
  dispatch(name, data = {}) { const event = { preventDefault(){}, stopPropagation(){}, target:this, ...data }; for (const fn of this.handlers.get(name) || []) fn(event); }
  closest() { return null; }
  setPointerCapture() {}
  releasePointerCapture() {}
}

function fixture({ colliders = [] } = {}) {
  globalThis.Element = Target;
  const window = globalThis.window = new Target();
  const document = globalThis.document = new Target(); document.hidden = false; document.getElementById = () => null;
  const canvas = new Target();
  const camera = new THREE.PerspectiveCamera(42, 16/9, .1, 220);
  const model = new THREE.Group(); model.userData.legs = [new THREE.Group(), new THREE.Group()]; model.userData.arms = [new THREE.Group(), new THREE.Group()];
  const world = { cameraModes:[],setCameraMode(mode){this.cameraModes.push(mode);},colliders: [], cameraColliders: colliders, spawn: () => ({ x:0,y:0,z:0 }), bounds:{ minX:-30,maxX:30,minZ:-30,maxZ:30 } };
  const player = createPlayer({ camera, canvas, model, world }); player.setFloor(1);
  return { window, document, canvas, camera, model, world, player };
}

test('default follow camera stays inside a corridor at near human height, with a useful field of view', () => {
  const f = fixture();
  assert.ok(f.camera.position.y > 1.7 && f.camera.position.y < 2.2);
  assert.ok(f.camera.position.distanceTo(f.player.position) < 5.5);
  assert.equal(f.camera.fov, 62); assert.equal(f.model.visible, true);
  const before = f.player.position.clone();
  f.window.dispatch('keydown', { code:'KeyW' }); f.player.update(.05);
  assert.ok(f.player.position.x > before.x, 'W walks along the corridor shown ahead');
  f.window.dispatch('keyup', { code:'KeyW' }); f.player.dispose();
});

test('height-aware camera obstruction leaves low furniture and open air clear but catches walls and ceilings', () => {
  const from = new THREE.Vector3(0,1.35,0), desired = new THREE.Vector3(0,2,5), output = new THREE.Vector3();
  const desk = { x:0,z:2,w:2,d:.4,minY:0,maxY:.8 };
  assert.equal(cameraHitFraction(from, desired, desk), null);
  const wall = { x:0,z:2,w:3,d:.2,minY:0,maxY:3.5 };
  keepCameraClear(from, desired, [desk, wall], output);
  assert.ok(output.z < 1.73 && output.z > 1.5);
  const ceiling = { x:0,z:0,w:10,d:10,minY:3.4,maxY:3.7 };
  keepCameraClear(from, new THREE.Vector3(0,6,1), [ceiling], output);
  assert.ok(output.y < 3.23 && output.y > 3.1);
  assert.equal(cameraHitFraction(from, desired, { x:NaN,z:0,w:1,d:1 }), null);
});

test('both camera destination and its smooth movement stay in front of a wall', () => {
  const wall = { x:-2,z:0,w:.2,d:10,minY:0,maxY:3.5 };
  const f = fixture({ colliders:[wall] });
  assert.ok(f.camera.position.x > -1.73);
  f.camera.position.set(-8,2,1); // Prior position after an entrance transition.
  f.player.update(.016);
  assert.ok(f.camera.position.x > -1.73, 'smoothing cannot remain beyond the wall');
  f.canvas.dispatch('pointerdown', { pointerType:'mouse',button:0,pointerId:1,clientX:0,clientY:0 });
  f.canvas.dispatch('pointermove', { pointerId:1,clientX:250,clientY:-20 });
  f.player.update(.05); assert.ok(f.camera.position.x > -1.73);
  f.player.dispose();
});

test('tight room walls give a clear near-person view instead of the inside of the teacher head',()=>{
  const f=fixture({colliders:[{x:-1.7,z:0,w:.2,d:10,minY:0,maxY:3}]});
  assert.equal(f.player.cameraMode,'shoulder');assert.equal(f.model.visible,false,'compressed shoulder camera hides its own oversized body');
  const before=f.player.position.clone();const direction=new THREE.Vector3();f.camera.getWorldDirection(direction);
  assert.ok(direction.x>0,'near-person view still looks along the intended direction');
  assert.deepEqual(f.player.position.toArray(),before.toArray(),'visibility adaptation does not move the teacher');
  f.world.cameraColliders=[];for(let i=0;i<40;i++)f.player.update(.05);
  assert.equal(f.model.visible,true,'teacher returns when the camera has comfortable space');
  assert.equal(f.player.cameraMode,'shoulder','no permanent mode switch is forced');f.player.dispose();
});

test('wheel zoom is bounded; paused controls and first-person do not accidentally zoom or move', () => {
  const f = fixture();
  f.canvas.dispatch('wheel', { deltaY:100000 }); f.player.update(.05); f.player.update(.05);
  for (let i=0;i<40;i++) f.player.update(.05);
  assert.ok(f.camera.position.distanceTo(f.player.position) < 6.7);
  f.player.setActive(false); const paused=f.camera.position.clone();
  f.canvas.dispatch('wheel', { deltaY:-100000 }); f.player.update(.05);
  assert.deepEqual(f.camera.position.toArray(), paused.toArray());
  f.player.setActive(true); f.player.setView(true);
  assert.equal(f.camera.fov,68); assert.equal(f.model.visible,false); assert.equal(f.camera.position.y,1.66);
  f.player.setView(false); f.player.resetCamera();
  assert.ok(Math.abs(f.camera.position.x + Math.cos(WALK_CAMERA.elevation)*WALK_CAMERA.distance) < 1e-6);
  f.player.dispose();
});

test('bed camera eases into its own close composition and restores normal following without moving the player', () => {
  const f=fixture(); f.player.setActive(false);
  const initial=f.camera.position.clone();
  f.player.teleport({x:0,y:1,z:-1},{preserveCamera:true});
  assert.deepEqual(f.camera.position.toArray(),initial.toArray(),'lying down keeps the previous camera for its transition');
  const before=f.player.position.clone();
  const bed={ id:'bed-3', cameraPose:{ position:{x:3,y:2.15,z:2},target:{x:0,y:1.2,z:-1},fov:58 } };
  assert.equal(f.player.updateRestCamera(bed,.016),true);
  assert.ok(f.camera.position.distanceTo(initial) > 0);
  assert.ok(f.camera.position.distanceTo(new THREE.Vector3(3,2.15,2)) > .5,'transition is gradual');
  for(let i=0;i<180;i++) f.player.updateRestCamera(bed,1/60);
  assert.ok(f.camera.position.distanceTo(new THREE.Vector3(3,2.15,2)) < .002);
  assert.deepEqual(f.player.position.toArray(), before.toArray()); assert.equal(f.model.visible,true);
  assert.equal(f.player.updateRestCamera({id:'bad',cameraPose:{position:{x:NaN}}},.016),false);
  f.player.endRestCamera(); f.player.setActive(true); f.player.update(.05);
  assert.equal(f.camera.fov,62); f.player.dispose();
});

test('blur and disposal clear held input and every newly installed camera listener', () => {
  const f=fixture(); f.window.dispatch('keydown',{code:'KeyW'}); f.player.update(.05);
  f.window.dispatch('blur'); const before=f.player.position.clone();f.player.update(.05);
  assert.deepEqual(f.player.position.toArray(),before.toArray());
  f.player.dispose(); for(const handlers of f.canvas.handlers.values())assert.equal(handlers.size,0);
  for(const handlers of f.window.handlers.values())assert.equal(handlers.size,0);
});

test('inactive walking input never straightens a resting pose or resets it on tab blur', () => {
  const f=fixture(); f.player.setActive(false); f.model.userData.restingBed='bed-1';
  f.model.userData.legs[0].rotation.x=-.42; f.model.userData.arms[0].rotation.x=-.8;
  for(let i=0;i<4;i++){f.player.setActive(false);f.player.update(.016,false);}
  f.window.dispatch('blur');
  assert.equal(f.model.userData.legs[0].rotation.x,-.42); assert.equal(f.model.userData.arms[0].rotation.x,-.8);
  delete f.model.userData.restingBed;f.player.setActive(true);f.player.update(.016);
  assert.equal(f.model.userData.legs[0].rotation.x,0); f.player.dispose();
});

test('overview restores the old high cutaway view without moving the player or applying interior camera collisions',()=>{
  const f=fixture({colliders:[{x:0,z:0,w:40,d:40,minY:3.4,maxY:3.7}]});
  const before=f.player.position.clone();assert.equal(f.player.cameraMode,'shoulder');
  assert.equal(f.player.setCameraMode('overview'),true);assert.equal(f.player.cameraMode,'overview');
  assert.equal(f.world.cameraModes.at(-1),'overview');assert.equal(f.camera.fov,42);
  assert.ok(f.camera.position.y>12&&f.camera.position.z>13,'original high perspective stays above ceiling');
  assert.equal(f.model.visible,true);assert.deepEqual(f.player.position.toArray(),before.toArray());
  f.player.setCameraMode('first');assert.equal(f.player.firstPerson,true);assert.equal(f.model.visible,false);
  f.player.setView(false);assert.equal(f.player.cameraMode,'shoulder');assert.equal(f.camera.fov,62);
  assert.ok(f.camera.position.y<2.2);f.player.dispose();
});

test('each selectable view remembers its own orbit; invalid modes cannot alter the camera',()=>{
  const f=fixture();
  f.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,pointerId:1,clientX:0,clientY:0});
  f.canvas.dispatch('pointermove',{pointerId:1,clientX:70,clientY:0});f.player.update(.05);
  const shoulderYaw=f.player.yaw;
  f.player.setCameraMode('overview');assert.equal(f.player.yaw,OVERVIEW_CAMERA.yaw);
  f.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,pointerId:2,clientX:0,clientY:0});
  f.canvas.dispatch('pointermove',{pointerId:2,clientX:-100,clientY:0});f.player.update(.05);
  const overviewYaw=f.player.yaw;f.player.setCameraMode('shoulder');assert.equal(f.player.yaw,shoulderYaw);
  f.player.setCameraMode('overview');assert.equal(f.player.yaw,overviewYaw);
  const before=f.camera.position.clone();assert.equal(f.player.setCameraMode('invalid'),false);
  assert.equal(f.player.cameraMode,'overview');assert.deepEqual(f.camera.position.toArray(),before.toArray());
  f.player.resetCamera();assert.equal(f.player.yaw,OVERVIEW_CAMERA.yaw);f.player.dispose();
});

test('rest temporarily closes the cutaway and preserves the selected overview mode for standing',()=>{
  const f=fixture();f.player.setCameraMode('overview');f.player.setActive(false);
  const bed={id:'bed-1',cameraPose:{position:{x:3,y:2.3,z:2},target:{x:0,y:1.3,z:-1}}};
  f.player.updateRestCamera(bed,.05,{snap:true});
  assert.equal(f.player.cameraMode,'overview');assert.equal(f.world.cameraModes.at(-1),'shoulder');
  f.player.endRestCamera();assert.equal(f.world.cameraModes.at(-1),'overview');
  f.player.setActive(true);f.player.update(.05);assert.equal(f.camera.fov,42);f.player.dispose();
});

test('room-entry camera orientation is explicit, finite and independent of the selected view',()=>{
  const f=fixture();f.player.setCameraMode('overview');
  f.player.teleport({x:7,y:16,z:-.8},{lookYaw:0});
  assert.equal(f.player.cameraMode,'overview');assert.equal(f.player.yaw,0);assert.equal(f.camera.fov,42);
  assert.ok(f.camera.position.z>f.player.position.z);
  const before=f.camera.position.clone();
  f.player.teleport({x:-7,y:16,z:-.8},{lookYaw:Math.PI/2,preserveCamera:true});
  assert.equal(f.player.yaw,Math.PI/2);assert.deepEqual(f.camera.position.toArray(),before.toArray());
  f.player.teleport({x:0,y:0,z:0},{lookYaw:NaN});assert.equal(f.player.yaw,Math.PI/2);
  f.player.dispose();
});

test('pedestrians crossing the lens are hidden only during rendering; conversation and gameplay actors stay intact',()=>{
  const f=fixture();
  const makeActor=(x,z)=>{const model=new THREE.Group(),body=new THREE.Group();body.name='character-body';model.add(body);model.userData.body=body;model.position.set(x,0,z);return {model,body,floor:1};};
  const lens=makeActor(f.camera.position.x+1.25,f.camera.position.z),conversation=makeActor(.5,0),hidden=makeActor(f.camera.position.x,f.camera.position.z);
  const child=makeActor(f.camera.position.x,f.camera.position.z+1.25),large=makeActor(f.camera.position.x,f.camera.position.z+1.8);
  child.model.scale.setScalar(.64);large.model.scale.setScalar(1.2);
  hidden.body.visible=false;f.world.characters=[lens,conversation,hidden,child,large];
  f.player.withCameraOcclusion(()=>{
    assert.equal(lens.body.visible,false);assert.equal(lens.model.visible,true,'encounter/action logic still sees the actor');
    assert.equal(conversation.body.visible,true);assert.equal(conversation.model.visible,true);
    assert.equal(child.body.visible,true,'a smaller child at a readable distance stays visible');
    assert.equal(large.body.visible,false,'larger adults get proportional near-lens clearance');
  });
  assert.equal(lens.body.visible,true);assert.equal(hidden.body.visible,false,'pre-existing hidden render state is preserved');
  assert.throws(()=>f.player.withCameraOcclusion(()=>{throw new Error('render failed');}));assert.equal(lens.body.visible,true,'renderer failure cannot strand an invisible body');
  f.player.setCameraMode('overview');f.player.withCameraOcclusion(()=>assert.equal(lens.body.visible,true));
  f.player.setCameraMode('first');f.player.withCameraOcclusion(()=>assert.equal(lens.body.visible,true));
  f.player.dispose();
});

test('first-person night patrol cannot fill the lens and its flashlight restores after drawing',()=>{
  const f=fixture();f.player.setCameraMode('first');
  const guard=new THREE.Group(),body=new THREE.Group(),torch=new THREE.Group(),hiddenBand=new THREE.Group();
  guard.add(body,torch,hiddenBand);guard.userData.body=body;guard.userData.renderOcclusionParts=[torch,hiddenBand];hiddenBand.visible=false;
  guard.position.set(f.camera.position.x+.35,0,f.camera.position.z+.2);
  f.world.cameraOccluders=[{model:guard,floor:1}];
  const position=guard.position.clone();
  f.player.withCameraOcclusion(()=>{
    assert.equal(body.visible,false);assert.equal(torch.visible,false);assert.equal(guard.visible,true);
    assert.deepEqual(guard.position.toArray(),position.toArray(),'rendering never changes patrol position');
  });
  assert.equal(body.visible,true);assert.equal(torch.visible,true);assert.equal(hiddenBand.visible,false);
  guard.position.x+=2;
  f.player.withCameraOcclusion(()=>assert.equal(body.visible,true,'a patrol at readable distance stays visible'));
  f.player.dispose();
});

test('authored school spawns and all five bed compositions have real space behind the camera target', () => {
  const noop=()=>{};
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};
  const world=createWorld(new THREE.Scene()),safe=new THREE.Vector3();
  for(let floor=1;floor<=5;floor++){
    world.setFloor(floor);const p=world.spawn(floor);
    const origin=new THREE.Vector3(p.x,p.y+WALK_CAMERA.targetHeight,p.z);
    const desired=new THREE.Vector3(p.x-Math.cos(WALK_CAMERA.elevation)*WALK_CAMERA.distance,p.y+WALK_CAMERA.targetHeight+Math.sin(WALK_CAMERA.elevation)*WALK_CAMERA.distance,p.z+WALK_CAMERA.shoulder);
    keepCameraClear(origin,desired,world.cameraColliders,safe);
    assert.ok(safe.distanceTo(origin)>=WALK_CAMERA.minDistance,`floor ${floor} leaves enough room for the full teacher even when a corridor column shortens the camera boom`);
    assert.ok(world.cameraColliders.every(box=>cameraHitFraction(origin,safe,box)===null),`floor ${floor} camera path stays clear of every expanded wall and column`);
    assert.ok(safe.y>p.y+1.7&&safe.y<p.y+2.3,'walking camera remains below the ceiling at human height');
    const framed=new THREE.PerspectiveCamera(WALK_CAMERA.fov,16/9,.1,220);framed.position.copy(safe);framed.lookAt(p.x,p.y+WALK_CAMERA.targetHeight,p.z+.28);framed.updateMatrixWorld(true);
    for(const height of [.05,2.25])assert.ok(Math.abs(new THREE.Vector3(p.x,p.y+height,p.z).project(framed).y)<.95,`floor ${floor} keeps the teacher's head and feet inside the frame`);
  }
  world.setFloor(1);
  for(let id=1;id<=5;id++){
    const pose=world.getBed(`bed-${id}`).cameraPose;
    assert.equal(keepCameraClear(pose.target,pose.position,world.cameraColliders,safe,.14),1,`bed ${id} target is above the blanket and its composition is unobstructed`);
    assert.ok(safe.distanceTo(new THREE.Vector3(pose.target.x,pose.target.y,pose.target.z)) < 5.5);
  }
});

test('lying down still turns a full 360° around the bed with drag, arrow keys and wheel',()=>{
  const f=fixture();f.player.setActive(false);
  const bed={id:'bed-2',cameraPose:{position:{x:3,y:2.3,z:2},target:{x:0,y:1.3,z:-1}}};
  f.player.updateRestCamera(bed,.05,{snap:true});
  const target=new THREE.Vector3(0,1.3,-1),distance=()=>f.camera.position.distanceTo(target);
  const angle=()=>Math.atan2(f.camera.position.x-target.x,f.camera.position.z-target.z);
  const start=angle(),startDistance=distance();
  const settle=()=>{for(let i=0;i<240;i++){f.player.setActive(false);f.player.update(1/60,false);f.player.updateRestCamera(bed,1/60);}};
  // The game loop keeps the walking controls inactive every frame while resting.
  f.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,pointerId:7,clientX:0,clientY:0});
  f.player.setActive(false);f.player.update(1/60,false);
  f.canvas.dispatch('pointermove',{pointerId:7,clientX:-(Math.PI/2)/.005,clientY:0});
  f.canvas.dispatch('pointerup',{pointerId:7});settle();
  const turned=Math.atan2(Math.sin(angle()-start),Math.cos(angle()-start));
  assert.ok(Math.abs(turned-Math.PI/2)<.02,`quarter turn while lying (${turned})`);
  assert.ok(Math.abs(distance()-startDistance)<.02,'orbit keeps its distance');
  f.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,pointerId:8,clientX:0,clientY:0});
  f.canvas.dispatch('pointermove',{pointerId:8,clientX:-(Math.PI*1.5)/.005,clientY:0});
  f.canvas.dispatch('pointerup',{pointerId:8});settle();
  assert.ok(f.camera.position.distanceTo(new THREE.Vector3(3,2.3,2))<.02,'a full circle returns to the original composition');
  f.window.dispatch('keydown',{code:'ArrowLeft'});
  for(let i=0;i<30;i++){f.player.setActive(false);f.player.update(1/60,false);f.player.updateRestCamera(bed,1/60);}
  f.window.dispatch('keyup',{code:'ArrowLeft'});settle();
  const arrowTurn=Math.atan2(Math.sin(angle()-start),Math.cos(angle()-start));
  assert.ok(Math.abs(arrowTurn-1.65*.5)<.05,`arrow keys turn the resting view too (${arrowTurn})`);
  f.canvas.dispatch('wheel',{deltaY:-400});settle();
  assert.ok(distance()<startDistance-1,'wheel brings the camera closer to the bed');
  f.player.resetRestLook();settle();
  assert.ok(f.camera.position.distanceTo(new THREE.Vector3(3,2.3,2))<.02,'reset returns to the authored composition');
  f.player.endRestCamera();f.player.setActive(true);f.player.update(.05);
  const walking=f.player.yaw;f.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,pointerId:9,clientX:0,clientY:0});
  f.canvas.dispatch('pointermove',{pointerId:9,clientX:40,clientY:0});f.player.update(.05);
  assert.ok(f.player.yaw<walking,'walking look resumes after standing');
  f.player.dispose();
});

test('the pillow view looks out from the resting eyes and hides only that head while drawing',()=>{
  const f=fixture();const head=new THREE.Group();head.position.set(0,1.4,-1);f.model.add(head);f.model.userData.head=head;
  const bed={id:'bed-1',cameraPose:{position:{x:3,y:2.3,z:2},target:{x:0,y:1.3,z:-1}}};
  f.player.setActive(false);assert.equal(f.player.setRestView('eyes'),true);assert.equal(f.player.setRestView('nope'),false);
  for(let i=0;i<120;i++)f.player.updateRestCamera(bed,1/60);
  const eye=head.localToWorld(new THREE.Vector3(0,.04,.5));
  assert.ok(f.camera.position.distanceTo(eye)<.02,'camera sits at the teacher eyes');
  const before=new THREE.Vector3();f.camera.getWorldDirection(before);
  f.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,pointerId:3,clientX:0,clientY:0});
  f.canvas.dispatch('pointermove',{pointerId:3,clientX:-Math.PI/.005,clientY:0});f.canvas.dispatch('pointerup',{pointerId:3});
  for(let i=0;i<240;i++)f.player.updateRestCamera(bed,1/60);
  const after=new THREE.Vector3();f.camera.getWorldDirection(after);
  assert.ok(before.x*after.x+before.z*after.z<0,'turning half way looks the other way from the pillow');
  f.player.withCameraOcclusion(()=>assert.equal(head.visible,false));assert.equal(head.visible,true);
  f.player.setRestView('orbit');f.player.withCameraOcclusion(()=>assert.equal(head.visible,true));
  f.player.dispose();
});
