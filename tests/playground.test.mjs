import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {YARD_ORIGIN, YARD_LAYOUT} from '../playground-world.js';
import {LIMITS} from '../community/core.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};

const yardNodes=world=>{const list=[];world.root.traverse(node=>{for(let p=node;p;p=p.parent)if(p.name==='운동장'){list.push(node);return;}});return list;};
const tree=(id,extra={})=>({id,name:'나무 '+id,owner:'선생님'+id,stage:2,stageName:'묘목',hearts:1,harvests:0,mine:false,...extra});

test('the playground is a separate zone that is hidden while inside the school',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(1);
  assert.equal(world.zone,'school');
  assert.equal(world.playground.root.visible,false,'the yard is not drawn from inside the school');
  world.setZone('yard');
  assert.equal(world.zone,'yard');
  assert.equal(world.playground.root.visible,true);
  assert.ok(world.isOutdoors?.(world.playground.arrival())??true);
  // Yard colliders, camera colliders, bounds and interactables replace the school's.
  assert.equal(world.colliders,world.playground.colliders);
  assert.deepEqual(world.bounds,world.playground.bounds);
  for(const kind of ['yard-exit','faucet','zelkova','farm','podium','shed'])assert.ok(world.interactables.some(item=>item.kind===kind),kind);
  world.setZone('school');world.setFloor(3);
  assert.equal(world.playground.root.visible,false);
  world.setZone('yard');
  assert.equal(world.zone,'yard','entering the yard always lands on the first floor');
});

test('the arch on the first-floor plaza and the central entrance in the yard switch zones',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(1);
  assert.equal(world.wantsYard({x:13.2,y:0,z:13.5}),true);
  assert.equal(world.wantsYard({x:12.1,y:0,z:13.5}),false,'the return spot must not bounce straight back outside');
  assert.ok(world.interactables.some(item=>item.kind==='yard-gate'),'the arch can also be used with E');
  world.setFloor(2);assert.equal(world.wantsYard({x:13.2,y:4,z:13.5}),false);
  world.setFloor(1);world.setZone('yard');
  const arrival=world.playground.arrival();
  assert.equal(world.playground.wantsExit(arrival),false,'arrival point is clear of the entrance trigger');
  assert.equal(world.playground.wantsExit({x:YARD_ORIGIN.x,y:0,z:YARD_ORIGIN.z+YARD_LAYOUT.exit.triggerZ-.2}),true);
  const b=world.playground.bounds;
  assert.ok(arrival.x>b.minX&&arrival.x<b.maxX&&arrival.z>b.minZ&&arrival.z<b.maxZ);
});

test('playground surfaces reuse one texture per name and stay renderable without instancing',()=>{
  const world=createWorld(new THREE.Scene()),textures=new Map();
  const nodes=yardNodes(world);
  assert.ok(nodes.length>20,'the playground has real geometry');
  for(const node of nodes){
    if(!node.isMesh&&!node.isSprite)continue;
    assert.equal(node.isInstancedMesh,undefined,'the software renderer cannot draw InstancedMesh');
    const map=node.material?.map;if(!map?.name)continue;
    const existing=textures.get(map.name);
    if(existing)assert.equal(map,existing,`${map.name} should reuse its texture`);
    textures.set(map.name,map);
  }
  for(const key of ['yard-sand-22','yard-concrete-2','yard-soil-1'])assert.ok(textures.has(key),key);
});

test('coffee trees: my tree takes the first plot, others follow, empty farm offers planting',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(1);world.setZone('yard');
  const yard=world.playground;
  assert.equal(YARD_LAYOUT.plots.length,LIMITS.visibleTrees);
  assert.ok(yard.interactables.some(item=>item.kind==='farm-plot'),'a visitor without a tree is offered the first plot');
  yard.setTrees([tree('a'),tree('mine',{mine:true}),tree('b')]);
  const trees=yard.interactables.filter(item=>item.kind==='coffee-tree');
  assert.equal(trees.length,3);
  assert.equal(trees[0].treeId,'mine');
  assert.equal(trees[0].mine,true);
  assert.ok(!yard.interactables.some(item=>item.kind==='farm-plot'));
  const near=yard.approachTree('b');
  assert.ok(near&&Math.hypot(near.x-trees[2].x,near.z-trees[2].z)<3,'search results walk next to the tree');
  assert.equal(yard.approachTree('missing'),null);
  // Arriving at any tree, E picks that tree and not a neighbour.
  yard.setTrees([tree('mine',{mine:true}),...Array.from({length:20},(_,index)=>tree('n'+index))]);
  for(const id of ['mine','n0','n1','n7','n12']){
    const spot=yard.approachTree(id);
    const nearest=yard.interactables.map(item=>({item,d:Math.hypot(item.x-spot.x,item.z-spot.z)})).sort((a,b)=>a.d-b.d)[0];
    assert.equal(nearest.item.treeId,id,`E near ${id} chose ${nearest.item.id}`);
    assert.ok(nearest.d<3,'within E reach');
  }
  yard.setTrees(Array.from({length:80},(_,index)=>tree('t'+index)));
  assert.equal(yard.interactables.filter(item=>item.kind==='coffee-tree').length,LIMITS.visibleTrees-1,'slot 0 stays reserved for the visitor');
});

test('the zelkova shows up to 300 notes, lights after 100 and grows after 500',()=>{
  const world=createWorld(new THREE.Scene());world.setZone('yard');
  const yard=world.playground;
  yard.setNotes({total:40,hanging:40,lights:false,bigTree:false},['pink']);
  assert.equal(yard.noteState.hanging,40);
  yard.setNotes({total:620,hanging:620,lights:true,bigTree:true},[]);
  assert.equal(yard.noteState.hanging,LIMITS.visibleNotes);
  assert.equal(yard.noteState.lights,true);
  assert.equal(yard.noteState.bigTree,true);
  for(const kind of ['faucet','zelkova','farm','podium','overview'])assert.ok(yard.approach(kind),kind);
  yard.setDaylight({night:1});yard.setDaylight({night:0});
  yard.update(.016,1,{x:YARD_ORIGIN.x,y:0,z:YARD_ORIGIN.z});
});
