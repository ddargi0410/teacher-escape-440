import * as THREE from './vendor/three.module.js';

// Software fallback for school PCs whose browser cannot create a WebGL context.
// It renders the actual Three scene and camera; it is not a screenshot or a
// second, simplified map. Static vertex transforms are cached between frames.
export class SoftwareRenderer {
  constructor({canvas}) {
    this.domElement=canvas;
    this.context=canvas.getContext('2d',{alpha:false,desynchronized:true});
    if(!this.context)throw new Error('Canvas2D is unavailable.');
    this.isSoftware=true;
    this.capabilities={isWebGL2:false,maxTextureSize:2048};
    this.shadowMap={enabled:false,type:null};
    this.outputColorSpace=THREE.SRGBColorSpace;
    this.toneMappingExposure=1;
    this.info={render:{calls:0,triangles:0}};
    this._ratio=1;this._width=canvas.width;this._height=canvas.height;
    this._cache=new WeakMap();this._last=-Infinity;this._frame=0;
    this._colorCache=new WeakMap();this._textureCache=new WeakMap();this._background='#e9eadb';
  }
  setPixelRatio(ratio){this._ratio=Math.min(1,Math.max(.5,ratio||1));}
  getPixelRatio(){return this._ratio;}
  setSize(width,height,updateStyle=true){
    this._width=width;this._height=height;
    const ratio=Math.min(this._ratio,1120/width,760/height);
    this.domElement.width=Math.max(1,Math.round(width*ratio));
    this.domElement.height=Math.max(1,Math.round(height*ratio));
    if(updateStyle){this.domElement.style.width=width+'px';this.domElement.style.height=height+'px';}
    this._last=-Infinity;
    this._pixels=null;this._depth=null;
  }
  setClearColor(color){this._background=new THREE.Color(color).getStyle();}
  dispose(){this._cache=new WeakMap();this._colorCache=new WeakMap();this._textureCache=new WeakMap();}

  _textureData(map){
    const image=map?.image;
    if(!image||image.complete===false)return null;
    const width=image.naturalWidth??image.width,height=image.naturalHeight??image.height;
    // A pending image is retried after load, never cached as an empty texture.
    if(!(width>0&&height>0))return null;
    const previous=this._textureCache.get(map);
    if(previous&&previous.image===image&&previous.width===width&&previous.height===height&&previous.version===map.version)return previous.pixels;
    try{
      let pixels;
      if(image.data&&image.data.length===width*height*4)pixels={data:image.data,width,height};
      else if(image.getContext)pixels=image.getContext('2d').getImageData(0,0,width,height);
      else {const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.drawImage(image,0,0,width,height);pixels=context.getImageData(0,0,width,height);}
      this._textureCache.set(map,{image,width,height,version:map.version,pixels});return pixels;
    }catch{return null;}
  }

  _textureInfo(map){
    const pixels=this._textureData(map);if(!pixels)return null;
    if(map.matrixAutoUpdate!==false)map.updateMatrix();
    return {pixels,matrix:map.matrix.elements,wrapS:map.wrapS,wrapT:map.wrapT,flipY:map.flipY};
  }

  _meshData(object){
    const geometry=object.geometry,positions=geometry.attributes.position;
    if(!positions)return null;
    let data=this._cache.get(object);
    const matrix=object.matrixWorld.elements;
    if(data&&data.geometry===geometry&&data.positionVersion===positions.version&&matrix.every((v,i)=>v===data.matrix[i]))return data;
    const source=positions.array,count=positions.count,index=geometry.index?.array;
    const indices=index||null,faceCount=Math.floor((indices?indices.length:count)/3);
    const points=new Float32Array(count*3),centers=new Float32Array(faceCount*3),normals=new Float32Array(faceCount*3);
    for(let i=0;i<count;i++){
      const n=i*3,x=source[n],y=source[n+1],z=source[n+2];
      points[n]=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12];
      points[n+1]=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];
      points[n+2]=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
    }
    for(let f=0;f<faceCount;f++){
      const j=f*3,a=(indices?indices[j]:j)*3,b=(indices?indices[j+1]:j+1)*3,c=(indices?indices[j+2]:j+2)*3;
      const ax=points[b]-points[a],ay=points[b+1]-points[a+1],az=points[b+2]-points[a+2];
      const bx=points[c]-points[a],by=points[c+1]-points[a+1],bz=points[c+2]-points[a+2];
      let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;const len=Math.hypot(nx,ny,nz)||1;
      normals[j]=nx/len;normals[j+1]=ny/len;normals[j+2]=nz/len;
      centers[j]=(points[a]+points[b]+points[c])/3;centers[j+1]=(points[a+1]+points[b+1]+points[c+1])/3;centers[j+2]=(points[a+2]+points[b+2]+points[c+2])/3;
    }
    data={geometry,positionVersion:positions.version,matrix:[...matrix],points,centers,normals,indices,faceCount,uv:geometry.attributes.uv?.array,view:new Float32Array(count*3),screen:new Float32Array(count*2)};
    this._cache.set(object,data);return data;
  }

  _rgb(material){
    const c=material.color||new THREE.Color('#ffffff');
    const previous=this._colorCache.get(material);
    if(previous&&previous.key===c.r+','+c.g+','+c.b)return previous.rgb;
    const srgb=c.clone().convertLinearToSRGB();
    const rgb=[srgb.r*255,srgb.g*255,srgb.b*255];
    this._colorCache.set(material,{key:c.r+','+c.g+','+c.b,rgb});return rgb;
  }

  render(scene,camera){
    const now=performance.now();
    if(now-this._last<1000/18)return;
    this._last=now;this._frame++;
    scene.updateMatrixWorld();camera.updateMatrixWorld();
    const ctx=this.context,w=this.domElement.width,h=this.domElement.height,hw=w/2,hh=h/2;
    const v=camera.matrixWorldInverse.elements,p=camera.projectionMatrix.elements,cm=camera.matrixWorld.elements;
    const near=Math.max(.05,camera.near||.1),far=camera.far||200;
    const background=scene.background?.isColor?scene.background.getStyle():this._background;
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
    const fog=scene.fog,fogRgb=fog?.color?this._rgb({color:fog.color}):null;
    const triangles=[],overlay=[];
    const project=(x,y,z)=>({x:hw+(p[0]*x/(-z))*hw,y:hh-(p[5]*y/(-z))*hh,z:-z,vx:x,vy:y,vz:z});
    const viewPoint=(x,y,z)=>[v[0]*x+v[4]*y+v[8]*z+v[12],v[1]*x+v[5]*y+v[9]*z+v[13],v[2]*x+v[6]*y+v[10]*z+v[14]];
    const nearClip=vertices=>{
      const out=[];
      for(let i=0;i<vertices.length;i++){
        const a=vertices[i],b=vertices[(i+1)%vertices.length],ai=a.vz<=-near,bi=b.vz<=-near;
        if(ai)out.push(a);
        if(ai!==bi){const t=(-near-a.vz)/(b.vz-a.vz);out.push({...project(a.vx+(b.vx-a.vx)*t,a.vy+(b.vy-a.vy)*t,-near),u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});}
      }
      return out;
    };
    const addTriangle=(a,b,c,material,rgb,light,texture,depthTest=true)=>{
      if((a.x<0&&b.x<0&&c.x<0)||(a.x>w&&b.x>w&&c.x>w)||(a.y<0&&b.y<0&&c.y<0)||(a.y>h&&b.y>h&&c.y>h))return;
      const area=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x));if(area<.16)return;
      const depth=(a.z+b.z+c.z)/3;
      let r=rgb[0]*light,g=rgb[1]*light,bl=rgb[2]*light, fogAmount=0;
      if(fogRgb&&material.fog!==false)fogAmount=fog.isFog?Math.max(0,Math.min(1,(depth-fog.near)/(fog.far-fog.near))):1-Math.exp(-fog.density*fog.density*depth*depth);
      const fogTint=fogRgb?fogRgb.map(c=>c*fogAmount):[0,0,0];
      const textureTint=[r,g,bl].map(c=>c/255*(1-fogAmount));
      r=r*(1-fogAmount)+fogTint[0];g=g*(1-fogAmount)+fogTint[1];bl=bl*(1-fogAmount)+fogTint[2];
      const face={a,b,c,depth,texture,textureTint,fogTint,rgb:[Math.min(255,r)|0,Math.min(255,g)|0,Math.min(255,bl)|0],alpha:material.opacity??1,transparent:material.transparent};
      (depthTest?triangles:overlay).push(face);
    };

    scene.traverseVisible(object=>{
      if(object.isSprite){
        const m=object.material,texture=this._textureInfo(m.map);if(!texture||m.opacity===0)return;
        const e=object.matrixWorld.elements,x=e[12],y=e[13],z=e[14],sx=Math.hypot(e[0],e[1],e[2])*.5,sy=Math.hypot(e[4],e[5],e[6])*.5;
        const points=[[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]].map(([xx,yy,u,vv])=>{
          const worldx=x+cm[0]*xx*sx+cm[4]*yy*sy,worldy=y+cm[1]*xx*sx+cm[5]*yy*sy,worldz=z+cm[2]*xx*sx+cm[6]*yy*sy;
          const pos=viewPoint(worldx,worldy,worldz),tx=texture.matrix;return {...project(...pos),u:tx[0]*u+tx[3]*vv+tx[6],v:tx[1]*u+tx[4]*vv+tx[7]};
        });
        if(points.some(point=>point.z<near)||points.every(point=>point.z>far))return;
        const rgb=this._rgb(m);addTriangle(points[0],points[1],points[2],m,rgb,1,texture,m.depthTest!==false);addTriangle(points[0],points[2],points[3],m,rgb,1,texture,m.depthTest!==false);return;
      }
      if(!object.isMesh||!object.material||object.material.visible===false)return;
      const material=Array.isArray(object.material)?object.material[0]:object.material;
      if(material.opacity===0)return;
      const data=this._meshData(object);if(!data)return;
      const {points,view,screen,indices,faceCount,centers,normals,uv}=data;
      const rgb=this._rgb(material),texture=this._textureInfo(material.map),tx=texture?.matrix;
      for(let i=0;i<points.length;i+=3){
        const x=points[i],y=points[i+1],z=points[i+2],vx=v[0]*x+v[4]*y+v[8]*z+v[12],vy=v[1]*x+v[5]*y+v[9]*z+v[13],vz=v[2]*x+v[6]*y+v[10]*z+v[14],s=i/3*2;
        view[i]=vx;view[i+1]=vy;view[i+2]=vz;screen[s]=hw+p[0]*vx/(-vz)*hw;screen[s+1]=hh-p[5]*vy/(-vz)*hh;
      }
      const vertex=index=>{const j=index*3,s=index*2,u=uv?uv[s]:0,vv=uv?uv[s+1]:0;return {x:screen[s],y:screen[s+1],z:-view[j+2],vx:view[j],vy:view[j+1],vz:view[j+2],u:tx?tx[0]*u+tx[3]*vv+tx[6]:u,v:tx?tx[1]*u+tx[4]*vv+tx[7]:vv};};
      for(let f=0;f<faceCount;f++){
        const j=f*3,normalx=normals[j],normaly=normals[j+1],normalz=normals[j+2];
        const facing=normalx*(cm[12]-centers[j])+normaly*(cm[13]-centers[j+1])+normalz*(cm[14]-centers[j+2]);
        if((material.side===THREE.FrontSide&&facing<=0)||(material.side===THREE.BackSide&&facing>=0))continue;
        const ia=indices?indices[j]:j,ib=indices?indices[j+1]:j+1,ic=indices?indices[j+2]:j+2;
        const az=-view[ia*3+2],bz=-view[ib*3+2],cz=-view[ic*3+2];
        if((az<near&&bz<near&&cz<near)||(az>far&&bz>far&&cz>far))continue;
        let light=1;
        if(!material.isMeshBasicMaterial){
          const direction=facing>=0?1:-1;
          const diffuse=Math.max(0,(-.43*normalx+.81*normaly+.4*normalz)*direction);
          const emissive=material.emissive?Math.max(material.emissive.r,material.emissive.g,material.emissive.b)*(material.emissiveIntensity||0):0;
          light=(.64+.36*diffuse)*(1-Math.max(0,Math.min(1,scene.userData.schoolNight||0))*.48)+Math.min(.12,emissive*.3);
        }
        const a=vertex(ia),b=vertex(ib),c=vertex(ic);
        if(az<near||bz<near||cz<near){
          const polygon=nearClip([a,b,c]);for(let k=1;k<polygon.length-1;k++)addTriangle(polygon[0],polygon[k],polygon[k+1],material,rgb,light,texture,material.depthTest!==false);
        }else addTriangle(a,b,c,material,rgb,light,texture,material.depthTest!==false);
      }
    });

    // A genuine per-pixel depth buffer is essential: sorting large ground and
    // facade triangles by their centers lets floors incorrectly cover rooms.
    if(!this._pixels||this._pixels.width!==w||this._pixels.height!==h){this._pixels=ctx.createImageData(w,h);this._depth=new Float32Array(w*h);}
    const pixels=this._pixels.data,pixels32=new Uint32Array(pixels.buffer),depthBuffer=this._depth;
    const bg=this._rgb({color:scene.background?.isColor?scene.background:new THREE.Color(this._background)});
    pixels32.fill((255<<24)|((bg[2]|0)<<16)|((bg[1]|0)<<8)|(bg[0]|0));
    depthBuffer.fill(0);
    const raster=(face,onTop=false)=>{
      const {a,b,c}=face;
      const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,c.x)));
      const minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,c.y)));
      const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<.00001)return;
      const d0x=(b.y-c.y)/den,d0y=(c.x-b.x)/den,d1x=(c.y-a.y)/den,d1y=(a.x-c.x)/den;
      const iz0=1/a.z,iz1=1/b.z,iz2=1/c.z;
      const u0=a.u*iz0,u1=b.u*iz1,u2=c.u*iz2,v0=a.v*iz0,v1=b.v*iz1,v2=c.v*iz2;
      const sampling=face.texture,tex=sampling?.pixels,writeDepth=!face.transparent&&face.alpha>=1&&!onTop;
      const tint=face.textureTint, haze=face.fogTint;
      const diz=d0x*(iz0-iz2)+d1x*(iz1-iz2),duz=d0x*(u0-u2)+d1x*(u1-u2),dvz=d0x*(v0-v2)+d1x*(v1-v2);
      const packed=(255<<24)|(face.rgb[2]<<16)|(face.rgb[1]<<8)|face.rgb[0];
      const edges=[[a,b],[b,c],[c,a]];
      for(let y=minY;y<=maxY;y++){
        const py=y+.5;let left=Infinity,right=-Infinity;
        for(const [ea,eb]of edges){if((py>=ea.y&&py<eb.y)||(py>=eb.y&&py<ea.y)){const xx=ea.x+(py-ea.y)*(eb.x-ea.x)/(eb.y-ea.y);if(xx<left)left=xx;if(xx>right)right=xx;}}
        const begin=Math.max(minX,Math.ceil(left-.5)),end=Math.min(maxX,Math.floor(right-.5));if(begin>end)continue;
        const w0=d0x*(begin+.5-c.x)+d0y*(py-c.y),w1=d1x*(begin+.5-c.x)+d1y*(py-c.y),w2=1-w0-w1;
        let iz=w0*iz0+w1*iz1+w2*iz2,uz=w0*u0+w1*u1+w2*u2,vz=w0*v0+w1*v1+w2*v2,pixel=y*w+begin;
        if(!tex&&face.alpha>=1){
          for(let x=begin;x<=end;x++,pixel++,iz+=diz){if(onTop||iz>=depthBuffer[pixel]-.0000001){pixels32[pixel]=packed;if(writeDepth)depthBuffer[pixel]=iz;}}
          continue;
        }
        for(let x=begin;x<=end;x++,pixel++,iz+=diz,uz+=duz,vz+=dvz){
          if(!onTop&&iz<depthBuffer[pixel]-.0000001)continue;
          let r=face.rgb[0],g=face.rgb[1],bl=face.rgb[2],alpha=face.alpha;
          if(tex){
            let u=uz/iz,vv=vz/iz;
            if(sampling.wrapS===THREE.RepeatWrapping)u-=Math.floor(u);
            else if(sampling.wrapS===THREE.MirroredRepeatWrapping){u=((u%2)+2)%2;if(u>1)u=2-u;}
            if(sampling.wrapT===THREE.RepeatWrapping)vv-=Math.floor(vv);
            else if(sampling.wrapT===THREE.MirroredRepeatWrapping){vv=((vv%2)+2)%2;if(vv>1)vv=2-vv;}
            if(sampling.flipY)vv=1-vv;
            const tx=Math.max(0,Math.min(tex.width-1,(u*tex.width)|0)),ty=Math.max(0,Math.min(tex.height-1,(vv*tex.height)|0)),ti=(ty*tex.width+tx)*4;
            alpha*=tex.data[ti+3]/255;if(alpha<.01)continue;
            r=Math.min(255,Math.round(tex.data[ti]*tint[0]+haze[0]));g=Math.min(255,Math.round(tex.data[ti+1]*tint[1]+haze[1]));bl=Math.min(255,Math.round(tex.data[ti+2]*tint[2]+haze[2]));
          }
          const pi=pixel*4;
          if(alpha>=.999){pixels32[pixel]=(255<<24)|(bl<<16)|(g<<8)|r;if(writeDepth)depthBuffer[pixel]=iz;}
          else {pixels[pi]=r*alpha+pixels[pi]*(1-alpha);pixels[pi+1]=g*alpha+pixels[pi+1]*(1-alpha);pixels[pi+2]=bl*alpha+pixels[pi+2]*(1-alpha);}
        }
      }
    };
    const opaque=triangles.filter(face=>!face.transparent&&face.alpha>=1),transparent=triangles.filter(face=>face.transparent||face.alpha<1);
    opaque.sort((a,b)=>a.depth-b.depth);transparent.sort((a,b)=>b.depth-a.depth);overlay.sort((a,b)=>b.depth-a.depth);
    for(const face of opaque)raster(face);
    for(const face of transparent)raster(face);
    for(const face of overlay)raster(face,true);
    ctx.putImageData(this._pixels,0,0);ctx.globalAlpha=1;this.info.render.calls=1;this.info.render.triangles=triangles.length+overlay.length;
  }
}
