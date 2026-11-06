import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {AVATAR_PRESETS} from '../character-appearance.js';
import {createTeacherModel} from '../character-model.js';
import {createWorld} from '../world.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};

test('every haircut leaves both real eyes visible from the front and quarter views',()=>{
  for(const {id} of AVATAR_PRESETS){
    const model=createTeacherModel({identity:{avatarId:id}}),{head,hair,eyeCenters}=model.userData;
    model.updateMatrixWorld(true);
    for(const point of eyeCenters)for(const yaw of [-.32,0,.32]){
      const target=head.localToWorld(new THREE.Vector3(...point));
      const offset=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).multiplyScalar(2);
      const origin=target.clone().add(offset),direction=offset.clone().normalize().negate();
      const ray=new THREE.Raycaster(origin,direction,0,2);
      const firstHair=ray.intersectObject(hair,true)[0];
      assert.ok(!firstHair||firstHair.distance>1.99,`${id}: hair must not cover eye ${point[0]} at ${yaw}`);
      const eye=ray.intersectObjects(head.children.filter(n=>n.isMesh),false)[0];
      assert.ok(eye&&eye.distance<2,`${id}: real face/eye geometry is present`);
    }
  }
});

test('pillow poses keep the neck embedded in the shoulders and head for all avatars and beds',()=>{
  const world=createWorld(new THREE.Scene());world.setFloor(1);
  for(const {id} of AVATAR_PRESETS){
    const model=world.createTeacher('#fff',{avatarId:id});
    const {body,head,neck,faceShape}=model.userData;
    const neutralHead=head.position.clone(),neutralBodyRotation=body.rotation.clone();
    for(let number=1;number<=5;number++)for(const posture of ['back','side']){
      const bed=world.getBed(`bed-${number}`);
      world.setRestPose(model,bed.id,posture);model.updateMatrixWorld(true);
      assert.deepEqual(head.position.toArray(),neutralHead.toArray(),`${id}: pillow never translates the head away from its neck`);
      // Probe the actual shared neck centreline inside the head ellipsoid.
      const neckTop=neck.localToWorld(new THREE.Vector3(0,1.29,0));
      const inHead=head.worldToLocal(neckTop.clone());
      const ellipsoid=(inHead.x/faceShape.x)**2+(inHead.y/faceShape.y)**2+(inHead.z/faceShape.z)**2;
      assert.ok(ellipsoid<.75,`${id}/${posture}: neck penetrates head, with no open seam`);
      const neckBase=body.worldToLocal(neck.localToWorld(new THREE.Vector3(0,1.035,0)));
      assert.ok(neckBase.y<1.08&&Math.hypot(neckBase.x,neckBase.z)<.1,'neck remains within sweater shoulders');
      const center=head.getWorldPosition(new THREE.Vector3());
      assert.ok(center.y>1.40&&center.y<1.58,`${id}: pillow supports the head at a natural height`);
      assert.ok(Math.abs(center.x-bed.center.x)<.1,'head stays centred on its own pillow');
      world.clearRestPose(model);
      assert.deepEqual(head.position.toArray(),neutralHead.toArray());
      assert.deepEqual(body.rotation.toArray(),neutralBodyRotation.toArray(),'standing restores the whole rig');
    }
  }
});
