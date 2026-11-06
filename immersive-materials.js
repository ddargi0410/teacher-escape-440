import * as THREE from './vendor/three.module.js';

// Small original canvas materials. A surface reuses one texture/material across
// all five floors; the grain is geometry-free and also renders on school PCs.
export function createImmersiveMaterials(){
  const cache=new Map();
  // An optional tint makes per-floor painted bands while keeping the grain.
  function material(kind,tint){
    const key=tint?kind+':'+tint:kind;
    if(cache.has(key))return cache.get(key);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const c=canvas.getContext('2d');
    let seed=74291;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const bases={plaster:'#eeeae0',ceiling:'#e7e5dc',terrazzo:'#dcdbd7',wood:'#bd966e',paint:'#b9cdb7'};
    c.fillStyle=tint||bases[kind]||bases.plaster;c.fillRect(0,0,256,256);
    if(kind==='wood'){
      for(let n=0;n<190;n++){
        const y=random()*256;c.strokeStyle=n%3?'rgba(101,69,39,.13)':'rgba(246,221,182,.22)';c.lineWidth=.3+random()*1.6;
        c.beginPath();c.moveTo(0,y);c.bezierCurveTo(75,y+random()*9,180,y-random()*9,256,y+random()*5);c.stroke();
      }
      // Staggered boards, rather than a single uninterrupted brown surface.
      c.strokeStyle='rgba(88,62,40,.34)';c.lineWidth=1;
      for(let row=0;row<8;row++){
        const y=row*32;c.beginPath();c.moveTo(0,y);c.lineTo(256,y);c.stroke();
        const offset=row%2?64:0;
        for(let x=offset;x<256;x+=128){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+32);c.stroke();}
      }
    }else{
      for(let n=0;n<(kind==='terrazzo'?2200:3300);n++){
        const x=random()*256,y=random()*256;
        c.fillStyle=kind==='terrazzo'?['#bcbcb8','#f2f1ee','#a3a3a0','#cbcbc8'][n%4]:n%2?'rgba(73,76,66,.065)':'rgba(255,255,249,.18)';
        c.fillRect(x,y,kind==='terrazzo'?.8+random()*2.2:.6+random(),kind==='terrazzo'?.6+random()*1.8:.6+random());
      }
      if(kind==='ceiling'){
        c.strokeStyle='#d0d3d8';c.lineWidth=1.4;c.strokeRect(.7,.7,254.6,254.6);
        for(let line=64;line<256;line+=64){c.beginPath();c.moveTo(line,0);c.lineTo(line,256);c.moveTo(0,line);c.lineTo(256,line);c.stroke();}
        for(let n=0;n<90;n++){c.fillStyle='rgba(63,70,63,.13)';c.fillRect(random()*256,random()*256,1.1,1.1);}
      }
    }
    const map=new THREE.CanvasTexture(canvas);map.name='school-'+kind;map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.name='school-'+key;const repeat=kind==='ceiling'?8:kind==='wood'?3:4;map.repeat.set(repeat,repeat);
    const result=new THREE.MeshStandardMaterial({color:'#ffffff',map,roughness:kind==='wood'?.73:.93,metalness:0});
    result.name='school-'+key;cache.set(key,result);return result;
  }
  let windowSurface;
  function windowMaterial(){
    if(windowSurface)return windowSurface;
    // This is actual see-through glazing. The courtyard and apartment buildings
    // beyond it move with camera parallax; no photograph covers the opening.
    windowSurface=new THREE.MeshStandardMaterial({color:'#dceef6',transparent:true,opacity:.045,depthWrite:false,roughness:.18,metalness:0,side:THREE.DoubleSide});
    windowSurface.name='school-window-glass';
    return windowSurface;
  }
  return {material,windowMaterial};
}
