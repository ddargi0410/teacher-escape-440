import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {pointBlocked,hasLineOfSight,inPrincipalView,animateCharacter} from '../crowd.js';
const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};
function makeWorld(){return createWorld(new THREE.Scene());}

test('all authored route segments clear the actual school colliders',()=>{
 const w=makeWorld();
 for(const a of w.characters){
  w.setFloor(a.floor);
  for(let i=0;i<a.route.length;i++){
   const from=a.route[i],to=a.route[(i+1)%a.route.length];
   for(let n=0;n<=80;n++){
    const p={x:from.x+(to.x-from.x)*n/80,z:from.z+(to.z-from.z)*n/80};
    assert.equal(pointBlocked(p,w.colliders,.28*a.model.scale.x),false,`${a.id} segment ${i} (${p.x},${p.z})`);
   }
  }
 }
});
test('walls and hiding pillars block the principal, low desks do not',()=>{
 const p={x:0,z:0},target={x:0,z:5};
 assert.equal(inPrincipalView(p,0,target,[]),true);
 assert.equal(inPrincipalView(p,Math.PI,target,[]),false);
 assert.equal(hasLineOfSight(p,target,[{x:0,z:2.5,w:.7,d:.7}]),false);
 assert.equal(hasLineOfSight(p,target,[{x:0,z:2.5,w:2,d:1,blocksSight:false}]),true);
 assert.equal(inPrincipalView(p,0,{x:0,z:8},[]),false);
});
test('inactive floors and paused simulation remain frozen',()=>{
 const w=makeWorld(),other=w.characters.filter(a=>a.floor!==5),before=other.map(a=>({p:a.model.position.clone(),phase:a.phase}));
 for(let n=0;n<100;n++)w.updateCrowd(.05,{position:{x:0,z:6.5},floor:5,enabled:true});
 other.forEach((a,i)=>{assert.equal(a.model.position.distanceTo(before[i].p),0);assert.equal(a.phase,before[i].phase);});
 const snapshots=w.characters.map(a=>a.model.position.clone());
 w.updateCrowd(.05,{position:{x:0,z:6.5},floor:5,enabled:false});
 w.characters.forEach((a,i)=>assert.equal(a.model.position.distanceTo(snapshots[i]),0));
});
test('nearby mission NPC stops, faces player, markers follow its patrol',()=>{
 const w=makeWorld();w.setFloor(5);const npc=w.getNPC(1),start=npc.position.clone();
 for(let n=0;n<100;n++)w.updateCrowd(.05,{position:{x:start.x,z:start.z+1},floor:5,enabled:true});
 assert.equal(npc.position.distanceTo(start),0);
 for(let n=0;n<100;n++)w.updateCrowd(.05,{position:{x:0,z:6.5},floor:5,enabled:true});
 assert.ok(npc.position.distanceTo(start)>.5);
 const item=w.interactables.find(i=>i.missionId===1);assert.equal(item.x,npc.position.x);assert.equal(item.z,npc.position.z);
});
test('principal penalty has a cooldown',()=>{
 const w=makeWorld(),a=w.characters.find(x=>x.kind==='principal');let events=[];
 // Principal waits at elevator and looks forward; no movement during this check.
 a.pause=100;a.model.rotation.y=0;
 for(let n=0;n<120;n++)w.updateCrowd(.05,{position:{x:0,z:6.8},floor:5,enabled:true,onEvent:e=>events.push(e)});
 const caught=events.filter(e=>e.type==='principal');assert.equal(caught.length,1);assert.equal(caught[0].duration,5);assert.equal(caught[0].penalty,1);
});
test('teacher arm and leg pivots swing oppositely and reset',()=>{
 const w=makeWorld(),model=w.createTeacher();animateCharacter(model,Math.PI/2,1);
 assert.ok(model.userData.legs[0].rotation.x>0);assert.ok(model.userData.arms[0].rotation.x<0);
 animateCharacter(model,2,0);assert.equal(model.userData.legs[0].rotation.x,0);assert.equal(model.userData.arms[0].rotation.x,-0);
});

test('real corridor pillar prevents the principal event',()=>{
 const w=makeWorld(),a=w.characters.find(x=>x.kind==='principal'),events=[];a.pause=100;a.model.position.set(-4,0,4.9);a.model.rotation.y=0;
 for(let n=0;n<120;n++)w.updateCrowd(.05,{position:{x:-4,z:7},floor:5,enabled:true,onEvent:e=>events.push(e)});
 assert.equal(events.some(e=>e.type==='principal'),false);
});
test('principal changes floors only at the elevator and then freezes offscreen',()=>{
 const w=makeWorld(),a=w.characters.find(x=>x.kind==='principal');
 for(let n=0;n<2000&&a.floor===5;n++)w.updateCrowd(.05,{position:{x:7,z:-4},floor:5,enabled:true});
 assert.equal(a.floor,4);assert.equal(a.model.position.x,0);assert.equal(a.model.position.z,4.9);
 const updates=a.updates;for(let n=0;n<100;n++)w.updateCrowd(.05,{position:{x:7,z:-4},floor:5,enabled:true});
 assert.equal(a.updates,updates);
});
