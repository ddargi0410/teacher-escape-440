import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {characterAppearance} from '../character-appearance.js';
import {createWorld} from '../world.js';
import {animateCharacter} from '../crowd.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};
const world=createWorld(new THREE.Scene());
const signature=look=>JSON.stringify([look.haircut,look.hair,look.glasses,look.top,look.pants,look.outfit,look.height,look.build]);

test('actor identities deterministically produce visibly different hair, clothes and builds',()=>{
  const looks=world.characters.map(actor=>actor.model.userData.appearance);
  assert.ok(looks.every(look=>look?.id),'each roaming actor receives its stable identity');
  for(const look of looks)assert.deepEqual(characterAppearance(look.id,look.role),look);
  const missionLooks=world.characters.filter(a=>a.missionId>0&&a.missionId<10).map(a=>a.model.userData.appearance);
  assert.equal(new Set(missionLooks.map(signature)).size,9);
  assert.equal(new Set(missionLooks.map(a=>a.haircut)).size,6);
  assert.ok(new Set(missionLooks.map(a=>a.top)).size>=4);
  for(let floor=1;floor<=5;floor++){
    const children=world.characters.filter(a=>a.kind==='child'&&a.floor===floor);
    assert.notEqual(children[0].model.userData.appearance.haircut,children[1].model.userData.appearance.haircut);
  }
  assert.equal(new Set(world.characters.filter(a=>a.kind==='parent').map(a=>signature(a.model.userData.appearance))).size,5);
});

test('principal and deputy have distinct stable silhouettes and recognizable formal clothing',()=>{
  const principal=world.characters.find(a=>a.kind==='principal').model,vice=world.characters.find(a=>a.kind==='vice').model;
  assert.equal(principal.userData.appearance.haircut,'crop');assert.equal(vice.userData.appearance.haircut,'bob');
  assert.ok(principal.getObjectByName('glasses-round'));assert.ok(vice.getObjectByName('glasses-square'));
  assert.ok(principal.userData.appearance.tie&&vice.userData.appearance.tie);
  assert.notEqual(principal.userData.appearance.top,vice.userData.appearance.top);
});

test('variation preserves outer actor scales, limb animation, head clearance and a small mesh budget',()=>{
  for(const actor of world.characters){
    const model=actor.model,body=model.getObjectByName('character-body'),look=model.userData.appearance;
    assert.equal(model.scale.x,actor.kind==='child'?.64:1);
    assert.equal(model.scale.y,actor.kind==='child'?.64:1);
    assert.equal(body.scale.x,look.build);assert.equal(body.scale.y,look.height);
    assert.equal(model.userData.legs.length,2);assert.equal(model.userData.arms.length,2);
    assert.ok([...model.userData.legs,...model.userData.arms].every(limb=>limb.parent===body));
    animateCharacter(model,Math.PI/2,1);assert.ok(model.userData.legs[0].rotation.x>0);assert.ok(model.userData.arms[0].rotation.x<0);
    animateCharacter(model,0,0);assert.ok([...model.userData.legs,...model.userData.arms].every(limb=>Math.abs(limb.rotation.x)<1e-8));
    model.updateWorldMatrix(true,true);
    const bounds=new THREE.Box3().setFromObject(body),anchor=world.getCharacterAnchor(model);
    assert.ok(anchor.y>=bounds.max.y,'speech bubble stays above taller hair');
    let meshes=0;model.traverse(node=>{if(node.isMesh)meshes++;});assert.ok(meshes<=40,`${actor.id} uses ${meshes} small meshes`);
  }
});

test('repeated remote identities and resets retain their look, default teacher keeps requested color and scale',()=>{
  const first=world.createTeacher('#123456',{id:'peer-example',role:'teacher'}),second=world.createTeacher('#123456',{id:'peer-example',role:'teacher'});
  assert.deepEqual(first.userData.appearance,second.userData.appearance);
  const local=world.createTeacher('#123456');assert.equal(local.userData.appearance.top,'#123456');assert.equal(local.getObjectByName('character-body').scale.y,1);
  const before=world.characters.map(a=>signature(a.model.userData.appearance));world.resetCrowd();
  assert.deepEqual(world.characters.map(a=>signature(a.model.userData.appearance)),before);
});
