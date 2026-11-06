import * as THREE from './vendor/three.module.js';

/** Two permanent, procedural monuments. Live names live in accessible DOM plates. */
export function createHallOfFameWorld({parent,box,cyl,mesh,geo,mat,teacher,sign}) {
  const anchors={},statues={},colliders=[];
  const palettes={
    fastest:{body:'#c5a04d',skin:'#ebc56d',hair:'#9c7438',detail:'#75572e',edge:'#e9ce8d'},
    rest:{body:'#7d9cc4',skin:'#b8cbe6',hair:'#5a7aa6',detail:'#3d5a85',edge:'#d3e0f2'},
  };
  function metalTeacher(group,kind,x,y,z) {
    const palette=palettes[kind];
    const figure=teacher(group,x,y,z,palette.body,false,{id:'honor-'+kind,role:'teacher'});
    const appearance=figure.userData.appearance;
    figure.traverse(part=>{
      if(!part.isMesh||Array.isArray(part.material))return;
      const original='#'+part.material.color.getHexString();
      const color=original===appearance.skin?palette.skin:original===appearance.hair?palette.hair:
        ['#344b48','#495c56','#a66f57'].includes(original)?palette.detail:palette.body;
      part.material=mat(color,{metalness:.48,roughness:.56});
    });
    return figure;
  }
  function pedestal(kind,x,width,label) {
    const palette=palettes[kind],group=new THREE.Group();
    group.name='hall-of-fame-'+kind;group.position.set(x,0,11.25);
    group.userData.honorKind=kind;group.userData.pose=kind==='fastest'?'running-with-briefcase':'reclining-on-bed';
    parent.add(group);
    box(group,0,.20,0,width+.38,.30,2.90,'#c9c6c0');
    box(group,0,.42,0,width+.14,.18,2.64,'#e6e2da');
    box(group,0,.86,0,width,.72,2.36,'#8a8f99');
    box(group,0,1.27,0,width+.14,.13,2.52,'#efe9dc');
    box(group,0,1.36,0,width,.06,2.36,palette.edge,{metalness:.35,roughness:.6});
    box(group,0,.85,1.194,width-.44,.42,.055,palette.detail);
    sign(group,label,0,.85,1.23,width-.55,.34,'#fff3d2',palette.detail);
    // Paired laurel sprigs make the plinths read as awards from across the yard.
    for(const side of [-1,1])for(let leaf=0;leaf<3;leaf++){
      const sprig=mesh(group,geo('IcosahedronGeometry',.13,0),mat(palette.edge),side*(width/2-.17),.65+leaf*.19,1.23);
      sprig.scale.set(.6,1.25,.35);sprig.rotation.z=side*.55;
    }
    statues[kind]=group;
    anchors[kind]=new THREE.Vector3(x,4.25,11.25);
    colliders.push({x,z:11.25,w:width+.38,d:2.90,blocksSight:false,honorKind:kind});
    return group;
  }

  const fast=pedestal('fastest',-5.7,2.70,'오늘의 칼퇴 검성');
  const runner=metalTeacher(fast,'fastest',-.10,1.40,0);
  runner.name='honor-runner';runner.rotation.set(-.10,.32,-.06);runner.scale.setScalar(1.06);
  runner.userData.legs[0].rotation.x=.58;runner.userData.legs[1].rotation.x=-.64;
  runner.userData.arms[0].rotation.x=-1.12;runner.userData.arms[1].rotation.x=.58;
  // The briefcase is held by the lowered arm, rather than floating beside it.
  const caseArm=runner.userData.arms[1];
  const briefcase=new THREE.Group();briefcase.name='honor-briefcase';briefcase.position.set(0,-.5,.04);briefcase.scale.setScalar(.78);caseArm.add(briefcase);
  box(briefcase,0,0,0,.66,.44,.25,palettes.fastest.detail,{metalness:.45,roughness:.55});
  box(briefcase,0,.03,.135,.61,.045,.025,palettes.fastest.edge);
  for(const side of [-1,1])box(briefcase,side*.12,.29,0,.045,.15,.06,palettes.fastest.edge);
  box(briefcase,0,.35,0,.28,.045,.06,palettes.fastest.edge);
  box(briefcase,0,.02,.16,.10,.10,.03,palettes.fastest.body);
  // A small physical arrow is part of the sculpture, aimed toward the school gate.
  const arrow=new THREE.Group();arrow.position.set(.74,2.8,.03);arrow.rotation.z=-.28;fast.add(arrow);
  box(arrow,0,0,0,.12,.62,.11,palettes.fastest.edge);
  const arrowhead=mesh(arrow,geo('ConeGeometry',.27,.34,3),mat(palettes.fastest.edge),0,.40,0);
  arrowhead.rotation.y=Math.PI/2;

  const resting=pedestal('rest',5.7,3.55,'오늘의 휴식 대현자');
  const bed=new THREE.Group();bed.name='honor-rest-bed';resting.add(bed);
  for(const x of [-1.37,1.37])for(const z of [-.45,.45])box(bed,x,1.56,z,.12,.40,.12,palettes.rest.detail);
  box(bed,0,1.76,0,3.08,.18,1.22,palettes.rest.hair);
  box(bed,0,1.91,0,3,.16,1.18,palettes.rest.edge);
  box(bed,1.46,2.14,0,.10,.60,1.25,palettes.rest.hair);
  box(bed,1.12,2.05,0,.56,.14,.76,'#e8eef8');
  const sleeper=metalTeacher(resting,'rest',-.62,2.2,0);
  sleeper.name='honor-sleeper';sleeper.rotation.set(-Math.PI/2,0,-Math.PI/2);
  sleeper.userData.arms[0].rotation.z=-1.9;
  sleeper.userData.arms[1].rotation.x=-.74;
  sleeper.userData.legs[0].rotation.x=-.10;sleeper.userData.legs[1].rotation.x=-.10;
  if(sleeper.userData.head)sleeper.userData.head.position.z+=.12;
  // A folded bronze blanket and slippers strengthen the bedside silhouette.
  box(bed,-1.18,2.04,.04,.44,.12,1.03,palettes.rest.body);
  for(const z of [-.18,.18])box(resting,-1.38,1.45,z+.68,.33,.12,.19,palettes.rest.detail);

  // One shared metal material per shade lets the world batch the entire pose,
  // props and ornament into just a few meshes while retaining both monuments.
  for(const [kind,group]of Object.entries(statues)){
    const colors=new Set(Object.values(palettes[kind]));
    group.traverse(part=>{
      if(!part.isMesh||Array.isArray(part.material))return;
      const color='#'+part.material.color.getHexString();
      if(colors.has(color))part.material=mat(color,{metalness:.48,roughness:.56});
    });
  }

  return {anchors,statues,colliders};
}
