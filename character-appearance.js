// Stable, finite appearance choices: no random rerolls, textures or model loads.
const HAIR=['crop','sweep','bob','ponytail','bun','curly'];
const HAIR_COLORS=['#332f2b','#57453b','#785641','#343b3a','#867565'];
const TOPS=['#638e96','#bd886b','#8b8ab0','#7c9a70','#b77983','#b6a264','#7185a7'];
const CHILD_TOPS=['#72a9c0','#df9a61','#b392c3','#91b66d','#d77c84'];
const PANTS=['#354b56','#5e6454','#4d485e','#826f59'];
const SKIN=['#e8b18e','#d8a17e','#f0c6a5','#c38a65'];

// Deliberate, finite player choices. Labels describe style, never gender or age.
export const DEFAULT_AVATAR_ID='mellow';
export const AVATAR_PRESETS=Object.freeze([
  {id:'mellow',name:'포근한 가디건',detail:'단발 · 세이지 가디건',haircut:'bob',hair:'#49392f',top:'#789d8b',pants:'#465c58',skin:'#e5b08f',glasses:false,outfit:'cardigan'},
  {id:'coffee',name:'커피 한 잔의 여유',detail:'짧은 머리 · 둥근 안경',haircut:'sweep',hair:'#342e29',top:'#a67d59',pants:'#454f59',skin:'#d5a17e',glasses:'round',outfit:'cardigan'},
  {id:'sunny',name:'오늘도 씩씩하게',detail:'묶은 머리 · 살구 니트',haircut:'ponytail',hair:'#665040',top:'#cc927f',pants:'#54665d',skin:'#efc4a6',glasses:false,outfit:'sweater'},
  {id:'indigo',name:'차분한 퇴근 준비',detail:'짧은 머리 · 남색 조끼',haircut:'crop',hair:'#343b3b',top:'#60778f',pants:'#384854',skin:'#bb8969',glasses:'square',outfit:'vest'},
  {id:'lavender',name:'잠깐 쉬어 가요',detail:'올린 머리 · 라벤더 니트',haircut:'bun',hair:'#655953',top:'#a49ab5',pants:'#565364',skin:'#e0ad8f',glasses:'round',outfit:'sweater'},
  {id:'forest',name:'초록빛 산책',detail:'곱슬머리 · 올리브 가디건',haircut:'curly',hair:'#473931',top:'#87966e',pants:'#655b4a',skin:'#cb9571',glasses:false,outfit:'cardigan'}
].map(preset=>Object.freeze(preset)));

export function normalizeAvatarId(value){return AVATAR_PRESETS.some(preset=>preset.id===value)?value:DEFAULT_AVATAR_ID;}
export function getAvatarAppearance(value){
  const preset=AVATAR_PRESETS.find(p=>p.id===normalizeAvatarId(value));
  const {name,detail,...look}=preset;
  return {...look,id:'avatar-'+look.id,avatarId:look.id,role:'teacher',trim:'#f6efe1',height:1,build:1};
}

function hash(value){let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}

export function characterAppearance(id='',role='teacher',color='#e3bb82'){
  if(!id)return {id:'',role,top:color,trim:'#f3e4ca',pants:'#3f5655',skin:'#e8b18e',hair:'#57453b',haircut:'bob',glasses:false,outfit:'cardigan',height:1,build:1};
  const seed=hash(id),mission=String(id).match(/^mission-npc-(\d+)$/),child=String(id).match(/^child-(\d+)-(\d+)$/);
  const style=mission?Number(mission[1])-1:child?Number(child[1])+Number(child[2])*3:seed;
  const look={id:String(id),role,top:(role==='child'?CHILD_TOPS:TOPS)[seed%(role==='child'?CHILD_TOPS.length:TOPS.length)],trim:'#f3e4ca',pants:PANTS[(seed>>>6)%PANTS.length],skin:SKIN[(seed>>>9)%SKIN.length],hair:HAIR_COLORS[(seed>>>12)%HAIR_COLORS.length],haircut:HAIR[style%HAIR.length],glasses:(seed>>>15)%3===0?'round':false,outfit:['cardigan','vest','sweater'][(seed>>>18)%3],height:.96+((seed>>>21)%5)*.02,build:.94+((seed>>>24)%5)*.035};
  if(role==='child'){look.glasses=false;look.outfit='sweater';}
  if(role==='parent')look.outfit=(seed%2?'cardigan':'vest');
  if(role==='principal')Object.assign(look,{top:'#526f67',pants:'#374744',hair:'#93958c',haircut:'crop',glasses:'round',outfit:'jacket',height:1.04,build:1.07,tie:'#bd745d'});
  if(role==='vice')Object.assign(look,{top:'#8f7d9f',pants:'#514c63',hair:'#403832',haircut:'bob',glasses:'square',outfit:'vest',height:.98,build:.96,tie:'#d5ad66'});
  if(role==='security')Object.assign(look,{top:'#354e6a',trim:'#60768d',pants:'#283b50',hair:'#a6a9a2',haircut:'crop',glasses:false,outfit:'jacket',height:1,build:1.02});
  return look;
}
