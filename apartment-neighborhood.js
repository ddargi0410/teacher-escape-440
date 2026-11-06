import * as THREE from './vendor/three.module.js';

// A real, inexpensive neighbourhood beyond the school windows. Shared canvas
// facades provide the repeated glazing; balconies, cores and roofs have depth.
// Everything is scenery: this module adds no colliders or interactions.
export function createApartmentNeighborhood({parent,box,mesh,geo}){
  const root=new THREE.Group();root.name='korean-apartment-neighborhood';parent.add(root);
  const materials=[],buildings=[],textureSize={width:512,height:1024};
  function makeTexture(name,draw){
    const canvas=document.createElement('canvas');canvas.width=textureSize.width;canvas.height=textureSize.height;
    draw(canvas.getContext('2d'),canvas.width,canvas.height);
    const texture=new THREE.CanvasTexture(canvas);texture.name=name;texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  const facade=makeTexture('apartment-balconies',(c,w,h)=>{
    c.fillStyle='#eeeae1';c.fillRect(0,0,w,h);
    for(let floor=0;floor<16;floor++)for(let bay=0;bay<4;bay++){
      const x=bay*128,y=floor*64;
      c.fillStyle='#c2c9c7';c.fillRect(x+10,y+8,108,49);
      c.fillStyle=['#8199a7','#90a6b1','#758e9f'][(floor+bay)%3];c.fillRect(x+15,y+12,98,39);
      c.fillStyle='#cedadd';c.fillRect(x+16,y+13,96,3);
      c.fillStyle='#eff0eb';c.fillRect(x+46,y+10,4,43);c.fillRect(x+80,y+10,4,43);
      c.fillStyle='#d5d3c9';c.fillRect(x+8,y+53,112,7);
      c.fillStyle='#fcfaf2';c.fillRect(x+7,y+53,114,2);
    }
  });
  const litWindows=makeTexture('apartment-evening-windows',(c,w,h)=>{
    c.fillStyle='#000000';c.fillRect(0,0,w,h);
    for(let floor=0;floor<16;floor++)for(let bay=0;bay<4;bay++){
      if((floor*7+bay*11)%5>1)continue;
      const x=bay*128,y=floor*64;c.fillStyle=(floor+bay)%3?'#ffe0a1':'#e0e7f6';c.fillRect(x+15,y+12,98,39);
      c.fillStyle='#000000';c.fillRect(x+46,y+10,4,43);c.fillRect(x+80,y+10,4,43);
    }
  });
  function surface(name,color,options={}){
    const material=new THREE.MeshStandardMaterial({color,roughness:.9,metalness:0,...options});material.name=name;
    materials.push({material,day:material.color.clone()});return material;
  }
  const white=surface('apartment-render','#e4e2d8'),trim=surface('apartment-concrete','#b9c4c8');
  const accent=surface('apartment-core','#899aa7');
  const facadeMaterial=surface('apartment-glazed-balconies','#ffffff',{map:facade,emissive:'#ffffff',emissiveMap:litWindows,emissiveIntensity:0});
  function block(group,x,y,z,w,h,d,material){const object=mesh(group,geo('BoxGeometry',w,h,d),material,x,y,z,false);return object;}
  const numberCanvas=document.createElement('canvas');numberCanvas.width=512;numberCanvas.height=128;
  const numberContext=numberCanvas.getContext('2d');numberContext.fillStyle='#e4e2d8';numberContext.fillRect(0,0,512,128);
  numberContext.fillStyle='#556878';numberContext.font='700 34px sans-serif';numberContext.textAlign='center';numberContext.textBaseline='middle';
  for(let index=0;index<7;index++)numberContext.fillText(String(101+index),(index+.5)*512/7,67);
  const numberMap=new THREE.CanvasTexture(numberCanvas);numberMap.name='apartment-building-numbers';numberMap.colorSpace=THREE.SRGBColorSpace;
  const numberMaterial=surface('apartment-building-numbers','#ffffff',{map:numberMap});
  function numberPlate(group,number,x,y,z){
    const geometry=geo('PlaneGeometry',2.8,2.8).clone(),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setX(i,(uv.getX(i)+number-101)/7);uv.needsUpdate=true;
    const face=mesh(group,geometry,numberMaterial,x,y,z,false);face.rotation.y=Math.PI;
  }
  const layout=[
    {x:-39,z:52,floors:12,w:13,turn:.08},
    {x:-19,z:57,floors:15,w:14,turn:-.04},
    {x:3,z:49,floors:11,w:15,turn:.04},
    {x:25,z:60,floors:14,w:14,turn:-.07},
    {x:47,z:49,floors:12,w:13,turn:-.12},
    {x:-58,z:25,floors:10,w:13,turn:.45},
    {x:61,z:29,floors:11,w:14,turn:-.4},
  ];
  for(const [index,item] of layout.entries()){
    const height=item.floors*2.8,depth=9.2,g=new THREE.Group();g.name=`apartment-${101+index}`;
    g.position.set(item.x,-.35,item.z);g.rotation.y=item.turn;g.userData={environmentOnly:true,floors:item.floors,height};root.add(g);buildings.push(g);
    block(g,0,height/2,0,item.w,height,depth,white);
    block(g,0,height/2,-depth/2-.14,1.45,height,.32,accent);
    block(g,0,height+.16,0,item.w+.5,.32,depth+.4,trim);
    block(g,0,height+.9,1.4,3.6,1.5,3.8,white);
    for(const side of [-1,1]){
      const geometry=geo('PlaneGeometry',item.w-.75,height-1.1).clone(),uv=geometry.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setY(i,uv.getY(i)*item.floors/16);uv.needsUpdate=true;
      const wall=mesh(g,geometry,facadeMaterial,0,height/2,side*(depth/2+.025),false);wall.rotation.y=side<0?Math.PI:0;
      wall.name='apartment-balcony-facade';
      // Repeated balcony sills live in the shared facade texture; only the
      // projecting ground-floor canopy needs geometry at this distance.
      if(side<0)block(g,0,2.8,side*(depth/2+.12),item.w-.4,.18,.5,trim);
    }
    for(const side of [-1,1])block(g,side*(item.w/2-.05),height/2,0,.12,height,1.15,accent);
    numberPlate(g,101+index,item.w/2-1.9,height-3,-depth/2-.05);
  }
  function setDaylight({night=0,window}={}){
    // Interior fluorescent lighting must not make the outdoor apartments look
    // sunlit at midnight. Tint only these dedicated exterior materials.
    for(const {material,day} of materials){material.color.copy(day);if(window?.isColor)material.color.multiply(window);}
    facadeMaterial.emissiveIntensity=Math.max(0,Math.min(1,(night-.18)/.65))*.75;
  }
  return {root,buildings,materials,textures:[facade,litWindows],setDaylight};
}
