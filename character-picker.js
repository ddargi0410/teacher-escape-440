import {AVATAR_PRESETS,normalizeAvatarId,getAvatarAppearance} from './character-appearance.js?v=20261106-immersive1';

let pickerSequence=0;

/** A small portrait made from the same colors and hair choices as the 3D rig. */
export function avatarPortrait(value){
  const a=getAvatarAppearance(value);
  const hairBack=a.haircut==='bob'?`<path d="M27 37Q26 14 48 14T69 37L72 66Q48 79 24 66Z" fill="${a.hair}"/>`:a.haircut==='ponytail'?`<ellipse cx="67" cy="48" rx="10" ry="24" fill="${a.hair}"/>`:'';
  const extra=a.haircut==='bun'?`<circle cx="48" cy="14" r="10" fill="${a.hair}"/>`:a.haircut==='curly'?`<path d="M25 37C17 28 24 16 33 18C33 5 47 7 49 14C57 4 71 15 65 22C78 27 72 39 65 39Z" fill="${a.hair}"/>`:'';
  const glasses=a.glasses?`<g fill="none" stroke="#34413e" stroke-width="1.7">${a.glasses==='round'?'<circle cx="38" cy="42" r="7"/><circle cx="58" cy="42" r="7"/>':'<rect x="30" y="36" width="16" height="12" rx="2"/><rect x="50" y="36" width="16" height="12" rx="2"/>'}<path d="M45 41h6M28 40h-3M67 40h4"/></g>`:'';
  const shirt=a.outfit==='sweater'?`<path d="M39 68q9 5 18 0" fill="none" stroke="${a.trim}" stroke-width="4"/>`:`<path d="M39 66l9 12 9-12-3 30H42Z" fill="${a.trim}"/>`;
  return `<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false"><circle cx="48" cy="48" r="46" fill="${a.top}" opacity=".11"/>${hairBack}<path d="M15 96V85q0-19 23-20h20q23 1 23 20v11Z" fill="${a.top}"/>${shirt}<rect x="42" y="55" width="12" height="16" rx="5" fill="${a.skin}"/><ellipse cx="48" cy="40" rx="21" ry="25" fill="${a.skin}"/><path d="M27 38Q22 13 48 13T69 36Q56 24 42 29L28 40Z" fill="${a.hair}"/>${extra}<g fill="#34413e"><ellipse cx="38" cy="42" rx="2.1" ry="2.7"/><ellipse cx="58" cy="42" rx="2.1" ry="2.7"/></g>${glasses}<path d="M43 54q5 4 10 0" fill="none" stroke="#a46d59" stroke-width="1.4" stroke-linecap="round"/><path d="M47 44v6h3" fill="none" stroke="#b78165" stroke-width="1.2" stroke-linecap="round"/><rect x="25" y="78" width="9" height="12" rx="1" fill="#f4efe0"/><path d="M27 81h5" stroke="#739185" stroke-width="2"/></svg>`;
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
