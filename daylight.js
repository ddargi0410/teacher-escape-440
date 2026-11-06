import * as THREE from './vendor/three.module.js';

// A November afternoon at a Korean school: soft daylight at 16:00, a golden
// low sun towards the 16:40 goal, then dusk and full night by about 17:15.
// Values are school-clock minutes since midnight (see school-clock.js).
export const SUNSET = Object.freeze({goldenFrom:16*60+15, goldenFull:16*60+40, nightFrom:16*60+38, nightFull:17*60+15});

const smooth=(from,to,value)=>{const t=Math.min(1,Math.max(0,(value-from)/(to-from)));return t*t*(3-2*t);};

/** golden: 0 → 1 as the sun lowers. night: 0 → 1 from sunset to full dark. */
export function daylight(minutes){
  const m=Number.isFinite(minutes)?minutes:SUNSET.goldenFrom;
  return {golden:smooth(SUNSET.goldenFrom,SUNSET.goldenFull,m),night:smooth(SUNSET.nightFrom,SUNSET.nightFull,m)};
}

const PALETTE={
  sky:{home:new THREE.Color('#e9eef0'),day:new THREE.Color('#bfe0f5'),golden:new THREE.Color('#f7c995'),dusk:new THREE.Color('#7a6b9e'),night:new THREE.Color('#0f1830')},
  sun:{day:new THREE.Color('#fff1dc'),golden:new THREE.Color('#ffb46b'),night:new THREE.Color('#9db2ff')},
  // Hemisphere light: sky colour from above, bounce colour from below. Indoors
  // the fluorescent tubes keep ceilings neutral; the yard turns moonlit blue.
  ambientSky:{day:new THREE.Color('#fff4e6'),golden:new THREE.Color('#ffd4a3'),indoorNight:new THREE.Color('#eef1f8'),outdoorNight:new THREE.Color('#7f8fc4')},
  ground:{day:new THREE.Color('#d8c8b4'),golden:new THREE.Color('#e3b894'),indoorNight:new THREE.Color('#c9c3b8'),outdoorNight:new THREE.Color('#2f3550')},
  window:{day:new THREE.Color('#ffffff'),golden:new THREE.Color('#ffd9ae'),dusk:new THREE.Color('#8f7fa8'),night:new THREE.Color('#2a3352')},
};
const scratch=new THREE.Color();

function blend(target,{day,golden,dusk,night},g,n){
  target.copy(day);
  if(golden)target.lerp(golden,g);
  if(dusk){target.lerp(dusk,Math.min(1,n*2));target.lerp(night,Math.max(0,n*2-1));}
  else target.lerp(night,n);
  return target;
}

/**
 * Mutates and returns `out` so the render loop allocates nothing per frame.
 * outdoors (0..1) lets the school yard fall darker than the lit corridors.
 */
export function lightingFor({golden=0,night=0,outdoors=0,resting=false,home=false}={},out={}){
  out.sky??=new THREE.Color();out.sunColor??=new THREE.Color();out.ground??=new THREE.Color();out.ambientColor??=new THREE.Color();out.window??=new THREE.Color();out.sunPosition??=new THREE.Vector3();
  if(home){out.sky.copy(PALETTE.sky.home);}
  else blend(out.sky,PALETTE.sky,golden,night);
  blend(out.sunColor,PALETTE.sun,golden,night);
  for(const [key,target] of [['ground',out.ground],['ambientSky',out.ambientColor]]){
    const p=PALETTE[key];
    scratch.copy(p.indoorNight).lerp(p.outdoorNight,outdoors);
    target.copy(p.day).lerp(p.golden,golden*(1-night)).lerp(scratch,night);
  }
  blend(out.window,PALETTE.window,golden,night);
  // Indoors stays readable under fluorescent tubes; outside grows properly dark.
  const indoorAmbient=(resting?2.9:2.7)-golden*.2-night*1.15;
  const outdoorAmbient=2.7-golden*.35-night*2.0;
  out.ambient=indoorAmbient+(outdoorAmbient-indoorAmbient)*outdoors;
  out.sunIntensity=Math.max(.3,(resting?2.6:3.1)-golden*.2-night*2.5);
  // The sun swings low in the west for long golden shadows, then the moon rises.
  const height=42-golden*26+night*20;
  out.sunPosition.set(-18-golden*22+night*30,height,28+golden*4);
  scratch.copy(out.sky);out.skyLuminance=scratch.r*.2126+scratch.g*.7152+scratch.b*.0722;
  return out;
}
