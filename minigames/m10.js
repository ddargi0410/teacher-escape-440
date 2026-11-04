import * as THREE from '../vendor/three.module.js';
import {SoftwareRenderer} from '../software-renderer.js';

// Local checklist, not an AI judge. No minimum/maximum prompt length.
const SHIELDS = [
  {id:'role',label:'역할',help:'과학 자료 개발 도우미'},
  {id:'audience',label:'대상',help:'초등학교 5학년'},
  {id:'topic',label:'주제',help:'생태계 · 먹이 관계'},
  {id:'format',label:'형식',help:'퀴즈 · 도감 · 관찰 게임'},
  {id:'constraints',label:'조건',help:'태블릿 · 실명 제외'},
  {id:'output',label:'출력',help:'HTML 파일 · 실행 코드'}
];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function evaluateBossPrompt(value) {
  const text=String(value??'').normalize('NFKC').replace(/\s+/g,' ');
  const tests={
    role:/(?:개발\s*도우미|개발자|프로그래머|전문가|코딩\s*도우미|교사처럼|선생님처럼|수업\s*설계자|(?:너는|당신은)[^.!?]{0,30}(?:도우미|개발|교사|선생|제작|설계))/i,
    audience:/(?:초등(?:학교|학생)?\s*(?:[1-6일이삼사오육]\s*학년)?|[1-6일이삼사오육]\s*학년\s*(?:학생|어린이)?)/,
    topic:/(?:생태|생물|환경|먹이\s*(?:관계|사슬|그물)|생산자|소비자|분해자|식물|동물|학교\s*숲)/,
    format:/(?:퀴즈|미니\s*게임|게임|도감|관찰\s*(?:일지|기록)|학습지|시뮬레이션|탐사\s*(?:앱|대)|카드\s*(?:뉴스|자료)?|웹\s*(?:앱|자료|사이트)|수업\s*자료)/,
    constraints:/(?:태블릿|\bPC\b|모바일|브라우저|설치|로그인|개인정보|실명|저작권|라이선스|출처|큰\s*글[씨자]|\d+\s*문항|재시작|다시\s*시작|오답\s*(?:해설|피드백|설명))/i,
    output:/(?:\bHTML\b|\bCSS\b|\bJavaScript\b|자바스크립트|파일|실행\s*코드|소스\s*코드|코드를|배포|다운로드|링크|페이지)/i
  };
  const checks=SHIELDS.map(rule=>({...rule,passed:tests[rule.id].test(text)}));
  const count=checks.filter(rule=>rule.passed).length;
  return {checks,count,passed:count>=5};
}

export function createBossAttempt(prompt='',duration=90) {
  const state={draft:String(prompt??''),duration:clamp(Number(duration)||90,60,90),elapsed:0,phase:'playing',earned:new Set(),kick:0,celebration:0,awarded:false,result:evaluateBossPrompt(prompt)};
  for(const check of state.result.checks)if(check.passed)state.earned.add(check.id);
  return state;
}
export function applyBossDraft(state,prompt) {
  if(state.phase!=='playing')return 0;
  state.draft=String(prompt??'');state.result=evaluateBossPrompt(state.draft);
  let newlyLit=0;
  for(const check of state.result.checks)if(check.passed&&!state.earned.has(check.id)){state.earned.add(check.id);newlyLit++;}
  state.kick=clamp(state.kick+newlyLit*.72,0,3.5);
  return newlyLit;
}
export function advanceBossAttempt(state,seconds) {
  if(state.phase!=='playing')return false;
  const delta=Math.max(0,Number(seconds)||0);state.elapsed=Math.min(state.duration,state.elapsed+delta);state.kick=Math.max(0,state.kick-delta*.7);
  if(state.elapsed>=state.duration){state.phase='timeout';return true;}
  return false;
}
export function submitBossAttempt(state) {
  if(state.phase!=='playing')return false;
  state.result=evaluateBossPrompt(state.draft);
  if(!state.result.passed)return false;
  state.phase='winning';state.celebration=0;return true;
}

export function start({container,data,onWin=()=>{},onFail=()=>{}}) {
  const arcade=data.arcade||{},rules=SHIELDS.map(fallback=>({...fallback,...arcade.shields?.find(rule=>rule.id===fallback.id)}));
  let attempt=createBossAttempt(data.initialPrompt??data.bossDraft??'',arcade.duration);
  let destroyed=false,paused=false,raf=0,last=performance.now(),sceneTime=0,bubbleIndex=0,bubbleLeft=2;
  const cleanups=[],materials=new Set(),geometries=new Set(),textures=new Set();
  const root=document.createElement('section');root.className='m10-boss';root.setAttribute('aria-label','보스전: 4시 29분의 남자');
  root.innerHTML=`<style>
.m10-boss{position:relative;width:100%;height:100%;overflow:hidden;background:#eadfc9;color:#25493e;font-family:inherit;isolation:isolate}
.m10-boss *{box-sizing:border-box}.m10-boss .m10-scene{position:absolute;left:0;top:0;width:59%;height:100%;overflow:hidden}.m10-boss canvas{display:block;width:100%;height:100%}
.m10-boss .m10-heading{position:absolute;left:24px;top:24px;right:82px;z-index:2;pointer-events:none}.m10-boss .m10-eyebrow{font-size:11px;font-weight:800;letter-spacing:2px}.m10-boss h2{font-size:clamp(20px,2.4vw,34px);margin:5px 0}.m10-boss .m10-instruction{margin:0;font-size:14px;font-weight:700}
.m10-boss .m10-meter{position:absolute;left:24px;right:24px;bottom:26px;z-index:2;font-weight:800}.m10-boss .m10-meter-label{display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px}.m10-boss .m10-track{height:12px;background:#fffc;border:1px solid #a5ad8b;border-radius:20px;overflow:hidden}.m10-boss .m10-fill{height:100%;width:0;background:#df8259;transition:width .1s linear}
.m10-boss .m10-editor{position:absolute;top:112px;right:24px;bottom:24px;width:40%;display:flex;flex-direction:column;gap:10px;background:#fffdf4f5;border:1px solid #fff;border-radius:24px;padding:22px;box-shadow:0 12px 50px #30423720;overflow:auto}.m10-boss .m10-write-label{font-size:16px;font-weight:850;margin:0;display:flex;justify-content:space-between;gap:10px}.m10-boss .m10-count{color:#a26546;white-space:nowrap}
.m10-boss .m10-shields{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.m10-boss .m10-shield{font-family:inherit;font-size:14px;font-weight:800;min-height:48px;border-radius:12px;border:1px solid #cbd3c2;background:#edf0e7;color:#65716a;padding:8px 4px;cursor:pointer;box-shadow:none}.m10-boss .m10-shield::before{content:'◇';display:inline-block;margin-right:6px;font-size:20px;vertical-align:middle}.m10-boss .m10-shield.lit{color:#214b38;background:#d5edb0;border-color:#8bad70;box-shadow:inset 0 0 0 1px #a2c77a}.m10-boss .m10-shield.lit::before{content:'⬟';color:#629255}.m10-boss .m10-shield:focus-visible{outline:3px solid #dd946b;outline-offset:2px}
.m10-boss textarea{display:block;width:100%;min-height:140px;flex:1;resize:none;font:16px/1.7 system-ui,sans-serif;border:1px solid #cad2bf;border-radius:12px;padding:14px;color:#25493e;background:#fff;touch-action:auto;user-select:text;outline:none;box-shadow:none}.m10-boss textarea:focus{border-color:#6e9579;box-shadow:0 0 0 3px #9ebd8a33}.m10-boss textarea:read-only{background:#f2efdf}
.m10-boss .m10-tip{font-size:12px;line-height:1.5;min-height:19px;margin:0;color:#64725d}.m10-boss .m10-leave,.m10-boss .m10-retry{border:0;border-radius:14px;background:#285541;color:white;font-size:16px;line-height:1.5;font-weight:800;padding:14px;min-height:50px;cursor:pointer;box-shadow:none}.m10-boss .m10-leave:disabled{background:#d8ded0;color:#778573;cursor:default}.m10-boss .m10-retry{background:#b77650}.m10-boss .m10-retry[hidden]{display:none}.m10-boss .m10-leave:focus-visible,.m10-boss .m10-retry:focus-visible{outline:3px solid #e8a56c;outline-offset:3px}
.m10-boss .m10-bubble{all:unset;position:absolute;z-index:2;padding:9px 14px;border-radius:15px;background:#fffdf2;border:1px solid #b6be99;color:#385540;box-shadow:0 5px 12px #3332;font:800 13px/1.4 system-ui,sans-serif;white-space:nowrap;transform:translate(-50%,-100%);cursor:pointer;max-width:94%;text-align:center}.m10-boss .m10-bubble[hidden]{display:none}.m10-boss .m10-burst{position:absolute;left:50%;top:37%;transform:translate(-50%,-50%);font-size:52px;color:#8caa47;font-weight:900;text-shadow:0 2px 10px #fff;pointer-events:none;opacity:0}.m10-boss .m10-burst.show{opacity:1}.m10-boss .m10-sr{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.m10-boss.m10-done .m10-leave{background:#9ca662}
@media(max-width:760px){.m10-boss .m10-heading{top:16px;left:16px;right:65px}.m10-boss .m10-eyebrow{font-size:9px}.m10-boss h2{font-size:21px}.m10-boss .m10-instruction{font-size:12px}.m10-boss .m10-scene{width:100%;height:43%}.m10-boss .m10-meter{left:16px;right:16px;bottom:12px}.m10-boss .m10-meter-label{font-size:11px;margin-bottom:4px}.m10-boss .m10-editor{top:43%;left:10px;right:10px;bottom:10px;width:auto;border-radius:18px;padding:13px;gap:7px}.m10-boss .m10-write-label{font-size:14px}.m10-boss .m10-shields{gap:5px}.m10-boss .m10-shield{min-height:36px;padding:4px;font-size:12px}.m10-boss .m10-shield::before{font-size:16px}.m10-boss textarea{min-height:80px;padding:10px;font-size:16px;line-height:1.5}.m10-boss .m10-tip{font-size:11px;min-height:16px}.m10-boss .m10-leave,.m10-boss .m10-retry{padding:9px;min-height:42px;font-size:14px}.m10-boss .m10-bubble{font-size:11px;padding:6px 9px}.m10-boss .m10-track{height:8px}}
@media(max-height:560px) and (min-width:761px){.m10-boss .m10-editor{top:80px;bottom:10px;padding:12px;gap:6px}.m10-boss .m10-heading{top:12px}.m10-boss h2{font-size:22px}.m10-boss .m10-shield{min-height:36px;padding:4px}.m10-boss textarea{min-height:90px}.m10-boss .m10-leave{padding:8px;min-height:40px}}
</style>
<div class="m10-scene"><canvas aria-label="다가오는 교장선생님과 여섯 방패, 닫힌 교문"></canvas><button class="m10-bubble" aria-label="교장 말풍선 건너뛰기"></button><div class="m10-burst" aria-hidden="true">⬟</div><div class="m10-meter"><div class="m10-meter-label"><span>훈화 게이지</span><span class="m10-time"></span></div><div class="m10-track" role="progressbar" aria-label="훈화 게이지" aria-valuemin="0" aria-valuemax="100"><div class="m10-fill"></div></div></div></div>
<header class="m10-heading"><span class="m10-eyebrow">FINAL MISSION · 16:29</span><h2>4시 29분의 남자</h2><p class="m10-instruction">⌨ 프롬프트로 방패 5개를 켜세요.</p></header>
<div class="m10-editor"><label class="m10-write-label" for="m10-prompt">AI에게 할 부탁 <span class="m10-count">0 / 6</span></label><div class="m10-shields" aria-label="프롬프트 방패 체크리스트"></div><textarea id="m10-prompt" aria-label="환경생태 자료 제작 프롬프트" placeholder="너는 과학 자료 개발 도우미야. 초등학교 5학년이…" spellcheck="false"></textarea><p class="m10-tip" role="status" aria-live="polite">방패를 누르면 짧은 예시가 보여요.</p><button class="m10-leave" disabled>오늘은 퇴근하겠습니다</button><button class="m10-retry" hidden>↻ 쓴 글 그대로 다시 도전</button></div><div class="m10-sr" role="status" aria-live="polite"></div>`;
  container.appendChild(root);
  const $=selector=>root.querySelector(selector),pane=$('.m10-scene'),canvas=$('canvas'),textarea=$('textarea'),tip=$('.m10-tip'),leave=$('.m10-leave'),retry=$('.m10-retry'),count=$('.m10-count'),time=$('.m10-time'),meter=$('.m10-track'),fill=$('.m10-fill'),bubble=$('.m10-bubble'),burst=$('.m10-burst'),announce=$('.m10-sr');
  textarea.value=attempt.draft;
  function listen(target,type,fn,opts){target.addEventListener(type,fn,opts);cleanups.push(()=>target.removeEventListener(type,fn,opts));}
  function cue(sound){data.runtime?.playSound?.(sound);}
  const buttons=new Map();
  for(const rule of rules){const button=document.createElement('button');button.type='button';button.className='m10-shield';button.dataset.shield=rule.id;button.textContent=rule.label;button.setAttribute('aria-label',`${rule.label} 방패: ${rule.help}`);button.setAttribute('aria-pressed','false');$('.m10-shields').appendChild(button);buttons.set(rule.id,button);listen(button,'click',()=>{tip.textContent=rule.help;});}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#efc998');
  const camera=new THREE.PerspectiveCamera(45,1,.1,80);
  scene.add(new THREE.HemisphereLight('#fff6dc','#657e69',3));const sun=new THREE.DirectionalLight('#ffe7b4',2.5);sun.position.set(-8,14,10);scene.add(sun);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});}catch{renderer=new SoftwareRenderer({canvas});}
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(renderer.isSoftware ? .75 : Math.min(globalThis.devicePixelRatio||1,1.5));
  function material(color,basic=false,extra={}){const m=basic?new THREE.MeshBasicMaterial({color,...extra}):new THREE.MeshStandardMaterial({color,roughness:.85,...extra});materials.add(m);return m;}
  function mesh(geo,mat,parent=scene,position=[0,0,0]){geometries.add(geo);const object=new THREE.Mesh(geo,mat);object.position.set(...position);parent.add(object);return object;}
  function box(x,y,z,w,h,d,color,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),material(color),parent,[x,y,z]);}
  function ball(x,y,z,size,color,parent=scene){return mesh(new THREE.IcosahedronGeometry(size,1),material(color),parent,[x,y,z]);}
  box(0,-.16,0,18,.3,20,'#c0b392');box(0,.005,1,6,.04,16,'#e8d9b7');
  for(const side of[-1,1]){box(side*6.5,.03,-1,5,.08,18,'#a7b27c');for(const z of[-6,2,7]){box(side*6.6,1.2,z,.45,2.4,.45,'#87694c');ball(side*6.6,3,z,1.7,'#7f9b65');}}
  box(0,.02,-7.1,18,.1,3.5,'#7e8980');for(const x of[-6,-2,2,6])box(x,.09,-7.1,1.8,.025,.12,'#f0e0a1');
  for(const side of[-1,1]){box(side*4.3,1.7,-4.6,.75,3.4,.75,'#eadfc1');box(side*4.3,3.5,-4.6,.95,.2,.95,'#59705c');box(side*6.8,1.15,-4.6,4.3,2.3,.3,'#d7c7a3');}
  const gates=[-1,1].map(side=>{const pivot=new THREE.Group();pivot.position.set(side*4,0,-4.6);scene.add(pivot);for(let i=0;i<8;i++)box(-side*(i*.5+.2),1.3,0,.08,2.6,.1,'#496654',pivot);box(-side*2,.45,0,4,.09,.14,'#496654',pivot);box(-side*2,2.2,0,4,.09,.14,'#496654',pivot);return{pivot,side};});
  box(0,4.2,-4.6,9,.7,.4,'#f5edcf');
  const labelCanvas=document.createElement('canvas');labelCanvas.width=768;labelCanvas.height=96;const lc=labelCanvas.getContext('2d');lc.fillStyle='#f5edcf';lc.fillRect(0,0,768,96);lc.font='900 52px sans-serif';lc.textAlign='center';lc.textBaseline='middle';lc.fillStyle='#3c5b45';lc.fillText('퇴 근 초 등 학 교',384,49);
  const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;textures.add(labelTexture);mesh(new THREE.PlaneGeometry(8.8,.68),material('#fff',true,{map:labelTexture,side:THREE.DoubleSide}),scene,[0,4.2,-4.36]);
  // The waiting car is visible when the two gate leaves open.
  const car=new THREE.Group();car.position.set(2,0,-7.1);scene.add(car);box(0,.55,0,2.3,.7,1.1,'#d2ad77',car);box(0,1,.1,1.2,.6,.95,'#f4ebd5',car);box(0,1.03,.59,1.05,.4,.035,'#719096',car);for(const x of[-.8,.8])for(const z of[-.55,.55])ball(x,.25,z,.25,'#3f4d43',car);
  const principal=new THREE.Group();principal.name='m10-principal';scene.add(principal);const limbs=[];
  for(const side of[-1,1]){const leg=new THREE.Group();leg.position.set(side*.2,.75,0);principal.add(leg);box(0,-.3,0,.26,.6,.32,'#424b46',leg);box(0,-.63,.12,.3,.17,.46,'#293a34',leg);limbs.push(leg);const arm=new THREE.Group();arm.position.set(side*.49,1.5,0);principal.add(arm);box(0,-.28,0,.25,.6,.3,'#426256',arm);ball(0,-.61,0,.15,'#e6b991',arm);limbs.push(arm);}
  box(0,1.19,0,.83,.9,.5,'#426256',principal);box(0,1.48,.27,.33,.45,.03,'#fff4d7',principal);box(0,1.32,.3,.12,.48,.04,'#bc795a',principal);ball(0,2.12,0,.47,'#e6b991',principal);const hair=ball(0,2.39,-.04,.43,'#657064',principal);hair.scale.y=.52;for(const x of[-.17,.17]){box(x,2.16,.42,.28,.18,.07,'#d0d8c6',principal);box(x,2.16,.465,.05,.06,.025,'#253d34',principal);}box(0,2.16,.44,.1,.035,.03,'#5d6554',principal);
  box(.65,1.2,.13,.43,.55,.06,'#f3e8cc',principal);box(.65,1.4,.17,.32,.02,.02,'#998e6c',principal);
  const shieldShape=new THREE.Shape();shieldShape.moveTo(0,.42);shieldShape.lineTo(.34,.24);shieldShape.lineTo(.28,-.23);shieldShape.lineTo(0,-.48);shieldShape.lineTo(-.28,-.23);shieldShape.lineTo(-.34,.24);shieldShape.closePath();
  const shieldMeshes=rules.map((rule,i)=>{const mat=material('#c6c5a7',true,{side:THREE.DoubleSide});const shield=mesh(new THREE.ShapeGeometry(shieldShape),mat,scene,[(i-2.5)*.88,1.1,3.7]);shield.rotation.x=-.08;return{rule,shield,mat};});
  const lines=arcade.npcLines||['선생님, 퇴근 전에 잠깐만요~','아주 간단한 건데요. 오늘 중으로…','좋네요. 그럼 이것도 하나만 더…'];
  let burstLeft=0,width=1,height=1;
  function updateUI(){const result=attempt.result;count.textContent=`${result.count} / 6`;count.style.color=result.passed?'#3d7845':'#a26546';leave.disabled=!result.passed||attempt.phase!=='playing';for(const rule of result.checks){const b=buttons.get(rule.id);b.classList.toggle('lit',rule.passed);b.setAttribute('aria-pressed',String(rule.passed));const visual=shieldMeshes.find(v=>v.rule.id===rule.id);visual.mat.color.set(rule.passed?'#bce583':'#9d9e8b');}textarea.readOnly=attempt.phase!=='playing';}
  function showDraft(){if(destroyed||paused||document.hidden||attempt.phase!=='playing')return;const newlyLit=applyBossDraft(attempt,textarea.value);updateUI();if(newlyLit){cue('success');burstLeft=.7;tip.textContent=attempt.result.passed?'✓ 방패 준비 완료! 퇴근할 수 있어요.':'✓ 방패 충전! 교장선생님이 물러나요.';announce.textContent=`방패 ${attempt.result.count}개`;}
    container.dispatchEvent(new CustomEvent('boss-draft',{bubbles:true,detail:{prompt:attempt.draft}}));
  }
  listen(textarea,'input',showDraft);
  listen(textarea,'keydown',event=>{event.stopPropagation();});listen(textarea,'keyup',event=>{event.stopPropagation();});
  listen(bubble,'click',()=>{bubbleIndex++;bubbleLeft=2;});
  listen(leave,'click',()=>{if(paused||document.hidden||destroyed||!submitBossAttempt(attempt))return;updateUI();bubble.hidden=true;tip.textContent='✓ 오늘의 범위 완료. 퇴근합니다!';root.classList.add('m10-done');cue('success');});
  listen(retry,'click',()=>{if(paused||document.hidden||destroyed)return;attempt=createBossAttempt(textarea.value,arcade.duration);last=performance.now();retry.hidden=true;leave.hidden=false;bubbleIndex=0;bubbleLeft=2;root.classList.remove('m10-done');principal.scale.setScalar(1);gates.forEach(({pivot})=>pivot.rotation.y=0);tip.textContent='쓴 글은 그대로예요. 이어서 완성해요.';updateUI();textarea.focus();});
  function timeout(){textarea.readOnly=true;leave.hidden=true;retry.hidden=false;updateUI();tip.textContent='⌛ 훈화 시작! 쓴 글 그대로 재도전해요.';announce.textContent='시간 종료. 쓴 글을 유지하고 다시 도전할 수 있습니다.';cue('error');onFail({reason:'timeout',tip:'쓴 글을 유지하고 다시 도전해요.'});if(!destroyed)retry.focus();}
  function resize(){if(destroyed)return;const r=pane.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setSize(width,height);camera.aspect=width/height;const small=width>height*1.6;camera.position.set(0,small?7:5.5,small?15:12.5);camera.lookAt(0,1,small?-1.4:0);camera.updateProjectionMatrix();renderer.render(scene,camera);}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(pane);listen(window,'resize',resize);listen(document,'visibilitychange',()=>{last=performance.now();});
  const anchor=new THREE.Vector3();
  function frame(now){if(destroyed)return;raf=requestAnimationFrame(frame);const delta=Math.max(0,(now-last)/1000);last=now;if(paused||document.hidden)return;const dt=Math.min(.1,delta);sceneTime+=dt;
    if(attempt.phase==='playing'){if(advanceBossAttempt(attempt,delta))timeout();if(destroyed)return;}
    const ratio=attempt.elapsed/attempt.duration;time.textContent=`${Math.max(0,Math.ceil(attempt.duration-attempt.elapsed))}초`;fill.style.width=`${ratio*100}%`;meter.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
    if(attempt.phase==='winning'){attempt.celebration+=delta;const t=clamp(attempt.celebration/1.35,0,1);principal.scale.setScalar(Math.max(.04,1-t*.96));principal.rotation.y=t*Math.PI*2;principal.position.y=t*.3;gates.forEach(({pivot,side})=>pivot.rotation.y=-side*t*Math.PI*.48);leave.textContent='✓ 오늘은 퇴근합니다!';if(t>=1&&!attempt.awarded){attempt.awarded=true;attempt.phase='won';onWin({prompt:attempt.draft,rubric:attempt.result.checks,elapsed:attempt.elapsed});if(destroyed)return;}}
    else if(attempt.phase==='playing'||attempt.phase==='timeout'){principal.position.set(0,0,-1.2+ratio*4.3-attempt.kick);principal.rotation.y=0;const swing=attempt.phase==='playing'?Math.sin(sceneTime*4)*.22:0;limbs.forEach((limb,i)=>limb.rotation.x=swing*(i%2?-.7:1)*(i<2?1:-1));}
    for(const [i,item]of shieldMeshes.entries()){item.shield.position.y=1.1+Math.sin(sceneTime*2+i)*.06;item.shield.scale.setScalar(attempt.result.checks[i].passed?1.15:1);}
    burstLeft=Math.max(0,burstLeft-dt);burst.classList.toggle('show',burstLeft>0);
    if(attempt.phase==='playing'){bubbleLeft-=delta;if(bubbleLeft<=0){bubbleIndex++;bubbleLeft=2;}bubble.textContent=lines[bubbleIndex%lines.length];principal.getWorldPosition(anchor);anchor.y+=2.8;anchor.project(camera);bubble.style.left=`${clamp((anchor.x+1)*width/2,100,Math.max(100,width-100))}px`;bubble.style.top=`${clamp((1-anchor.y)*height/2,115,Math.max(115,height-55))}px`;bubble.hidden=false;}else bubble.hidden=true;
    renderer.render(scene,camera);
  }
  updateUI();resize();raf=requestAnimationFrame(frame);
  return {getDraft:()=>attempt.draft,pause(){paused=true;last=performance.now();},resume(){paused=false;last=performance.now();},hint(){if(destroyed)return;const missing=attempt.result.checks.find(rule=>!rule.passed);tip.textContent=missing?`${missing.label}: ${rules.find(rule=>rule.id===missing.id).help}`:'✓ 다섯 방패면 퇴근할 수 있어요.';},destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(raf);observer?.disconnect();cleanups.forEach(fn=>fn());textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();scene.clear();root.remove();}};
}
