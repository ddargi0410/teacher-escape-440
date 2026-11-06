import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createSchoolProps} from '../school-props.js';

function setup(){
  const written=[];
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({fillText:(text)=>written.push(text)},{get:(target,key)=>target[key]||(()=>{}),set:()=>true})})};
  const materials=new Map(),geometries=new Map();
  const mat=(color,options={})=>{const key=color+JSON.stringify(options);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,...options}));return materials.get(key);};
  const geo=(type,...args)=>{const key=type+JSON.stringify(args);if(!geometries.has(key))geometries.set(key,new THREE[type](...args));return geometries.get(key);};
  const mesh=(parent,geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;};
  const box=(parent,x,y,z,w,h,d,color,options)=>mesh(parent,geo('BoxGeometry',w,h,d),mat(color,options),x,y,z);
  const cyl=(parent,x,y,z,r1,r2,h,color,n=10)=>mesh(parent,geo('CylinderGeometry',r1,r2,h,n),mat(color),x,y,z);
  return {props:createSchoolProps({box,cyl,mesh,geo,mat}),written,root:new THREE.Group(),materials,geometries};
}

test('research meeting table has four office chairs, three coffee choices and two half-full cups',()=>{
  const {props,root,written}=setup(),colliders=[];
  props.decorateRoom({parent:root,room:{kind:'staff'},cx:7,centerZ:-2,width:8,depth:9,colliders,collide:(list,x,z,w,d,blocksSight)=>list.push({x,z,w,d,blocksSight})});
  const byName=name=>{const result=[];root.traverse(o=>{if(o.name===name)result.push(o);});return result;};
  assert.equal(byName('research-office-chair').length,4);
  const cups=byName('half-drunk-mix-coffee');assert.equal(cups.length,2);
  for(const cup of cups){
    assert.ok(cup.children.some(m=>m.geometry?.parameters.openEnded===true),'paper cup is open so its coffee is visible');
    assert.ok(cup.children.some(m=>m.userData.coffeeLevel===.5));
  }
  for(const label of ['믹스','디카페인','진한 맛'])assert.ok(written.includes(label));
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root);
  assert.ok(bounds.min.x>=3&&bounds.max.x<=11,'furniture fits the eight-metre classroom width');
  assert.ok(bounds.min.z>=-6.5&&bounds.max.z<=2.5,'furniture fits the nine-metre classroom depth');
  assert.deepEqual(colliders,[{x:7,z:-2,w:2.65,d:1.35,blocksSight:false}]);
});

test('classroom chalkboard, child art and safety posters reuse small canvases',()=>{
  const {props,root,written}=setup();
  props.decorateRoom({parent:root,room:{kind:'classroom'},cx:-7,centerZ:-2,width:8,depth:9});
  for(let floor=1;floor<=5;floor++)props.decorateCorridor({parent:root,floor});
  assert.ok(written.includes('11월 ○일 · 오늘도 정시 퇴근'));
  assert.ok(written.includes('우리 반 작은 미술관'));assert.ok(written.includes('천천히 걸어요'));
  assert.ok(root.getObjectByName('classroom-back-lockers'));
  for(const texture of props.textures.values()){
    assert.ok(texture.image.width<=1024&&texture.image.height<=1024,texture.name);
    assert.equal(texture.colorSpace,THREE.SRGBColorSpace);
  }
  assert.equal([...props.textures.keys()].filter(key=>key==='children-art').length,1,'all floors share one artwork canvas');
});

test('office copier occupies a clear front-wall alcove with a low movement collider',()=>{
  const {props,root}=setup(),colliders=[];
  props.decorateRoom({parent:root,room:{kind:'office'},cx:-7,centerZ:-2,width:8,depth:9,colliders});
  const copier=root.getObjectByName('paper-jam-copier');
  assert.equal(copier.position.z,.4);assert.equal(copier.rotation.y,0,'face points toward the front of the room');
  assert.equal(colliders.length,1);
  assert.deepEqual(colliders[0],{x:-7+4-.78,z:.4,w:1.08,d:.85,height:1.4,blocksSight:false});
  assert.ok(colliders[0].z-colliders[0].d/2>-2.6,'copier stays clear of the office desks at z -3.3');
});

test('copier frowns for a paper jam and messenger speaker startles then settles',()=>{
  const {props,root}=setup();
  props.decorateRoom({parent:root,room:{kind:'office'},cx:-7,centerZ:-2,width:8,depth:9});
  props.decorateCorridor({parent:root,floor:4});
  assert.equal(props.copiers.length,1);assert.equal(props.speakers.length,1);
  const copier=props.copiers[0],speaker=props.speakers[0];
  props.setCopierJam(true);props.update(.016,2);
  assert.equal(copier.root.userData.expression,'paper-jam');assert.equal(copier.jamPaper.visible,true);
  assert.notEqual(copier.brows[0].rotation.z,0);assert.equal(speaker.root.userData.expression,'calm');
  props.setCopierJam(false);props.notifyMessage();props.update(.016,2.2);
  assert.equal(copier.root.userData.expression,'calm');assert.equal(copier.jamPaper.visible,false);
  assert.equal(speaker.root.userData.expression,'surprised');assert.ok(speaker.mouth.scale.y>3);
  assert.ok(props.moving.includes(speaker.face));assert.ok(props.moving.includes(copier.face));
  props.update(2,4.2);assert.equal(speaker.root.userData.expression,'calm');assert.equal(speaker.face.rotation.z,0);
  props.setCopierJam(null);props.update(.01,19);assert.equal(copier.root.userData.expression,'paper-jam','decorative jam cycle works without a mission callback');
});
