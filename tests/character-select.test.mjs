import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {AVATAR_PRESETS,DEFAULT_AVATAR_ID,normalizeAvatarId,getAvatarAppearance} from '../character-appearance.js';
import {createTeacherModel,applyTeacherAppearance} from '../character-model.js';
import {createCharacterPicker,avatarPortrait} from '../character-picker.js';
import {freshState,loadGame,saveGame} from '../save.js';
import {animateCharacter} from '../crowd.js';
import {createDocument} from './dom-stub.mjs';

test('six selectable looks are distinct and malformed saved choices safely fall back',()=>{
  assert.equal(AVATAR_PRESETS.length,6);
  assert.equal(new Set(AVATAR_PRESETS.map(p=>p.id)).size,6);
  assert.equal(new Set(AVATAR_PRESETS.map(p=>p.haircut)).size,6);
  for(const invalid of [null,undefined,'<img onerror=1>',{},'missing'])assert.equal(normalizeAvatarId(invalid),DEFAULT_AVATAR_ID);
  const appearance=getAvatarAppearance('coffee');appearance.top='changed';assert.notEqual(getAvatarAppearance('coffee').top,'changed');
  assert.equal(avatarPortrait('<img onerror=1>').includes('onerror'),false);
});

test('avatar choice round-trips without changing old progress or inventing completion',()=>{
  const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const state=freshState('오늘도교사');state.avatarId='lavender';state.completed=[1,2,3];state.elapsed=154;state.floor=3;
  assert.equal(saveGame(state),true);assert.equal(loadGame().avatarId,'lavender');assert.deepEqual(loadGame().completed,[1,2,3]);
  assert.equal(loadGame().elapsed,154);
  const old={...state};delete old.avatarId;assert.equal(saveGame(old),true);assert.equal(loadGame().avatarId,DEFAULT_AVATAR_ID);
  old.avatarId='invalid';assert.equal(saveGame(old),true);assert.equal(loadGame().avatarId,DEFAULT_AVATAR_ID);
});

test('articulated teacher presets keep a small shared mesh budget and reachable pose joints',()=>{
  for(const preset of AVATAR_PRESETS){
    const model=createTeacherModel({identity:{avatarId:preset.id}}),rig=model.userData;
    assert.equal(rig.appearance.avatarId,preset.id);
    assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);
    assert.ok(rig.forearms.every((joint,i)=>joint.parent===rig.arms[i]));
    assert.ok(rig.shins.every((joint,i)=>joint.parent===rig.legs[i]));
    assert.equal(rig.head.parent,rig.body);assert.equal(rig.body.name,'character-body');
    animateCharacter(model,Math.PI/2,1);assert.ok(rig.arms[0].rotation.x<0);assert.ok(rig.legs[0].rotation.x>0);
    animateCharacter(model,0,0);model.updateWorldMatrix(true,true);
    const bounds=new THREE.Box3().setFromObject(model);
    assert.ok(bounds.min.y>=-.02);assert.ok(bounds.max.y<rig.headHeight);
    let meshes=0,triangles=0;model.traverse(node=>{if(node.isMesh){meshes++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});
    assert.ok(meshes<=24,`${preset.id}: ${meshes} meshes`);assert.ok(triangles<=2300,`${preset.id}: ${triangles} triangles`);
  }
  const a=createTeacherModel({identity:{avatarId:'mellow'}}),b=createTeacherModel({identity:{avatarId:'mellow'}});
  assert.equal(a.userData.head.children.find(n=>n.isMesh).geometry,b.userData.head.children.find(n=>n.isMesh).geometry);
});

test('changing appearance preserves the world model identity, location and external attachments',()=>{
  const model=createTeacherModel({identity:{avatarId:'mellow'}}),oldBody=model.userData.body,attachment=new THREE.Group();
  model.add(attachment);model.position.set(20,0,4);model.rotation.y=1.3;model.scale.setScalar(.9);
  assert.equal(applyTeacherAppearance(model,'indigo'),true);
  assert.equal(model.userData.appearance.avatarId,'indigo');assert.equal(oldBody.parent,null);
  assert.equal(model.children.includes(attachment),true);assert.deepEqual(model.position.toArray(),[20,0,4]);
  assert.equal(model.rotation.y,1.3);assert.equal(model.scale.x,.9);assert.equal(model.children.filter(n=>n.name==='character-body').length,1);
  const body=model.userData.body;applyTeacherAppearance(model,'indigo');assert.equal(model.userData.body,body);
});

test('picker radios reflect selection, report exact preset IDs and dispose event handlers',()=>{
  const doc=createDocument(),create=doc.createElement;
  doc.createElement=tag=>{const node=create(tag);node.remove=()=>{node.parentNode.children=node.parentNode.children.filter(child=>child!==node);};return node;};
  globalThis.document=doc;const container=doc.createElement('div'),changes=[];
  const picker=createCharacterPicker({container,value:'coffee',onChange:id=>changes.push(id)});
  const inputs=container.querySelectorAll('input[type="radio"]');assert.equal(inputs.length,6);
  assert.equal(inputs.filter(i=>i.checked).length,1);assert.equal(picker.getValue(),'coffee');
  const sunny=inputs.find(i=>i.value==='sunny');sunny.checked=true;sunny.onchange();
  assert.deepEqual(changes,['sunny']);assert.equal(inputs.filter(i=>i.checked).length,1);assert.equal(picker.getValue(),'sunny');
  picker.setValue('forest');assert.equal(inputs.find(i=>i.value==='forest').checked,true);assert.deepEqual(changes,['sunny']);
  picker.dispose();assert.equal(container.children.length,0);assert.equal(sunny.onchange,null);
});
