import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};
function setup(){
  const world=createWorld(new THREE.Scene());world.setFloor(5);
  world.characters.forEach(a=>{a.pause=1000;});
  const player={x:-10,y:16,z:4.05};
  world.updateCrowd(.01,{position:player,floor:5,enabled:true});
  return {world,player,child:world.characters.find(a=>a.id==='child-5-0'),parent:world.characters.find(a=>a.id==='complaint-parent-5')};
}
function tick(world,seconds,position,floor=world.floor,enabled=true,onEvent){
  for(let elapsed=0;elapsed<seconds;elapsed+=.05)world.updateCrowd(.05,{position,floor,enabled,onEvent});
}

test('both corridor actions remove their target immediately and enforce a shared cooldown',()=>{
  const {world,player,child,parent}=setup();
  const hit=world.useCorridorAction('talk',player);
  assert.equal(hit.ok,true);assert.equal(hit.actor,child.model);assert.equal(hit.targetKind,'child');
  assert.equal(child.defeated,true);assert.equal(child.model.visible,false);
  assert.ok(child.respawnRemaining>=20&&child.respawnRemaining<=35);
  assert.deepEqual(world.useCorridorAction('bonk',parent.model.position),{ok:false,reason:'cooldown'});
  tick(world,1.3,player);
  const second=world.useCorridorAction('bonk',parent.model.position);
  assert.equal(second.ok,true);assert.equal(second.actor,parent.model);
  assert.equal(parent.defeated,true);assert.equal(parent.model.visible,false);
  assert.match(second.text,/뿅/);
});

test('talk reaches farther than bonk while mission teachers, principal and vice are never targets',()=>{
  const {world,child}=setup();
  for(const a of world.characters.filter(a=>a.floor===5&&(a.kind==='child'||a.kind==='parent')))a.model.position.set(10,0,7.1);
  child.model.position.set(0,0,4.05);
  const player={x:0,z:7.05};
  assert.deepEqual(world.useCorridorAction('bonk',player),{ok:false,reason:'empty'});
  assert.equal(world.useCorridorAction('talk',player).actor,child.model);
  tick(world,1.3,player);
  const npc=world.getNPC(1);
  assert.deepEqual(world.useCorridorAction('talk',npc.position),{ok:false,reason:'empty'});
  const principal=world.characters.find(a=>a.kind==='principal');
  assert.deepEqual(world.useCorridorAction('bonk',principal.model.position),{ok:false,reason:'empty'});
  assert.equal(npc.visible,true);assert.equal(principal.model.visible,true);
});

test('defeated children cannot stumble the player and only respawn after active time on their floor',()=>{
  const {world,player,child}=setup(),events=[];
  world.useCorridorAction('bonk',player);
  const remaining=child.respawnRemaining;
  tick(world,40,player,5,false,e=>events.push(e));
  assert.equal(child.respawnRemaining,remaining);
  world.setFloor(4);tick(world,40,player,4,true,e=>events.push(e));
  assert.equal(child.respawnRemaining,remaining);
  assert.equal(child.model.visible,false);
  world.setFloor(5);
  tick(world,4,player,5,true,e=>events.push(e));
  assert.equal(events.some(e=>e.actor===child.model),false);
  for(let count=0;count<750&&child.defeated;count++)world.updateCrowd(.05,{position:player,floor:5,enabled:true});
  assert.equal(child.defeated,false);assert.equal(child.model.visible,true);
  assert.ok(Math.hypot(child.model.position.x-player.x,child.model.position.z-player.z)>4);
  assert.ok(child.route.some(p=>p.x===child.model.position.x&&p.z===child.model.position.z));
});

test('complaint callers speak short lines without a movement penalty and stay silent when removed',()=>{
  const {world,parent}=setup(),events=[];
  const player=parent.model.position.clone();
  tick(world,6,player,5,true,e=>events.push(e));
  const complaints=events.filter(e=>e.type==='complaint');
  assert.equal(complaints.length,1);assert.equal(complaints[0].actor,parent.model);
  assert.equal(complaints[0].duration,2);assert.equal(complaints[0].penalty,undefined);
  assert.ok([...complaints[0].text].length<=25);
  assert.equal(world.useCorridorAction('talk',player).actor,parent.model);
  tick(world,13,player,5,true,e=>events.push(e));
  assert.equal(events.filter(e=>e.type==='complaint').length,1);
});

test('paused scenes and quiet annexes cannot be used to attack unrelated characters',()=>{
  const {world,player}=setup();
  world.updateCrowd(.05,{position:player,floor:5,enabled:false});
  assert.deepEqual(world.useCorridorAction('talk',player),{ok:false,reason:'empty'});
  world.setFloor(1);
  const nurse={x:20,y:0,z:2.5};
  world.updateCrowd(.05,{position:nurse,floor:1,enabled:true});
  assert.deepEqual(world.useCorridorAction('talk',nurse),{ok:false,reason:'empty'});
  assert.deepEqual(world.useCorridorAction('bonk',{x:-20,z:1.2}),{ok:false,reason:'empty'});
});

test('a real hiding pillar blocks a corridor action, and reset clears defeated state',()=>{
  const {world,child}=setup();
  world.characters.filter(a=>a.floor===5&&(a.kind==='child'||a.kind==='parent')).forEach(a=>a.model.position.set(10,0,4));
  child.model.position.set(4,0,4.9);
  assert.deepEqual(world.useCorridorAction('talk',{x:4,z:7}),{ok:false,reason:'empty'});
  assert.equal(world.useCorridorAction('talk',{x:4,z:4.9}).ok,true);
  world.resetCrowd();
  assert.equal(child.defeated,false);assert.equal(child.model.visible,true);
  assert.equal(child.respawnRemaining,0);
});
