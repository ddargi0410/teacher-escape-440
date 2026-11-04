import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {pointBlocked} from '../crowd.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};

test('first-floor arrival is clear of the entrance canopy and connected to the stairs',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(1);
  const spawn=world.spawn(1);
  assert.ok(Math.abs(spawn.x)>3.6+.35,'player starts beside the canopy footprint');
  // Walk around the existing corridor pillar before turning toward the stairs.
  const route=[spawn,{x:spawn.x,z:4.7},{x:0,z:4.7}];
  for(let i=1;i<route.length;i++)for(let step=0;step<=60;step++){
    const t=step/60,a=route[i-1],b=route[i];
    assert.equal(pointBlocked({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},world.colliders,.35),false);
  }
  for(let floor=2;floor<=5;floor++)assert.deepEqual(world.spawn(floor),{x:0,y:(floor-1)*4,z:6.5});
});

test('school detail surfaces are shared, opaque and supported by the software renderer',()=>{
  const world=createWorld(new THREE.Scene()),textures=new Map();
  world.root.traverse(object=>{
    if(!object.isMesh)return;
    assert.equal(object.isInstancedMesh,undefined);
    const texture=object.material.map;
    if(texture?.name){
      const existing=textures.get(texture.name);
      if(existing)assert.equal(texture,existing,`${texture.name} should reuse its canvas`);
      textures.set(texture.name,texture);
      assert.equal(object.material.transparent,false);
    }
  });
  for(const key of ['terrazzo-corridor','corridor-clock','school-noticeboard','fire-extinguisher','cleaning-cupboard','school-entrance'])assert.ok(textures.has(key),key);
  assert.equal([...textures.keys()].filter(key=>key.startsWith('room-number-')).length,10);
});

test('new door and corridor details leave all ten room approaches and the main exit open',()=>{
  const world=createWorld(new THREE.Scene());
  for(let floor=1;floor<=5;floor++){
    world.setFloor(floor);
    for(const x of [-7,7])for(let step=0;step<=60;step++){
      const z=4.7-(4.7+2.2)*step/60;
      assert.equal(pointBlocked({x,z},world.colliders,.35),false,`floor ${floor}, x ${x}, z ${z}`);
    }
  }
  world.setFloor(1);world.openGate();
  for(let z=8;z<=22;z+=.1)assert.equal(pointBlocked({x:0,z},world.colliders,.35),false,`exit at ${z}`);
  assert.equal(pointBlocked({x:3.35,z:10.55},world.colliders,.35),true,'canopy support matches its collider');
});

test('static details keep the active top floor within a modest mesh and triangle budget',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(5);
  let meshes=0,triangles=0;
  world.root.traverseVisible(object=>{if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;}});
  // Existing NPC meshes account for most calls; no per-tile/per-fleck meshes.
  assert.ok(meshes<350,`${meshes} active meshes`);
  assert.ok(triangles<19000,`${triangles} active triangles`);
});
