import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {pointBlocked,hasLineOfSight} from '../crowd.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};
function setup(){
  const world=createWorld(new THREE.Scene());world.setFloor(5);
  world.characters.forEach(a=>{a.pause=1000;});
  const child=world.characters.find(a=>a.id==='child-5-0'),parent=world.characters.find(a=>a.id==='complaint-parent-5');
  const player={x:child.model.position.x,y:16,z:child.model.position.z+.45};
  assert.equal(pointBlocked(player,world.colliders,.35),false,'the action fixture starts inside the current corridor');
  world.updateCrowd(.01,{position:player,floor:5,enabled:true});
  return {world,player,child,parent};
}
function tick(world,seconds,position,floor=world.floor,enabled=true,onEvent){
  for(let elapsed=0;elapsed<seconds;elapsed+=.05)world.updateCrowd(.05,{position,floor,enabled,onEvent});
}

test('both corridor actions remove their target immediately and enforce a shared cooldown',()=>{
  const {world,player,child,parent}=setup();
  const hit=world.useCorridorAction('talk',player);
  assert.equal(hit.ok,true);assert.ok(hit.actor===child.model,'talk removes the nearby child');assert.equal(hit.targetKind,'child');
  assert.equal(child.defeated,true);assert.equal(child.model.visible,false);
  assert.ok(child.respawnRemaining>=20&&child.respawnRemaining<=35);
  assert.deepEqual(world.useCorridorAction('whistle',parent.model.position),{ok:false,reason:'cooldown'});
  tick(world,1.3,player);
  const second=world.useCorridorAction('whistle',parent.model.position);
  assert.equal(second.ok,true);assert.ok(second.actor===parent.model,'whistle removes the nearby parent');
  assert.equal(parent.defeated,true);assert.equal(parent.model.visible,false);
  assert.match(second.text,/삐익/);
  assert.equal(second.kind,'whistle');
});

test('talk reaches farther than whistle while mission teachers, principal and vice are never targets',()=>{
  const {world,child}=setup();
  for(const a of world.characters.filter(a=>a.floor===5&&(a.kind==='child'||a.kind==='parent')))a.model.position.set(10,0,4.7);
  child.model.position.set(0,0,4);
  const player={x:3,z:4};
  assert.equal(pointBlocked(player,world.colliders,.35),false,'range comparison stays inside the three-metre corridor');
  assert.equal(pointBlocked(child.model.position,world.colliders,.2),false);
  assert.equal(hasLineOfSight(player,child.model.position,world.colliders),true,'range is tested without a wall intervening');
  assert.deepEqual(world.useCorridorAction('whistle',player),{ok:false,reason:'empty'});
  assert.ok(world.useCorridorAction('talk',player).actor===child.model,'talk reaches the child three metres away');
  tick(world,1.3,player);
  const npc=world.getNPC(1);
  assert.deepEqual(world.useCorridorAction('talk',npc.position),{ok:false,reason:'empty'});
  const principal=world.characters.find(a=>a.kind==='principal');
  assert.deepEqual(world.useCorridorAction('whistle',principal.model.position),{ok:false,reason:'empty'});
  assert.equal(npc.visible,true);assert.equal(principal.model.visible,true);
});

test('defeated children cannot stumble the player and only respawn after active time on their floor',()=>{
  const {world,player,child}=setup(),events=[];
  const cue=world.useCorridorAction('whistle',player);
  assert.equal(cue.text,'삐익! 복도에서는 천천히 걸어요.');
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
  assert.equal(complaints.length,1);assert.ok(complaints[0].actor===parent.model);
  assert.equal(complaints[0].duration,2);assert.equal(complaints[0].penalty,undefined);
  assert.ok([...complaints[0].text].length<=25);
  assert.ok(world.useCorridorAction('talk',player).actor===parent.model);
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
  assert.deepEqual(world.useCorridorAction('whistle',{x:-20,z:1.2}),{ok:false,reason:'empty'});
});

test('a real hiding pillar blocks a corridor action, and reset clears defeated state',()=>{
  const {world,child}=setup();
  world.characters.filter(a=>a.floor===5&&(a.kind==='child'||a.kind==='parent')).forEach(a=>a.model.position.set(10,0,4));
  const pillar=world.colliders.find(c=>c.x===4&&c.w===.5&&c.d===.5);
  assert.ok(pillar,'use the actual window-side hiding pillar');
  const z=pillar.z-.14,hiddenPlayer={x:pillar.x+.7,z};
  child.model.position.set(pillar.x-.7,0,z);
  assert.equal(pointBlocked(hiddenPlayer,world.colliders,.35),false);
  assert.equal(pointBlocked(child.model.position,world.colliders,.2),false);
  assert.equal(hasLineOfSight(hiddenPlayer,child.model.position,world.colliders),false,'the solid pillar separates two reachable corridor positions');
  assert.deepEqual(world.useCorridorAction('talk',hiddenPlayer),{ok:false,reason:'empty'});
  assert.equal(world.useCorridorAction('talk',child.model.position).ok,true);
  world.resetCrowd();
  assert.equal(child.defeated,false);assert.equal(child.model.visible,true);
  assert.equal(child.respawnRemaining,0);
});
