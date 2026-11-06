import * as THREE from './vendor/three.module.js';

// Small original canvas materials. A surface reuses one texture/material across
// all five floors; the grain is geometry-free and also renders on school PCs.
export function createImmersiveMaterials(){
  const cache=new Map();
  function material(kind){
    if(cache.has(kind))return cache.get(kind);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const c=canvas.getContext('2d');
    let seed=74291;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const bases={plaster:'#eeeae0',ceiling:'#e7e5dc',terrazzo:'#d7d9d3',wood:'#bd966e',paint:'#a3bcb0'};
    c.fillStyle=bases[kind]||bases.plaster;c.fillRect(0,0,256,256);
    if(kind==='wood'){
      for(let n=0;n<190;n++){
        const y=random()*256;c.strokeStyle=n%3?'rgba(101,69,39,.13)':'rgba(246,221,182,.22)';c.lineWidth=.3+random()*1.6;
        c.beginPath();c.moveTo(0,y);c.bezierCurveTo(75,y+random()*9,180,y-random()*9,256,y+random()*5);c.stroke();
      }
    }else{
      for(let n=0;n<(kind==='terrazzo'?2200:3300);n++){
        const x=random()*256,y=random()*256;
        c.fillStyle=kind==='terrazzo'?['#b7bcb7','#edf0e7','#9ba69f','#c8ccc5'][n%4]:n%2?'rgba(73,76,66,.065)':'rgba(255,255,249,.18)';
        c.fillRect(x,y,kind==='terrazzo'?.8+random()*2.2:.6+random(),kind==='terrazzo'?.6+random()*1.8:.6+random());
      }
      if(kind==='ceiling'){
        c.strokeStyle='#cbd0c8';c.lineWidth=1.4;c.strokeRect(.7,.7,254.6,254.6);
        for(let n=0;n<90;n++){c.fillStyle='rgba(63,70,63,.13)';c.fillRect(random()*256,random()*256,1.1,1.1);}
      }
    }
    const map=new THREE.CanvasTexture(canvas);map.name='school-'+kind;map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;const repeat=kind==='ceiling'?8:kind==='wood'?1:4;map.repeat.set(repeat,repeat);
    const result=new THREE.MeshStandardMaterial({color:'#ffffff',map,roughness:kind==='wood'?.73:.93,metalness:0});
    result.name='school-'+kind;cache.set(kind,result);return result;
  }
  let windowSurface;
  function windowMaterial(){
    if(windowSurface)return windowSurface;
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
    const c=canvas.getContext('2d');
    for(let row=0;row<256;row++){const t=row/255;c.fillStyle=`rgb(${Math.round(157+61*t)},${Math.round(200+24*t)},${Math.round(224+4*t)})`;c.fillRect(0,row,512,1);}
    const fallback=new THREE.CanvasTexture(canvas);fallback.name='school-window-view';fallback.colorSpace=THREE.SRGBColorSpace;
    windowSurface=new THREE.MeshBasicMaterial({map:fallback,color:'#ffffff',side:THREE.FrontSide});windowSurface.name='school-window-view';
    // The generated village panorama is shared by every ordinary school window.
    // A sky gradient remains visible if offline or the image cannot be decoded.
    if(typeof Image!=='undefined'){
      const photo=new Image();photo.onload=()=>{const texture=new THREE.Texture(photo);texture.name='school-window-view';texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;windowSurface.map=texture;windowSurface.needsUpdate=true;fallback.dispose();};
      photo.src=new URL('./assets/window-view.jpg',import.meta.url).href;
    }
    return windowSurface;
  }
  function setNight(amount){if(windowSurface)windowSurface.color.setRGB(1-amount*.68,1-amount*.64,1-amount*.48);}
  return {material,windowMaterial,setNight};
}
