import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {SoftwareRenderer} from '../software-renderer.js';

function image(colors,width=2,height=2){
  const result={width,height,reads:0,bytes:new Uint8ClampedArray(colors.flatMap(c=>[...c,255]))};
  result.getContext=()=>({getImageData(){result.reads++;return {width:result.width,height:result.height,data:new Uint8ClampedArray(result.bytes)};}});
  return result;
}
function harness(map,materialOptions={},standard=false){
  let painted;
  const context={setTransform(){},fillRect(){},createImageData(width,height){return {width,height,data:new Uint8ClampedArray(width*height*4)};},putImageData(pixels){painted=pixels;}};
  const canvas={width:16,height:16,style:{},getContext:()=>context};
  const renderer=new SoftwareRenderer({canvas});
  const scene=new THREE.Scene();scene.background=new THREE.Color('#010101');
  const camera=new THREE.PerspectiveCamera(90,1,.1,10);
  const Material=standard?THREE.MeshStandardMaterial:THREE.MeshBasicMaterial;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new Material({map,...materialOptions}));mesh.position.z=-1;scene.add(mesh);
  return {renderer,scene,camera,mesh,render(){renderer._last=-Infinity;renderer.render(scene,camera);},pixel(x,y){return [...painted.data.slice((y*16+x)*4,(y*16+x)*4+3)];}};
}
const red=[255,0,0],green=[0,255,0],blue=[0,0,255],yellow=[255,255,0];
function quadrants(){return new THREE.CanvasTexture(image([red,green,blue,yellow]));}

test('mapped planes preserve image orientation, flipY and unlit white texture colors',()=>{
  const map=quadrants(),h=harness(map);h.render();
  assert.deepEqual(h.pixel(2,2),red);assert.deepEqual(h.pixel(13,2),green);
  assert.deepEqual(h.pixel(2,13),blue);assert.deepEqual(h.pixel(13,13),yellow);
  map.flipY=false;h.render();assert.deepEqual(h.pixel(2,2),blue);assert.deepEqual(h.pixel(13,13),green);
});

test('repeated wall and floor textures repeat across a triangle instead of clamping',()=>{
  const map=quadrants();map.wrapS=THREE.RepeatWrapping;map.repeat.x=2;
  const h=harness(map);h.render();
  assert.deepEqual([2,6,10,14].map(x=>h.pixel(x,2)),[red,green,red,green]);
  map.offset.x=-.5;h.render();
  assert.deepEqual([2,6,10,14].map(x=>h.pixel(x,2)),[green,red,green,red]);
});

test('texture center, rotation, offset and mirrored repeat match Three texture coordinates',()=>{
  const map=quadrants();map.center.set(.5,.5);map.rotation=Math.PI;
  const h=harness(map);h.render();assert.deepEqual(h.pixel(2,2),yellow);
  map.rotation=0;map.center.set(0,0);map.repeat.x=2;map.wrapS=THREE.MirroredRepeatWrapping;
  h.render();assert.deepEqual([2,6,10,14].map(x=>h.pixel(x,2)),[red,green,green,red]);
  map.repeat.set(1,2);map.wrapS=THREE.ClampToEdgeWrapping;map.wrapT=THREE.RepeatWrapping;
  h.render();assert.deepEqual([2,6,10,14].map(y=>h.pixel(2,y)),[red,blue,red,blue]);
});

test('standard mapped materials receive surface lighting, tint and nighttime shading',()=>{
  const map=new THREE.CanvasTexture(image([[255,255,255]],1,1));
  const h=harness(map,{color:'#808080'},true);h.render();
  const day=h.pixel(7,7);assert.ok(day[0]>90&&day[0]<110,`day pixel ${day}`);assert.equal(day[0],day[1]);
  h.scene.userData.schoolNight=1;h.render();assert.ok(h.pixel(7,7)[0]<day[0]*.6);
  const basic=harness(map,{color:'#ff0000'});basic.render();assert.deepEqual(basic.pixel(7,7),red);
});

test('loaded texture data is reused, while explicit updates and late image loads are retried',()=>{
  const map=quadrants(),h=harness(map);h.render();h.render();assert.equal(map.image.reads,1);
  map.image.bytes.set([...blue,255],0);map.needsUpdate=true;h.render();assert.equal(map.image.reads,2);assert.deepEqual(h.pixel(2,2),blue);
  const pending=image([red],1,1);pending.width=0;pending.height=0;
  const laterMap=new THREE.CanvasTexture(pending),later=harness(laterMap);later.render();assert.equal(pending.reads,0);
  pending.width=1;pending.height=1;later.render();assert.equal(pending.reads,1);assert.deepEqual(later.pixel(7,7),red);
});

test('fog blends over sampled colors instead of disappearing on a mapped surface',()=>{
  const map=new THREE.CanvasTexture(image([red],1,1)),h=harness(map);h.scene.fog=new THREE.Fog('#0000ff',0,2);h.render();
  const p=h.pixel(7,7);assert.ok(p[0]>=126&&p[0]<=128);assert.ok(p[2]>=126&&p[2]<=128);assert.equal(p[1],0);
  h.mesh.material.fog=false;h.render();assert.deepEqual(h.pixel(7,7),red);
});

test('near-clipped textured triangles remain drawable and the depth buffer keeps nearer objects visible',()=>{
  const map=new THREE.CanvasTexture(image([red],1,1)),h=harness(map);
  const closer=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(image([blue],1,1))}));
  closer.position.z=-.5;h.scene.add(closer);h.render();assert.deepEqual(h.pixel(7,7),blue);
  h.scene.remove(closer);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.8,-.8,-1,.8,-.8,-1,0,.8,.05],3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2));
  h.mesh.geometry=geometry;h.mesh.position.z=0;h.render();assert.ok(h.renderer.info.render.triangles>=2);assert.deepEqual(h.pixel(7,10),red);
});
