// Stable, finite appearance choices: no random rerolls, textures or model loads.
const HAIR=['crop','sweep','bob','ponytail','bun','curly'];
const HAIR_COLORS=['#3a2a22','#5a3d2b','#7a4b2a','#2f2a2a','#8a6a4f'];
// Cheerful, saturated pastels in the spirit of a cosy village game.
const TOPS=['#5aa9e6','#f4a259','#9b8bd6','#7cc36b','#f28ca6','#f2c14e','#4fb3a9','#e86f5a'];
const CHILD_TOPS=['#4cc3ff','#ff9f43','#c38fff','#7ed957','#ff6b8b','#ffd23f'];
const PANTS=['#3d5a80','#5b6b8c','#6d5a4a','#4a4e69','#2f4858'];
const SKIN=['#f6cfb0','#eab896','#fbd9bf','#d9a07a'];

// Deliberate, finite player choices. Labels describe style, never gender or age.
export const DEFAULT_AVATAR_ID='mellow';
export const AVATAR_PRESETS=Object.freeze([
  {id:'mellow',name:'포근한 가디건',detail:'단발 · 살구 가디건',haircut:'bob',hair:'#5a3d2b',top:'#ffaa66',pants:'#4a6fa5',skin:'#f6cfb0',glasses:false,outfit:'cardigan'},
  {id:'coffee',name:'커피 한 잔의 여유',detail:'짧은 머리 · 둥근 안경',haircut:'sweep',hair:'#3b2a20',top:'#c98b5a',pants:'#3d4a6b',skin:'#e8b48f',glasses:'round',outfit:'cardigan'},
  {id:'sunny',name:'오늘도 씩씩하게',detail:'묶은 머리 · 딸기 니트',haircut:'ponytail',hair:'#7a4b2a',top:'#ff7f8f',pants:'#5b8bd6',skin:'#fbd9bf',glasses:false,outfit:'sweater'},
  {id:'indigo',name:'차분한 퇴근 준비',detail:'짧은 머리 · 파란 조끼',haircut:'crop',hair:'#2f2a2a',top:'#4f74d6',pants:'#2f3b5c',skin:'#d9a07a',glasses:'square',outfit:'vest'},
  {id:'lavender',name:'잠깐 쉬어 가요',detail:'올린 머리 · 라벤더 니트',haircut:'bun',hair:'#6b4f45',top:'#b59be6',pants:'#5c5480',skin:'#f1c4a3',glasses:'round',outfit:'sweater'},
  {id:'forest',name:'초록빛 산책',detail:'곱슬머리 · 연두 가디건',haircut:'curly',hair:'#4a3426',top:'#86cf6a',pants:'#8a6b4c',skin:'#e0a985',glasses:false,outfit:'cardigan'}
].map(preset=>Object.freeze(preset)));

export function normalizeAvatarId(value){return AVATAR_PRESETS.some(preset=>preset.id===value)?value:DEFAULT_AVATAR_ID;}
export function getAvatarAppearance(value){
  const preset=AVATAR_PRESETS.find(p=>p.id===normalizeAvatarId(value));
  const {name,detail,...look}=preset;
  return {...look,id:'avatar-'+look.id,avatarId:look.id,role:'teacher',trim:'#fff7ea',height:1,build:1};
}

function hash(value){let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}

export function characterAppearance(id='',role='teacher',color='#e3bb82'){
  if(!id)return {id:'',role,top:color,trim:'#fff3df',pants:'#3d5a80',skin:'#f6cfb0',hair:'#5a3d2b',haircut:'bob',glasses:false,outfit:'cardigan',height:1,build:1};
  const seed=hash(id),mission=String(id).match(/^mission-npc-(\d+)$/),child=String(id).match(/^child-(\d+)-(\d+)$/);
  const style=mission?Number(mission[1])-1:child?Number(child[1])+Number(child[2])*3:seed;
  const look={id:String(id),role,top:(role==='child'?CHILD_TOPS:TOPS)[seed%(role==='child'?CHILD_TOPS.length:TOPS.length)],trim:'#fff3df',pants:PANTS[(seed>>>6)%PANTS.length],skin:SKIN[(seed>>>9)%SKIN.length],hair:HAIR_COLORS[(seed>>>12)%HAIR_COLORS.length],haircut:HAIR[style%HAIR.length],glasses:(seed>>>15)%3===0?'round':false,outfit:['cardigan','vest','sweater'][(seed>>>18)%3],height:.96+((seed>>>21)%5)*.02,build:.96+((seed>>>24)%5)*.02};
  if(role==='child'){look.glasses=false;look.outfit='sweater';}
  if(role==='parent')look.outfit=(seed%2?'cardigan':'vest');
  if(role==='principal')Object.assign(look,{top:'#3b5a8c',pants:'#2c3c5a',hair:'#b9b6ad',haircut:'crop',glasses:'round',outfit:'jacket',height:1.04,build:1.06,tie:'#e0533f'});
  if(role==='vice')Object.assign(look,{top:'#a77bd1',pants:'#4f4570',hair:'#403832',haircut:'bob',glasses:'square',outfit:'vest',height:.98,build:.98,tie:'#f2c14e'});
  if(role==='security')Object.assign(look,{top:'#354e6a',trim:'#60768d',pants:'#283b50',hair:'#a6a9a2',haircut:'crop',glasses:false,outfit:'jacket',height:1,build:1.02});
  return look;
}
