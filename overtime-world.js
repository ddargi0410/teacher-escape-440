import * as THREE from './vendor/three.module.js';
import {animateCharacter} from './crowd.js';

// Visual atmosphere only: the corridor remains walkable and missions stay open.
export function createOvertimeWorld({root,floors,teacher,box,mesh,geo,mat}) {
  const fixtures=[],moving=new Set();
  for(const [floor,{inside}] of floors){
    const lights=new THREE.Group();lights.name=`overtime-lights-${floor}`;inside.add(lights);moving.add(lights);
    for(const [index,x] of [-10,-6,-2,2,6,10].entries()){
      const fixture=new THREE.Group();fixture.name=`corridor-light-${floor}-${index}`;lights.add(fixture);
      box(fixture,x,3.18,4.7,1.5,.12,.48,'#66746e');
      const lamp=mesh(fixture,geo('BoxGeometry',1.34,.07,.36),new THREE.MeshBasicMaterial({color:'#fff2bd'}),x,3.1,4.7,false);
      lamp.name='lamp';
      const pool=mesh(fixture,geo('CircleGeometry',1.9,10),new THREE.MeshBasicMaterial({color:'#ffefb5',transparent:true,opacity:.1,depthWrite:false}),x,.18,4.7,false);
      pool.rotation.x=-Math.PI/2;pool.scale.y=.7;pool.name='light-pool';
      fixtures.push({floor,index,fixture,lamp,pool});
    }
  }
  const guard=teacher(root,-10,0,4.7,'#66788f',false,{id:'night-security',role:'security'});
  guard.name='overtime-security-guard';guard.visible=false;moving.add(guard);
  // The peaked cap and reflective waist strip distinguish the evening patrol.
  box(guard,0,2.18,-.02,.67,.17,.55,'#35485d');
  box(guard,0,2.12,.31,.7,.045,.27,'#35485d');
  box(guard,0,.91,.19,.6,.065,.025,'#f1dfa4');
  const torch=new THREE.Group();torch.name='security-flashlight';torch.position.set(.4,1.34,.65);torch.rotation.x=.24;guard.add(torch);
  const barrel=mesh(torch,geo('CylinderGeometry',.08,.08,.34,8),mat('#2e3e4b'),0,0,0,false);barrel.rotation.x=Math.PI/2;
  const lens=mesh(torch,geo('CircleGeometry',.075,12),new THREE.MeshBasicMaterial({color:'#fff6ce',side:THREE.DoubleSide}),0,0,.18,false);
  lens.name='flashlight-lens';
  // Geometry makes the beam visible in the Canvas renderer too, which does not
  // simulate Three.js lights. Keep it faint so it cannot hide a player or sign.
  const beam=mesh(torch,geo('ConeGeometry',.7,3.6,12,1,true),new THREE.MeshBasicMaterial({color:'#fff1b5',transparent:true,opacity:.065,depthWrite:false,side:THREE.DoubleSide}),0,0,1.98,false);
  beam.name='flashlight-beam';beam.rotation.x=-Math.PI/2;
  const spot=new THREE.SpotLight('#fff2bf',4,8,.23,.7,1.5);spot.position.set(0,0,.18);spot.castShadow=false;torch.add(spot);
  const aim=new THREE.Object3D();aim.position.set(0,0,5);torch.add(aim);spot.target=aim;
  const pool=mesh(guard,geo('CircleGeometry',.65,16),new THREE.MeshBasicMaterial({color:'#fff1b5',transparent:true,opacity:.23,depthWrite:false}),.4,.2,4.9,false);
  pool.name='flashlight-floor-pool';pool.rotation.x=-Math.PI/2;pool.scale.y=1.5;
  let patrol=0;
  function update(minutes,dt,{active=true,floor=null}={}){
    const overtime=Number.isFinite(minutes)?Math.max(0,minutes):0;
    const darkCount=overtime<1?0:Math.min(6,1+Math.floor((overtime-1)/2));
    for(const fixture of fixtures){
      const lit=fixture.index>=darkCount;
      fixture.fixture.userData.lit=lit;
      fixture.lamp.material.color.set(lit?'#fff2bd':'#596568');
      fixture.pool.visible=lit;
    }
    guard.visible=overtime>0&&floors.has(floor);
    if(overtime===0)patrol=0;
    if(!guard.visible)return;
    if(active)patrol+=(Number.isFinite(dt)?Math.max(0,dt):0)*1.35;
    const segment=patrol%40,forward=segment<20;
    guard.position.set(forward?-10+segment:30-segment,(floor-1)*4,4.7);
    guard.rotation.y=forward?Math.PI/2:-Math.PI/2;
    animateCharacter(guard,patrol,active?1:0);
    // Hold the torch level instead of swinging its arm during the walk cycle.
    guard.userData.arms[1].rotation.x=-Math.PI/2;
    torch.rotation.y=Math.sin(patrol*.7)*.12;
  }
  return {moving,update};
}
