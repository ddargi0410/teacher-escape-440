import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {pointBlocked} from '../crowd.js';
import {keepCameraClear} from '../camera-rig.js';

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
  for(let floor=2;floor<=5;floor++)assert.deepEqual(world.spawn(floor),{x:0,y:(floor-1)*4,z:4.65});
});

test('school detail surfaces are shared, opaque and supported by the software renderer',()=>{
  const world=createWorld(new THREE.Scene()),textures=new Map();
  world.root.traverse(object=>{
    if(!object.isMesh)return;
    assert.equal(object.isInstancedMesh,undefined);
    // The playground has its own checks (tests/playground.test.mjs): it needs see-through goal nets and fences.
    for(let node=object;node;node=node.parent)if(node.name==='운동장')return;
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
    for(const item of world.interactables.filter(i=>i.missionId)){
      const approach=world.getApproachPoint(item);
      for(let step=0;step<=60;step++){
        const z=4.7+(approach.z-4.7)*step/60;
        assert.equal(pointBlocked({x:approach.x,z},world.colliders,.35),false,`floor ${floor}, mission ${item.missionId}, z ${z}`);
      }
    }
  }
  world.setFloor(1);world.openGate();
  for(let z=8;z<=22;z+=.1)assert.equal(pointBlocked({x:0,z},world.colliders,.35),false,`exit at ${z}`);
  assert.equal(pointBlocked({x:3.35,z:10.55},world.colliders,.35),true,'canopy support matches its collider');
});

test('complete school shell and articulated characters stay within a bounded top-floor budget',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(5);
  let meshes=0,triangles=0;
  world.root.traverseVisible(object=>{if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;}});
  // A real ceiling and all five exterior floors remain visible in close third
  // person. Jointed characters replace the earlier single-block limbs. Static
  // flecks still cost no geometry, and the separate infirmary culls upstairs.
  assert.ok(meshes<480,`${meshes} active meshes`);
  assert.ok(triangles<32000,`${triangles} active triangles`);
});


test('eye-level play retains ceilings and window openings with cached camera barriers',()=>{
  const world=createWorld(new THREE.Scene());
  for(let floor=1;floor<=5;floor++){
    world.setFloor(floor);
    const barriers=world.cameraColliders,base=(floor-1)*4;
    assert.equal(barriers,world.cameraColliders,'camera queries reuse the cached array');
    assert.ok(barriers.some(c=>c.w>28&&c.minY===base+3&&c.maxY<base+3.2),'ceiling slab stops the orbit camera');
    assert.ok(barriers.some(c=>c.x===-7&&c.z===2.59&&c.minY>base+2.3),'open classroom door has a real overhead transom');
    const origin=new THREE.Vector3(-11.0,base+1.98,4.9),ray=new THREE.Raycaster(origin,new THREE.Vector3(0,0,1),0,2);
    world.root.updateMatrixWorld(true);
    const geometry=[];world.root.traverseVisible(o=>{if(o.isMesh)geometry.push(o);});
    const hits=ray.intersectObjects(geometry,false).filter(hit=>hit.point.z>5.5&&hit.point.z<6.1);
    assert.ok(hits.length>0&&hits.every(hit=>hit.object.material.name==='school-window-glass'&&hit.object.material.transparent&&hit.object.material.opacity<.1&&!hit.object.material.map),'ordinary window is see-through glass, not an opaque photograph');
  }
  const nurse=world.root.getObjectByName('lake-infirmary');
  assert.equal(nurse.visible,false,'detailed first-floor refuge culls upstairs');
  world.setFloor(1);assert.equal(nurse.visible,true);
});


test('rooms measure eight by nine metres and the corridor and ceiling measure three',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(5);
  assert.deepEqual(world.dimensions,{classroom:{width:8,depth:9},corridorWidth:3,ceilingHeight:3});
  for(const cx of [-7,7]){
    const left=world.colliders.find(c=>Math.abs(c.x-(cx-4.09))<.001&&c.d>9);
    const right=world.colliders.find(c=>Math.abs(c.x-(cx+4.09))<.001&&c.d>9);
    const rear=world.colliders.find(c=>Math.abs(c.x-cx)<.001&&c.z===-6.59);
    const front=world.colliders.find(c=>c.z===2.59&&Math.abs(c.x-cx)<4);
    assert.ok(Math.abs((right.x-right.w/2)-(left.x+left.w/2)-8)<1e-9);
    assert.ok(Math.abs((front.z-front.d/2)-(rear.z+rear.d/2)-9)<1e-9);
    const outer=world.colliders.find(c=>c.z===5.8);
    assert.ok(Math.abs((outer.z-outer.d/2)-(front.z+front.d/2)-3)<1e-9);
  }
  const geometry=[];world.root.updateMatrixWorld(true);world.root.traverseVisible(o=>{if(o.isMesh)geometry.push(o);});
  const ray=new THREE.Raycaster(new THREE.Vector3(-7,17,0),new THREE.Vector3(0,1,0),0,5);
  assert.ok(Math.abs(ray.intersectObjects(geometry,false)[0].point.y-19)<.001,'actual ceiling underside is 3m above floor5');
});

test('overview lifts the ceiling and lake scenery only appears from inside the infirmary',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(1);world.setCameraMode('shoulder');
  const shell=world.root.getObjectByName('infirmary-cutaway-shell'),view=world.root.getObjectByName('infirmary-lake-view');
  assert.equal(view.visible,false,'a first-floor corridor view does not reveal the large backdrop');
  world.setViewPosition({x:20,y:2,z:3});
  assert.equal(shell.visible,true);assert.equal(view.visible,true);
  world.setCameraMode('overview');assert.equal(shell.visible,false);assert.equal(view.visible,false);
  world.setCameraMode('first');assert.equal(shell.visible,true);assert.equal(view.visible,true);
  for(const position of [{x:0,y:2,z:12},{x:28,y:2,z:3},{x:20,y:7,z:3}]){
    world.setViewPosition(position);assert.equal(view.visible,false,'outdoor and upstairs cameras never see the backdrop');
  }
  for(const id of [1,2,3,4,5]){
    const bed=world.getBed(`bed-${id}`);assert.ok(bed);
    world.setViewPosition(bed.cameraPose.position);assert.equal(view.visible,true,`rest camera for bed ${id} retains its lake view`);
  }
  world.setFloor(null);assert.equal(view.visible,false);
  world.setFloor(1);world.setQuality('low');
  const patches=[];world.root.traverse(o=>{if(o.name==='window-sun-patch')patches.push(o);});
  assert.ok(patches.length>0&&patches.every(p=>!p.visible));
  world.setQuality('medium');assert.ok(patches.every(p=>p.visible));
});

test('the closed school gate keeps the follow camera in the front yard',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(1);
  const from=new THREE.Vector3(0,1.35,12.5),desired=new THREE.Vector3(.48,1.99,17.05),safe=new THREE.Vector3();
  const closed=world.cameraColliders;
  assert.equal(closed,world.cameraColliders,'closed-gate camera barriers are cached');
  assert.ok(keepCameraClear(from,desired,closed,safe)<1);
  assert.ok(safe.z<15.7,'gate bars do not cover the camera foreground');
  world.openGate();
  assert.equal(keepCameraClear(from,desired,world.cameraColliders,safe),1,'opening the gate releases the camera as well as the player');
  for(const kind of ['staff','copier']){
    const view=world.getRoomView(kind);world.setFloor(view.floor);
    assert.equal(pointBlocked(view.position,world.colliders,.35),false,`${kind} inspection starts in a walkable aisle`);
  }
});


test('all school canvas textures stay within the 1024 pixel budget',()=>{
  const world=createWorld(new THREE.Scene());
  world.root.traverse(object=>{
    for(const material of [object.material].flat().filter(Boolean))for(const key of ['map','emissiveMap']){
      const image=material[key]?.image;if(!image)continue;
      assert.ok(image.width<=1024&&image.height<=1024,`${material.name} ${key}: ${image.width}x${image.height}`);
    }
  });
});

test('transparent windows expose a three-dimensional Korean apartment neighborhood',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(3);
  const neighborhood=world.root.getObjectByName('korean-apartment-neighborhood');
  assert.ok(neighborhood);assert.equal(neighborhood.children.length,7);
  assert.ok(neighborhood.children.every(b=>b.userData.environmentOnly&&b.userData.floors>=10));
  const views=[];world.root.traverse(o=>{if(o.name==='ordinary-window-glass')views.push(o);assert.notEqual(o.name,'ordinary-window-view');});
  assert.equal(views.reduce((sum,v)=>sum+(v.userData.paneCount||1),0),34);
  assert.equal(views.length,5,'coplanar window panes batch to one draw per floor');
  const position=world.getRoomView('window').position;assert.equal(pointBlocked(position,world.colliders,.35),false);
  const solid=[];world.root.updateMatrixWorld(true);world.root.traverseVisible(o=>{if(o.isMesh&&!o.material.transparent)solid.push(o);});
  const ray=new THREE.Raycaster(new THREE.Vector3(3,9.65,6),new THREE.Vector3(0,0,1),0,80);
  assert.ok(ray.intersectObjects(solid,false).some(hit=>hit.object.material.name.startsWith('apartment-')),'apartments exist beyond the school courtyard rather than on a window plane');
});

test('outdoor apartments become dark at night while their windows glow and sunlight vanishes',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(3);
  const facade=[];world.root.traverse(o=>{if(o.isMesh&&o.material.name==='apartment-glazed-balconies')facade.push(o.material);});
  assert.ok(facade.length);
  world.setDaylight({night:0,window:new THREE.Color('#ffffff')});const day=facade[0].color.clone();
  assert.equal(facade[0].emissiveIntensity,0);
  world.setDaylight({night:1,window:new THREE.Color('#2a3352')});
  assert.ok(facade[0].color.r<day.r*.25);assert.ok(facade[0].emissiveIntensity>.5);
  const patches=[];world.root.traverse(o=>{if(o.name==='window-sun-patch')patches.push(o);});
  assert.ok(patches.every(p=>!p.visible&&p.material.opacity===0));
  world.setQuality('low');world.setDaylight({night:0,window:new THREE.Color('#ffffff')});
  assert.ok(patches.every(p=>!p.visible),'daylight cannot re-enable sunlight in low graphics');
  world.setQuality('medium');assert.ok(patches.every(p=>p.visible));
});
