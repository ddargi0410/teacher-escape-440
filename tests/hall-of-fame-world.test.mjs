import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {pointBlocked} from '../crowd.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};
const world=createWorld(new THREE.Scene());

test('two distinct metal monuments survive batching with physical geometry and name anchors',()=>{
  assert.deepEqual(Object.keys(world.hallOfFameStatues),['fastest','rest']);
  const expected={fastest:'running-with-briefcase',rest:'reclining-on-bed'};
  for(const [kind,statue]of Object.entries(world.hallOfFameStatues)){
    assert.equal(statue.userData.pose,expected[kind]);
    const meshes=[];statue.traverse(part=>{if(part.isMesh)meshes.push(part);});
    assert.ok(meshes.length>0&&meshes.length<=12,`bounded draw calls for ${kind}`);
    assert.ok(meshes.some(part=>part.material.metalness>.3));
    assert.ok(meshes.reduce((sum,part)=>sum+part.geometry.attributes.position.count,0)>100);
    const bounds=new THREE.Box3().setFromObject(statue),anchor=world.hallOfFameAnchors[kind];
    assert.ok(anchor.y>bounds.max.y,`${kind} label sits above sculpture`);
    assert.ok(bounds.max.z<14,'statues stop before the locked gate');
    assert.ok(bounds.min.z>9,'statues stand outside the entrance canopy');
    assert.equal(anchor.x,statue.position.x);
  }
  assert.ok(world.hallOfFameStatues.fastest.getObjectByName('honor-briefcase'));
  assert.ok(world.hallOfFameStatues.rest.getObjectByName('honor-rest-bed'));
});

test('first-floor statue bases collide without blocking the entrance, gate or mission routes',()=>{
  world.setFloor(1);
  for(const anchor of Object.values(world.hallOfFameAnchors)){
    assert.equal(pointBlocked(anchor,world.colliders,.35),true,'cannot walk through plinth');
  }
  // Walk from the unchanged spawn through the doorway and down the central path.
  const points=[world.spawn(1),{x:-5,z:7},{x:0,z:7},{x:0,z:15}];
  for(let n=1;n<points.length;n++)for(let step=0;step<=40;step++){
    const a=points[n-1],b=points[n],p={x:a.x+(b.x-a.x)*step/40,z:a.z+(b.z-a.z)*step/40};
    assert.equal(pointBlocked(p,world.colliders,.35),false,`clear path at ${p.x},${p.z}`);
  }
  assert.equal(world.interactables.filter(item=>item.missionId===10).length,1);
  for(let floor=2;floor<=5;floor++){
    world.setFloor(floor);
    assert.equal(world.colliders.some(item=>item.honorKind),false,'no new upper-floor collisions');
    assert.ok(Object.values(world.hallOfFameStatues).every(statue=>!statue.visible),'no upstairs statue draw calls');
  }
  world.setFloor(1);
  assert.ok(Object.values(world.hallOfFameStatues).every(statue=>statue.visible));
});
