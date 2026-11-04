// Stable, finite appearance choices: no random rerolls, textures or model loads.
const HAIR=['crop','sweep','bob','ponytail','bun','curly'];
const HAIR_COLORS=['#332f2b','#57453b','#785641','#343b3a','#867565'];
const TOPS=['#638e96','#bd886b','#8b8ab0','#7c9a70','#b77983','#b6a264','#7185a7'];
const CHILD_TOPS=['#72a9c0','#df9a61','#b392c3','#91b66d','#d77c84'];
const PANTS=['#354b56','#5e6454','#4d485e','#826f59'];
const SKIN=['#e8b18e','#d8a17e','#f0c6a5','#c38a65'];

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
  return look;
}
