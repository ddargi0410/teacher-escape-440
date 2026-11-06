import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {pointBlocked} from '../crowd.js';
import {AVATAR_PRESETS} from '../character-appearance.js';

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
    clearPath(world,[nurse.entry,...bed.approachPath]);
    assert.equal(pointBlocked(bed.center,world.colliders,.35),true);
    assert.equal(pointBlocked(bed.exitPoint,world.colliders,.35),false);
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
    assert.ok(head.z<bed.center.z-1.0&&head.z>bed.center.z-1.4);
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
  assert.ok(Math.abs(head.x-bed.bedPose.x)<.5);assert.ok(head.z<bed.center.z-1.0&&head.z>bed.center.z-1.4);
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


test('infirmary has ordinary raised windows and spacious two-row beds',()=>{
  const world=makeWorld();world.setFloor(1);
  const bedList=[1,2,3,4,5].map(n=>world.getBed(`bed-${n}`));
  assert.equal(new Set(bedList.map(b=>b.center.z)).size,2);
  for(const a of bedList)for(const b of bedList){
    if(a===b)continue;
    if(a.center.z===b.center.z)assert.ok(Math.abs(a.center.x-b.center.x)-a.mattress.width>=1.8,'wide side aisle');
    else assert.ok(Math.abs(a.center.z-b.center.z)-a.mattress.depth>=2.3,'wide cross aisle');
  }
  assert.ok(world.root.getObjectByName('lake-infirmary'));
  const flowers=[];world.root.traverse(node=>{if(node.name==='indoor-flower-pot')flowers.push(node);});
  assert.ok(flowers.length>=5,'multiple real indoor flowering plants');
  assert.ok(world.root.getObjectByName('infirmary-lake-view'));
  const windows=[];world.root.traverse(node=>{if(node.name==='infirmary-window')windows.push(node.userData.window);});
  assert.equal(windows.length,3);
  assert.ok(windows.every(window=>window.sill>=1&&window.height<1.8&&window.top<2.9),'normal school windows, not floor-to-ceiling glass');
});

test('each close rest camera stays inside the room and sees toward the lake',()=>{
  const world=makeWorld();world.setFloor(1);
  for(let n=1;n<=5;n++){
    const bed=world.getBed(`bed-${n}`),{position,target}=bed.cameraPose;
    assert.ok(position.x>14.3&&position.x<25.6);
    assert.ok(position.z>-7.4&&position.z<7.5);
    assert.ok(position.y>1.8&&position.y<2.7);
    assert.ok(target.y>1.2&&target.y<1.5);
    assert.ok(target.z<position.z-3,'looks beyond head toward north windows');
    const distance=new THREE.Vector3(position.x,position.y,position.z).distanceTo(new THREE.Vector3(target.x,target.y,target.z));
    assert.ok(distance>3.5&&distance<5.5,'near third-person framing');
  }
});

test('natural sleeping joints fit each mattress and reset without breathing drift',()=>{
  const world=makeWorld(),model=world.createTeacher();world.setFloor(1);
  const body=model.userData.body,baseScale=body.scale.clone();
  for(let n=1;n<=5;n++)for(const posture of ['back','side']){
    const bed=world.getBed(`bed-${n}`);world.setRestPose(model,bed.id,posture);model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);
    assert.ok(bounds.min.x>=bed.center.x-bed.mattress.width/2-.1&&bounds.max.x<=bed.center.x+bed.mattress.width/2+.1,'body stays on mattress');
    assert.ok(bounds.min.z>=bed.center.z-bed.mattress.depth/2-.18&&bounds.max.z<=bed.center.z+bed.mattress.depth/2+.1,'head and feet stay on mattress');
    assert.ok(model.userData.forearms.some(elbow=>Math.abs(elbow.rotation.x)>.1),'elbows comfortably bent');
    assert.ok(model.userData.shins.some(knee=>Math.abs(knee.rotation.x)>.04),'knees softly bent');
    for(let tick=0;tick<30;tick++)world.updateResting(1/60,tick*.2);
    assert.ok(Math.abs(body.scale.z-baseScale.z)<.02,'breathing is bounded');
    world.clearRestPose(model);
    assert.deepEqual(body.scale.toArray(),baseScale.toArray());
    for(const limb of [...model.userData.forearms,...model.userData.shins])assert.ok(limb.rotation.toArray().slice(0,3).every(v=>Math.abs(v)<.00001));
  }
});


test('occupied bedding drapes onto the mattress and bed numbers cannot overlay a sleeping face',()=>{
  const world=makeWorld(),model=world.createTeacher();world.setFloor(1);
  const bed=world.getBed('bed-4'),duvet=world.root.getObjectByName('rest-duvet-4'),marker=world.root.getObjectByName('rest-bed-marker-4');
  assert.equal(marker.material.depthTest,true);assert.equal(marker.visible,true);
  const flat=duvet.userData.cloth.geometry;
  world.setRestPose(model,bed.id);
  assert.equal(marker.visible,false);assert.notEqual(duvet.userData.cloth.geometry,flat);
  const points=duvet.userData.cloth.geometry.attributes.position;
  let edgeMax=-Infinity,bodyMax=-Infinity,edgeMin=Infinity;
  for(let n=0;n<points.count;n++){
    const y=points.getY(n)+duvet.position.y;
    if(Math.abs(points.getX(n))>.9){edgeMax=Math.max(edgeMax,y);edgeMin=Math.min(edgeMin,y);}
    else bodyMax=Math.max(bodyMax,y);
  }
  assert.ok(edgeMax<=bed.mattress.top+.1,'cloth edges remain on mattress');
  assert.ok(edgeMin<=bed.mattress.top,'closed cloth edge reaches mattress');
  assert.ok(bodyMax>1.35&&bodyMax<1.5,'soft body-shaped mound above legs');
  world.clearRestPose(model);assert.equal(marker.visible,true);assert.equal(duvet.userData.cloth.geometry,flat);
});


test('real avatar hands rest below the chest and footwear stays under the quilt in either pose',()=>{
  const world=makeWorld();world.setFloor(1);
  for(const avatar of AVATAR_PRESETS){
    const model=world.createTeacher('#fff',{avatarId:avatar.id});
    for(const posture of ['back','side']){
      const bed=world.getBed('bed-4');world.setRestPose(model,bed.id,posture);
      model.updateMatrixWorld(true);world.root.updateMatrixWorld(true);
      const facing=bed.cameraPose.position.x>bed.center.x?1:-1;
      const chest=model.userData.body.localToWorld(posture==='back'?new THREE.Vector3(0,1.075,.195):new THREE.Vector3(-facing*.265,1.075,0));
      for(const hand of model.userData.hands)assert.ok(new THREE.Box3().setFromObject(hand).max.y<=chest.y+.035,'hands rest at body level rather than raised fists');
      const quilt=world.root.getObjectByName('rest-duvet-4').userData.cloth;
      const ray=new THREE.Raycaster(),vertex=new THREE.Vector3();
      for(const shoe of model.userData.footwear){
        assert.equal(shoe.visible,false,'shoes are removed for clean bedding');
        const points=shoe.geometry.attributes.position;
        for(let n=0;n<points.count;n++){
          vertex.fromBufferAttribute(points,n).applyMatrix4(shoe.matrixWorld);
          ray.set(new THREE.Vector3(vertex.x,4,vertex.z),new THREE.Vector3(0,-1,0));
          const hit=ray.intersectObject(quilt,false)[0];
          assert.ok(hit&&hit.point.y>=vertex.y-.012,'the actual foot geometry fits beneath the draped quilt');
        }
      }
      world.clearRestPose(model);assert.ok(model.userData.footwear.every(shoe=>shoe.visible),'footwear returns on standing');
    }
  }
});

test('rest framing includes the neighbouring bed instead of looking away from the room',()=>{
  const world=makeWorld();world.setFloor(1);
  for(const [id,neighbour] of [[1,2],[2,3],[3,2],[4,5],[5,4]]){
    const bed=world.getBed(`bed-${id}`),other=world.getBed(`bed-${neighbour}`),pose=bed.cameraPose;
    const camera=new THREE.PerspectiveCamera(58,1363/936,.1,220);
    camera.position.set(pose.position.x,pose.position.y,pose.position.z);camera.lookAt(pose.target.x,pose.target.y,pose.target.z);camera.updateMatrixWorld(true);
    const head=new THREE.Vector3(other.center.x,1.35,other.center.z-1.2).project(camera);
    assert.ok(Math.abs(head.x)<.97&&Math.abs(head.y)<.95&&head.z<1,'neighbour head is within the rest view');
  }
});
