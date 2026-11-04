import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {pointBlocked} from '../crowd.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};
const makeWorld=()=>createWorld(new THREE.Scene());
function clearPath(world,points){
  for(let segment=1;segment<points.length;segment++){
    const a=points[segment-1],b=points[segment];
    for(let step=0;step<=60;step++){
      const p={x:a.x+(b.x-a.x)*step/60,z:a.z+(b.z-a.z)*step/60};
      assert.equal(pointBlocked(p,world.colliders,.35),false,`blocked walking path at ${p.x},${p.z}`);
    }
  }
}

test('both optional rooms and beds are first-floor spaces, separate from the ten missions',()=>{
  const world=makeWorld();world.setFloor(1);
  assert.deepEqual(world.specialRooms.map(r=>r.id),['learning-room','nurse-room']);
  assert.ok(world.specialRooms.every(r=>r.floor===1));
  assert.equal(world.interactables.filter(i=>i.kind==='bed').length,5);
  assert.equal(world.interactables.filter(i=>i.kind==='learning').length,1);
  const missionIds=[];
  for(let floor=1;floor<=5;floor++){
    world.setFloor(floor);
    missionIds.push(...world.interactables.filter(i=>i.missionId).map(i=>i.missionId));
    if(floor>1){
      assert.equal(world.interactables.some(i=>i.kind==='bed'||i.kind==='learning'),false);
      assert.equal(world.bounds.maxX,13.6);
    }
  }
  assert.deepEqual(missionIds.sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,10]);
});

test('doorways, fast-travel entries and each bed approach are walkable without teleporting through walls',()=>{
  const world=makeWorld();world.setFloor(1);
  for(const room of world.specialRooms){
    clearPath(world,[{x:0,z:4.7},{x:room.entry.x,z:4.7},room.entry]);
    assert.equal(pointBlocked(room.entry,world.colliders,.35),false);
  }
  const nurse=world.specialRooms.find(r=>r.kind==='nurse');
  for(const id of ['bed-1','bed-2','bed-3','bed-4','bed-5']){
    const bed=world.getBed(id);
    clearPath(world,[nurse.entry,{x:bed.x,z:nurse.entry.z},bed.exitPoint]);
    assert.equal(pointBlocked({x:bed.bedPose.x,z:-1.6},world.colliders,.35),true);
  }
});

test('expanded first-floor bounds do not open a route around the locked school gate',()=>{
  const world=makeWorld();world.setFloor(1);
  assert.equal(world.bounds.maxX,25.7);
  for(const side of [-1,1]){
    assert.equal(pointBlocked({x:side*20,z:8},world.colliders,.35),true);
    assert.equal(pointBlocked({x:side*20,z:16},world.colliders,.35),true);
    assert.equal(pointBlocked({x:side*25.3,z:25},world.colliders,.35),true);
    assert.equal(pointBlocked({x:side*14,z:1},world.colliders,.35),true);
  }
  assert.equal(pointBlocked({x:0,z:16},world.colliders,.35),true);
  world.openGate();
  assert.equal(pointBlocked({x:0,z:16},world.colliders,.35),false);
});

test('all five beds have separate face-up resting poses that can be cleared for walking',()=>{
  const world=makeWorld(),model=world.createTeacher();
  assert.equal(world.setRestPose(model,'missing'),false);
  const xPositions=[];
  for(let n=1;n<=5;n++){
    const bed=world.getBed(`bed-${n}`);
    xPositions.push(bed.bedPose.x);
    assert.equal(world.setRestPose(model,bed.id),true);
    assert.equal(model.userData.restingBed,bed.id);
    assert.equal(model.rotation.x,-Math.PI/2);
    const head=model.localToWorld(new THREE.Vector3(0,1.82,.33));
    assert.ok(Math.abs(head.x-bed.bedPose.x)<.01);
    assert.ok(head.y>1.1);
    assert.ok(head.z< -1.9&&head.z> -2.2);
    world.clearRestPose(model);
    assert.equal(model.rotation.x,0);
    assert.equal(model.rotation.z,0);
    assert.equal(model.userData.restingBed,undefined);
  }
  assert.equal(new Set(xPositions).size,5);
});


test('side posture keeps the body along the bed and resets completely when standing',()=>{
  const world=makeWorld(),model=world.createTeacher();world.setFloor(1);
  assert.equal(world.setRestPose(model,'bed-3','side'),true);
  const bed=world.getBed('bed-3'),head=model.localToWorld(new THREE.Vector3(0,1.82,.33));
  assert.ok(Math.abs(head.x-bed.bedPose.x)<.5);assert.ok(head.z< -1.9&&head.z> -2.2);
  assert.ok(model.position.y>bed.bedPose.y);assert.equal(model.userData.restPosture,'side');
  world.clearRestPose(model);assert.equal(model.rotation.y,0);assert.equal(model.userData.restPosture,undefined);
  assert.ok(model.userData.legs.every(leg=>Math.abs(leg.rotation.x)<.0001));
});

test('all five floors expose central stairs and no elevator interaction',()=>{
  const world=makeWorld();
  for(let floor=1;floor<=5;floor++){
    world.setFloor(floor);const stair=world.interactables.find(i=>i.kind==='stairs');
    assert.ok(stair);assert.equal(stair.floor,floor);assert.equal(pointBlocked(stair,world.colliders,.35),false);
    assert.equal(world.interactables.some(i=>i.id==='elevator'),false);
  }
});
