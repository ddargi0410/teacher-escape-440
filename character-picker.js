import {AVATAR_PRESETS,normalizeAvatarId,getAvatarAppearance} from './character-appearance.js?v=20261106-cute1';

let pickerSequence=0;

/** A small portrait made from the same colors and hair choices as the 3D rig. */
export function avatarPortrait(value){
  const a=getAvatarAppearance(value);
  // Big round head, tiny bell body: the same cosy proportions as the 3D rig.
  const hairBack=a.haircut==='bob'?`<ellipse cx="25" cy="50" rx="9" ry="16" fill="${a.hair}"/><ellipse cx="71" cy="50" rx="9" ry="16" fill="${a.hair}"/>`:a.haircut==='ponytail'?`<ellipse cx="74" cy="46" rx="8" ry="15" fill="${a.hair}"/>`:'';
  const extra=a.haircut==='bun'?`<circle cx="48" cy="9" r="9" fill="${a.hair}"/>`:a.haircut==='curly'?`<g fill="${a.hair}"><circle cx="30" cy="22" r="10"/><circle cx="48" cy="15" r="11"/><circle cx="66" cy="22" r="10"/></g>`:'';
  const fringe=a.haircut==='sweep'?`<path d="M23 40Q22 14 48 12T73 36Q60 22 40 30Q30 34 23 40Z" fill="${a.hair}"/>`:`<path d="M23 42Q21 13 48 12T73 42Q70 30 60 28Q50 34 36 29Q27 32 23 42Z" fill="${a.hair}"/>`;
  const glasses=a.glasses?`<g fill="none" stroke="#2c2826" stroke-width="1.6">${a.glasses==='round'?'<circle cx="38" cy="46" r="7"/><circle cx="58" cy="46" r="7"/>':'<rect x="30" y="40" width="16" height="12" rx="2"/><rect x="50" y="40" width="16" height="12" rx="2"/>'}<path d="M45 45h6"/></g>`:'';
  const collar=a.outfit==='sweater'?`<path d="M40 74q8 4 16 0" fill="none" stroke="${a.trim}" stroke-width="3"/>`:a.outfit==='vest'?`<path d="M42 73l6 8 6-8Z" fill="${a.trim}"/>`:`<path d="M44 73l4 9 4-9Z" fill="${a.trim}"/>`;
  return `<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false"><circle cx="48" cy="48" r="46" fill="${a.top}" opacity=".16"/><path d="M28 96Q27 76 36 72h24q9 4 8 24Z" fill="${a.top}"/>${collar}${hairBack}<ellipse cx="48" cy="45" rx="26" ry="25" fill="${a.skin}"/><ellipse cx="22.5" cy="47" rx="3.5" ry="5" fill="${a.skin}"/><ellipse cx="73.5" cy="47" rx="3.5" ry="5" fill="${a.skin}"/>${fringe}${extra}<g fill="#2c2826"><ellipse cx="38" cy="47" rx="3" ry="4.2"/><ellipse cx="58" cy="47" rx="3" ry="4.2"/></g><g fill="#fff"><circle cx="37.2" cy="45.4" r="1.1"/><circle cx="57.2" cy="45.4" r="1.1"/></g><g fill="#f3a3a0" opacity=".85"><ellipse cx="31" cy="55" rx="4.5" ry="2.6"/><ellipse cx="65" cy="55" rx="4.5" ry="2.6"/></g>${glasses}<path d="M44 58q4 3.4 8 0" fill="none" stroke="#2c2826" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

export function createCharacterPicker({container,value,onChange}={}){
  if(!container)throw new TypeError('A character picker container is required');
  const group=document.createElement('fieldset');group.className='character-picker';
  const name=`teacher-avatar-${++pickerSequence}`;
  group.innerHTML=`<legend>오늘의 나를 골라 주세요</legend><p class="character-picker-note">모습만 달라져요. 능력은 모두 같아요.</p><div class="character-picker-grid">${AVATAR_PRESETS.map(p=>`<label class="character-choice"><input type="radio" name="${name}" value="${p.id}" aria-label="${p.name}, ${p.detail}"><span class="character-choice-portrait">${avatarPortrait(p.id)}</span><span class="character-choice-name">${p.name}</span><small>${p.detail}</small><span class="character-choice-check" aria-hidden="true">✓</span></label>`).join('')}</div>`;
  container.append(group);
  let selected=normalizeAvatarId(value),disposed=false;
  const inputs=[...group.querySelectorAll('input[type="radio"]')];
  function refresh(){for(const input of inputs){input.checked=input.value===selected;input.parentNode.classList.toggle('is-selected',input.checked);}}
  for(const input of inputs)input.onchange=()=>{if(disposed||!input.checked)return;selected=normalizeAvatarId(input.value);refresh();onChange?.(selected);};
  refresh();
  return {getValue:()=>selected,setValue(next){if(disposed)return;selected=normalizeAvatarId(next);refresh();},dispose(){if(disposed)return;disposed=true;for(const input of inputs)input.onchange=null;group.remove();}};
}
