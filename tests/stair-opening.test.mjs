import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {pointBlocked} from '../crowd.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};

function visibleMeshes(world){
  world.root.updateMatrixWorld(true);
  const meshes=[];
  world.root.traverseVisible(object=>{if(object.isMesh)meshes.push(object);});
  return meshes;
}

test('every central stair entry admits a player from the corridor across its width',()=>{
  const world=createWorld(new THREE.Scene());
  for(let floor=1;floor<=5;floor++){
    world.setFloor(floor);
    for(const x of [-1.3,0,1.3]){
      for(let step=0;step<=40;step++){
        const z=6.5-(6.5-2.7)*step/40;
        assert.equal(pointBlocked({x,z},world.colliders,.35),false,
          `floor ${floor}: approach blocked at x=${x}, z=${z}`);
      }
      assert.equal(pointBlocked({x,z:2.5},world.colliders,.35),false,
        `floor ${floor}: stair mouth blocked at x=${x}`);
    }
  }
});

test('visible corridor walls and decorations leave the stair mouth open on all floors',()=>{
  const world=createWorld(new THREE.Scene());
  for(let floor=1;floor<=5;floor++){
    world.setFloor(floor);
    const meshes=visibleMeshes(world),base=(floor-1)*4;
    // At this height the first steps are below the sightline. This catches a
    // wall/trim/cupboard left in the opening even if its collider was removed.
    for(const x of [-1.3,0,1.3]){
      const ray=new THREE.Raycaster(new THREE.Vector3(x,base+1.2,4.4),new THREE.Vector3(0,0,-1),0,3);
      const hits=ray.intersectObjects(meshes,false);
      assert.equal(hits.length,0,
        `floor ${floor}: visible stair entry obstruction at x=${x}, distance=${hits[0]?.distance}`);
    }
  }
});

test('the former classroom divider does not rise through the middle of the stair flights',()=>{
  const world=createWorld(new THREE.Scene());
  for(let floor=1;floor<=5;floor++){
    world.setFloor(floor);
    const ray=new THREE.Raycaster(new THREE.Vector3(-.6,(floor-1)*4+2.6,0),new THREE.Vector3(1,0,0),0,1.2);
    assert.equal(ray.intersectObjects(visibleMeshes(world),false).length,0,
      `floor ${floor}: full-height partition still crosses the stairwell`);
  }
});
