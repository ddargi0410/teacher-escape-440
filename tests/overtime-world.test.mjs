import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {pointBlocked} from '../crowd.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};
const world=createWorld(new THREE.Scene());
const guard=world.root.getObjectByName('overtime-security-guard');
const fixtures=floor=>world.root.getObjectByName(`overtime-lights-${floor}`).children;

test('security guard wears a navy uniform with short gray hair, distinct from the player',()=>{
  const appearance=guard.userData.appearance,player=world.createTeacher('#d9bc75');
  assert.equal(appearance.role,'security');
  assert.equal(appearance.top,'#354e6a');
  assert.equal(appearance.hair,'#a6a9a2');
  assert.equal(appearance.haircut,'crop');
  assert.notEqual(appearance.top,player.userData.appearance.top);
  assert.ok(guard.getObjectByName('hair-crop'));
});

test('corridor fixtures survive static batching and switch off one at a time after 16:40',()=>{
  world.setFloor(3);
  for(const [minutes,dark] of [[0,0],[1,1],[2,1],[3,2],[9,5],[11,6],[180,6]]){
    world.updateOvertime(minutes,0);
    for(let floor=1;floor<=5;floor++){
      const lights=fixtures(floor);
      assert.equal(lights.filter(light=>!light.userData.lit).length,dark);
      assert.equal(lights.filter(light=>light.getObjectByName('light-pool').visible).length,6-dark);
      for(const light of lights){
        const lamp=light.getObjectByName('lamp');
        assert.ok(lamp?.isMesh,'each fixture remains independently visible and mutable');
        assert.equal(lamp.material.color.getHexString(),light.userData.lit?'fff2bd':'596568');
      }
    }
  }
});

test('guard appears only in overtime on the selected floor, patrols and freezes while paused',()=>{
  world.setFloor(1);world.updateOvertime(0,1);assert.equal(guard.visible,false);
  world.updateOvertime(1,1);assert.equal(guard.visible,true);
  const initial=guard.position.clone();world.updateOvertime(1,2);
  assert.ok(guard.position.x>initial.x);
  const paused=guard.position.clone();world.updateOvertime(1,10,{active:false});
  assert.deepEqual(guard.position,paused);
  for(let floor=1;floor<=5;floor++){
    world.setFloor(floor);world.updateOvertime(20,0);
    assert.equal(guard.position.y,(floor-1)*4);
    for(let n=0;n<80;n++){
      world.updateOvertime(20,1);
      assert.ok(guard.position.x>=-10&&guard.position.x<=10);
      assert.equal(pointBlocked(guard.position,world.colliders,.35),false,'guard stays in the clear corridor');
    }
  }
  world.setFloor(null);world.updateOvertime(20,1);assert.equal(guard.visible,false);
});

test('handheld flashlight includes geometry for Canvas fallback and does not add collision blockers',()=>{
  world.setFloor(2);
  const colliders=structuredClone(world.colliders),interactables=structuredClone(world.interactables);
  world.updateOvertime(3,1);
  const beam=guard.getObjectByName('flashlight-beam'),lens=guard.getObjectByName('flashlight-lens');
  assert.ok(beam.isMesh&&beam.geometry.attributes.position.count>0);
  assert.ok(beam.material.isMeshBasicMaterial&&beam.material.transparent);
  assert.ok(beam.material.opacity>0&&beam.material.opacity<.1);
  assert.equal(beam.material.depthWrite,false);
  assert.ok(lens.isMesh&&guard.getObjectByName('flashlight-floor-pool').isMesh);
  assert.deepEqual(world.colliders,colliders);
  assert.deepEqual(world.interactables,interactables);
});

test('returning to a new day restores all lamps and hides the patrol',()=>{
  world.setFloor(5);world.updateOvertime(80,10);world.reset();
  assert.equal(guard.visible,false);
  for(let floor=1;floor<=5;floor++)assert.ok(fixtures(floor).every(light=>light.userData.lit));
  world.updateOvertime(1,0);assert.equal(guard.position.x,-10);
});
