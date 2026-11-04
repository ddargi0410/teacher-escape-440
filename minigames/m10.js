import * as THREE from '../vendor/three.module.js';
import {SoftwareRenderer} from '../software-renderer.js';

// Local checklist, not an AI judge. No minimum/maximum prompt length.
const SHIELDS = [
  {id:'role',label:'역할',help:'과학 자료 개발 도우미'},
  {id:'audience',label:'대상',help:'초등학교 5학년'},
  {id:'topic',label:'주제',help:'생태계 · 먹이사슬'},
  {id:'format',label:'형식',help:'생물 순서 맞추기 게임'},
  {id:'constraints',label:'조건',help:'큰 글씨 · 개인정보 제외'},
  {id:'output',label:'출력',help:'HTML 파일 · 실행 코드'}
];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function evaluateBossPrompt(value) {
  const text=String(value??'').normalize('NFKC').replace(/\s+/g,' ');
  const tests={
    role:/(?:개발\s*도우미|개발자|프로그래머|전문가|코딩\s*도우미|교사처럼|선생님처럼|수업\s*설계자|(?:너는|당신은)[^.!?]{0,30}(?:도우미|개발|교사|선생|제작|설계))/i,
    audience:/(?:초등(?:학교|학생)?\s*(?:[1-6일이삼사오육]\s*학년)?|[1-6일이삼사오육]\s*학년\s*(?:학생|어린이)?)/,
    topic:/(?:생태|생물|환경|먹이\s*(?:관계|사슬|그물)|생산자|소비자|분해자|식물|동물|학교\s*숲)/,
    format:/(?:퀴즈|미니\s*게임|게임|도감|관찰\s*(?:일지|기록)|학습지|시뮬레이션|탐사\s*(?:앱|대)|카드\s*(?:뉴스|자료)?|웹\s*(?:앱|자료|사이트)|수업\s*자료|웹\s*활동|생물\s*카드|카드(?:를)?[^.!?]{0,30}(?:배치|놓|연결)|화살표(?:로)?\s*연결)/,
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
  let destroyed=false,paused=false,hintOpen=false,hintStep=0,raf=0,last=performance.now(),sceneTime=0,bubbleIndex=0,bubbleLeft=2;
  const cleanups=[],materials=new Set(),geometries=new Set(),textures=new Set();
  const root=document.createElement('section');root.className='m10-boss';root.setAttribute('aria-label','보스전: 4시 29분의 남자');
  root.innerHTML=`<style>
.m10-boss{position:relative;width:100%;height:100%;overflow:hidden;background:#eadfc9;color:#193d32;font-family:inherit;isolation:isolate}
.m10-boss *{box-sizing:border-box}.m10-boss .m10-scene{position:absolute;left:0;top:0;width:49%;height:100%;overflow:hidden}.m10-boss canvas{display:block;width:100%;height:100%}
.m10-boss .m10-heading{position:absolute;left:24px;top:24px;width:calc(49% - 48px);z-index:2;pointer-events:none;background:#fffdf2eb;padding:16px 18px;border-radius:18px}.m10-boss .m10-eyebrow{font-size:14px;font-weight:800;letter-spacing:1px}.m10-boss h2{font-size:clamp(25px,2.5vw,36px);line-height:1.3;margin:7px 0}.m10-boss .m10-instruction{margin:0;font-size:18px;line-height:1.5;font-weight:700}
.m10-boss .m10-meter{position:absolute;left:24px;right:24px;bottom:26px;z-index:2;font-weight:800;background:#fffdf2e8;border-radius:14px;padding:13px}.m10-boss .m10-meter-label{display:flex;justify-content:space-between;font-size:17px;margin-bottom:9px}.m10-boss .m10-track{height:14px;background:#fff;border:1px solid #7e977d;border-radius:20px;overflow:hidden}.m10-boss .m10-fill{height:100%;width:0;background:#d9663e;transition:width .1s linear}
.m10-boss .m10-editor{position:absolute;top:18px;right:18px;bottom:18px;width:50%;display:flex;flex-direction:column;gap:12px;background:#fffdf5;border:1px solid #fff;border-radius:22px;padding:22px;box-shadow:0 12px 50px #30423720;overflow:auto}.m10-boss .m10-task{margin:0;background:#e8f0df;border-left:5px solid #507047;padding:12px 14px;border-radius:10px;font-size:18px;line-height:1.6}.m10-boss .m10-task strong{display:block;font-size:22px;line-height:1.35;margin-bottom:5px}.m10-boss .m10-write-label{font-size:20px;font-weight:850;margin:0;display:flex;justify-content:space-between;gap:10px}.m10-boss .m10-count{color:#8d4e2f;white-space:nowrap}
.m10-boss .m10-shields{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.m10-boss .m10-shield{font-family:inherit;font-size:17px;line-height:1.35;font-weight:800;min-height:76px;border-radius:12px;border:1px solid #aebda6;background:#edf0e7;color:#304d3c;padding:10px 8px;cursor:pointer;box-shadow:none;text-align:left}.m10-boss .m10-shield::before{content:'◇';display:inline-block;margin-right:5px;font-size:21px;vertical-align:middle}.m10-boss .m10-shield-help{display:block;margin-top:5px;font-size:15px;font-weight:600;line-height:1.45;overflow-wrap:anywhere}.m10-boss .m10-shield.lit{color:#183d29;background:#d5edb0;border-color:#709351;box-shadow:inset 0 0 0 1px #a2c77a}.m10-boss .m10-shield.lit::before{content:'✓';color:#376b2f}.m10-boss button:focus-visible{outline:3px solid #c96639;outline-offset:3px}
.m10-boss textarea{display:block;width:100%;min-height:160px;flex:1;resize:vertical;font:18px/1.7 system-ui,sans-serif;border:2px solid #8eaa85;border-radius:12px;padding:15px;color:#193d32;background:#fff;touch-action:auto;user-select:text;outline:none;box-shadow:none}.m10-boss textarea::placeholder{color:#52634f;opacity:1}.m10-boss textarea:focus{border-color:#396946;box-shadow:0 0 0 3px #9ebd8a55}.m10-boss textarea:read-only{background:#f2efdf}
.m10-boss .m10-tip{font-size:16px;line-height:1.5;min-height:24px;margin:0;color:#3e593b}.m10-boss .m10-hint-button,.m10-boss .m10-hint-next,.m10-boss .m10-hint-insert,.m10-boss .m10-hint-close,.m10-boss .m10-leave,.m10-boss .m10-retry{font:800 18px/1.5 system-ui,sans-serif;border:0;border-radius:12px;background:#285541;color:white;padding:12px 15px;min-height:50px;cursor:pointer;box-shadow:none;white-space:normal}.m10-boss .m10-hint-button{color:#193d32;background:#f8e2a4;border:1px solid #bda86a;flex-shrink:0}.m10-boss .m10-leave:disabled{background:#d8ded0;color:#52634b;cursor:default}.m10-boss .m10-retry{background:#9d5c36}.m10-boss [hidden]{display:none!important}
.m10-boss .m10-bubble{all:unset;position:absolute;z-index:2;padding:9px 14px;border-radius:15px;background:#fffdf2;border:1px solid #8d9b76;color:#244730;box-shadow:0 5px 12px #3332;font:800 16px/1.4 system-ui,sans-serif;white-space:nowrap;transform:translate(-50%,-100%);cursor:pointer;max-width:94%;text-align:center}.m10-boss .m10-burst{position:absolute;left:50%;top:37%;transform:translate(-50%,-50%);font-size:52px;color:#8caa47;font-weight:900;text-shadow:0 2px 10px #fff;pointer-events:none;opacity:0}.m10-boss .m10-burst.show{opacity:1}.m10-boss .m10-sr{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.m10-boss.m10-done .m10-leave{background:#68833c}
.m10-boss .m10-hints{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:#142d29c9;padding:24px;touch-action:auto}.m10-boss .m10-hint-sheet{width:min(720px,100%);max-height:92dvh;overflow:auto;background:#fffdf4;border-radius:24px;padding:28px;color:#193d32;box-shadow:0 16px 60px #0005}.m10-boss .m10-hint-progress{font-size:16px;font-weight:800;color:#4d6548}.m10-boss .m10-hint-sheet h3{font-size:28px;line-height:1.35;margin:12px 0}.m10-boss .m10-hint-copy{font-size:21px;line-height:1.8;white-space:pre-wrap;margin:16px 0 22px;word-break:keep-all;overflow-wrap:anywhere}.m10-boss .m10-hint-actions{display:flex;flex-wrap:wrap;gap:10px}.m10-boss .m10-hint-close{background:#ebeee2;color:#193d32;border:1px solid #9eac91}.m10-boss .m10-hint-insert{background:#a15d31}.m10-boss .m10-hint-insert:disabled{opacity:.65;cursor:default}
@media(max-width:900px){.m10-boss .m10-editor{padding:16px}.m10-boss .m10-task strong{font-size:20px}.m10-boss .m10-shield-help{font-size:15px}}
@media(max-width:760px){.m10-boss{overflow:auto;touch-action:pan-y}.m10-boss .m10-scene{position:relative;width:100%;height:200px}.m10-boss .m10-heading{top:12px;left:12px;width:calc(100% - 24px);padding:10px 14px}.m10-boss .m10-eyebrow{display:none}.m10-boss h2{font-size:24px;margin:0 0 3px}.m10-boss .m10-instruction{font-size:16px}.m10-boss .m10-meter{left:12px;right:12px;bottom:8px;padding:7px 10px}.m10-boss .m10-meter-label{font-size:15px;margin-bottom:5px}.m10-boss .m10-editor{position:relative;top:auto;left:auto;right:auto;bottom:auto;width:auto;margin:10px 10px 16px;border-radius:18px;padding:15px;gap:12px;overflow:visible}.m10-boss .m10-write-label{font-size:19px}.m10-boss .m10-shields{grid-template-columns:repeat(2,1fr);gap:8px}.m10-boss .m10-shield{min-height:70px;padding:9px;font-size:17px}.m10-boss .m10-shield-help{font-size:15px}.m10-boss textarea{min-height:180px;font-size:18px;line-height:1.65;flex:none}.m10-boss .m10-tip{font-size:16px}.m10-boss .m10-bubble{font-size:14px;padding:6px 9px}.m10-boss .m10-track{height:10px}.m10-boss .m10-hints{padding:12px}.m10-boss .m10-hint-sheet{padding:22px 18px;border-radius:18px}.m10-boss .m10-hint-sheet h3{font-size:25px}.m10-boss .m10-hint-copy{font-size:19px}.m10-boss .m10-hint-actions>*{width:100%}}
@media(max-height:560px) and (min-width:761px){.m10-boss .m10-editor{top:12px;bottom:12px}.m10-boss .m10-heading{top:12px;padding:12px}.m10-boss h2{font-size:26px}.m10-boss textarea{min-height:140px}}
</style>
<div class="m10-scene"><canvas aria-label="다가오는 교장선생님과 여섯 방패, 닫힌 교문"></canvas><button class="m10-bubble" aria-label="교장 말풍선 건너뛰기"></button><div class="m10-burst" aria-hidden="true">⬟</div><div class="m10-meter"><div class="m10-meter-label"><span>훈화 게이지</span><span class="m10-time"></span></div><div class="m10-track" role="progressbar" aria-label="훈화 게이지" aria-valuemin="0" aria-valuemax="100"><div class="m10-fill"></div></div></div></div>
<header class="m10-heading"><span class="m10-eyebrow">FINAL MISSION · 16:29</span><h2>4시 29분의 남자</h2><p class="m10-instruction">요청문으로 방패 5개를 켜고 퇴근!</p></header>
<div class="m10-editor"><p class="m10-task"><strong>5학년 먹이사슬 활동 만들기</strong>생물을 순서대로 놓고 화살표로 연결하는 <b>HTML 수업자료</b>를 AI에게 부탁하세요.</p><button class="m10-hint-button" aria-label="입력이 막힐 때 힌트 보기">💡 무엇을 쓰지? 힌트 보기</button><label class="m10-write-label" for="m10-prompt">AI에게 할 부탁 <span class="m10-count">0 / 6</span></label><textarea id="m10-prompt" aria-label="5학년 먹이사슬 활동 제작 프롬프트" aria-describedby="m10-prompt-help" placeholder="예: 너는 과학 자료 개발자야. 초등 5학년이 생물 카드를 놓고 먹이사슬을 연결하는 게임을 만들어 줘.&#10;&#10;큰 글씨, 오답 설명, HTML 파일처럼 필요한 조건도 이어 써 보세요." spellcheck="false"></textarea><div class="m10-shields" aria-label="프롬프트 방패 체크리스트"></div><p class="m10-tip" id="m10-prompt-help" role="status" aria-live="polite">완벽한 문장이 아니어도 괜찮아요. 6개 중 5개면 통과!</p><button class="m10-leave" disabled>오늘은 퇴근하겠습니다</button><button class="m10-retry" hidden>↻ 쓴 글 그대로 다시 도전</button></div>
<div class="m10-hints" hidden><section class="m10-hint-sheet" role="dialog" aria-modal="true" aria-labelledby="m10-hint-title"><div class="m10-hint-progress"></div><h3 id="m10-hint-title"></h3><p class="m10-hint-copy"></p><div class="m10-hint-actions"><button class="m10-hint-next">다음 힌트</button><button class="m10-hint-insert" hidden>예시를 입력칸에 넣기</button><button class="m10-hint-close">직접 써 보기</button></div></section></div><div class="m10-sr" role="status" aria-live="polite"></div>`;
  container.appendChild(root);
  const $=selector=>root.querySelector(selector),pane=$('.m10-scene'),canvas=$('canvas'),textarea=$('textarea'),tip=$('.m10-tip'),leave=$('.m10-leave'),retry=$('.m10-retry'),count=$('.m10-count'),time=$('.m10-time'),meter=$('.m10-track'),fill=$('.m10-fill'),bubble=$('.m10-bubble'),burst=$('.m10-burst'),announce=$('.m10-sr');
  textarea.value=attempt.draft;
  const hintButton=$('.m10-hint-button'),hintOverlay=$('.m10-hints'),hintSheet=$('.m10-hint-sheet'),hintNext=$('.m10-hint-next'),hintInsert=$('.m10-hint-insert'),hintClose=$('.m10-hint-close');
  const sample=arcade.sample||'너는 초등 과학 자료 개발자야. 초등학교 5학년이 생태계의 먹이사슬을 배우는 게임을 만들어 줘. 학생이 풀·메뚜기·개구리 카드를 순서대로 놓고 먹히는 생물에서 먹는 생물로 화살표를 연결하게 해 줘. 오답이면 이유를 알려 주고 다시 해 보게 해 줘. 큰 글씨로 만들고 개인정보는 받지 마. 브라우저에서 실행할 HTML 파일로 만들어 줘.';
  const hints=Array.isArray(arcade.hints)&&arcade.hints.length?arcade.hints:[
    {title:'먼저, 누구를 위한 자료인가요?',text:'“너는 초등 과학 자료 개발자야. 초등학교 5학년이 먹이사슬을 배우는 게임을 만들어 줘.”\n\nAI의 역할, 학생의 학년, 배울 주제를 먼저 적어 보세요.'},
    {title:'학생이 할 행동을 알려 주세요',text:'“생물 카드를 순서대로 놓고 화살표로 연결하게 해 줘. 틀리면 이유를 보여 줘.”\n\n이어서 “큰 글씨, 개인정보 없이, HTML 파일로”처럼 필요한 조건과 결과물도 부탁하세요.'},
    {title:'이 예시를 내 말로 바꿔 보세요',text:sample}
  ];
  function renderHint(){const item=hints[hintStep];$('.m10-hint-progress').textContent=`힌트 ${hintStep+1} / ${hints.length} · 읽는 동안 시간 정지`;
    $('#m10-hint-title').textContent=typeof item==='string'?'먹이사슬 자료 부탁하기':item.title;$('.m10-hint-copy').textContent=typeof item==='string'?item:item.text;
    hintNext.hidden=hintStep===hints.length-1;hintInsert.hidden=hintStep!==hints.length-1;hintInsert.disabled=attempt.phase!=='playing';hintInsert.textContent=attempt.draft.trim()?'쓴 글 뒤에 예시 붙이기':'예시를 입력칸에 넣기';
  }
  function openHint(){if(destroyed||attempt.phase==='winning'||attempt.phase==='won')return;hintOpen=true;last=performance.now();hintOverlay.hidden=false;$('.m10-editor').inert=true;renderHint();hintClose.focus();}
  function closeHint(){hintOpen=false;hintOverlay.hidden=true;$('.m10-editor').inert=false;last=performance.now();hintButton.focus();}

  function listen(target,type,fn,opts){target.addEventListener(type,fn,opts);cleanups.push(()=>target.removeEventListener(type,fn,opts));}
  function cue(sound){data.runtime?.playSound?.(sound);}
  const buttons=new Map();
  for(const rule of rules){const button=document.createElement('button');button.type='button';button.className='m10-shield';button.dataset.shield=rule.id;button.textContent=rule.label;const help=document.createElement('span');help.className='m10-shield-help';help.textContent=rule.help;button.appendChild(help);button.setAttribute('aria-label',`${rule.label} 방패: ${rule.help}`);button.setAttribute('aria-pressed','false');$('.m10-shields').appendChild(button);buttons.set(rule.id,button);listen(button,'click',()=>{tip.textContent=rule.help;});}
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
  function showDraft(){if(destroyed||paused||hintOpen||document.hidden||attempt.phase!=='playing')return;const newlyLit=applyBossDraft(attempt,textarea.value);updateUI();if(newlyLit){cue('success');burstLeft=.7;tip.textContent=attempt.result.passed?'✓ 방패 준비 완료! 퇴근할 수 있어요.':'✓ 방패 충전! 교장선생님이 물러나요.';announce.textContent=`방패 ${attempt.result.count}개`;}
    container.dispatchEvent(new CustomEvent('boss-draft',{bubbles:true,detail:{prompt:attempt.draft}}));
  }
  listen(hintButton,'click',openHint);listen(hintNext,'click',()=>{hintStep=Math.min(hints.length-1,hintStep+1);renderHint();if(hintNext.hidden)hintInsert.focus();});listen(hintClose,'click',closeHint);
  listen(hintInsert,'click',()=>{if(attempt.phase!=='playing'||paused||destroyed)return;textarea.value=attempt.draft.trim()?`${attempt.draft}\n\n${sample}`:sample;closeHint();showDraft();textarea.focus();});
  listen(hintSheet,'keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();closeHint();}else if(event.key==='Tab'){const available=[hintNext,hintInsert,hintClose].filter(button=>!button.hidden&&!button.disabled);const index=available.indexOf(document.activeElement);event.preventDefault();available[(index+(event.shiftKey?-1:1)+available.length)%available.length].focus();}});
  listen(textarea,'input',showDraft);
  listen(textarea,'keydown',event=>{event.stopPropagation();});listen(textarea,'keyup',event=>{event.stopPropagation();});
  listen(bubble,'click',()=>{bubbleIndex++;bubbleLeft=2;});
  listen(leave,'click',()=>{if(paused||hintOpen||document.hidden||destroyed||!submitBossAttempt(attempt))return;updateUI();bubble.hidden=true;tip.textContent='✓ 오늘의 범위 완료. 퇴근합니다!';root.classList.add('m10-done');cue('success');});
  listen(retry,'click',()=>{if(paused||hintOpen||document.hidden||destroyed)return;attempt=createBossAttempt(textarea.value,arcade.duration);last=performance.now();retry.hidden=true;leave.hidden=false;bubbleIndex=0;bubbleLeft=2;root.classList.remove('m10-done');principal.scale.setScalar(1);gates.forEach(({pivot})=>pivot.rotation.y=0);tip.textContent='쓴 글은 그대로예요. 이어서 완성해요.';updateUI();textarea.focus();});
  function timeout(){textarea.readOnly=true;leave.hidden=true;retry.hidden=false;updateUI();tip.textContent='⌛ 훈화 시작! 쓴 글 그대로 재도전해요.';announce.textContent='시간 종료. 쓴 글을 유지하고 다시 도전할 수 있습니다.';cue('error');onFail({reason:'timeout',tip:'쓴 글을 유지하고 다시 도전해요.'});if(!destroyed)retry.focus();}
  function resize(){if(destroyed)return;const r=pane.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setSize(width,height);camera.aspect=width/height;const small=width>height*1.6;camera.position.set(0,small?7:5.5,small?15:12.5);camera.lookAt(0,1,small?-1.4:0);camera.updateProjectionMatrix();renderer.render(scene,camera);}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(pane);listen(window,'resize',resize);listen(document,'visibilitychange',()=>{last=performance.now();});
  const anchor=new THREE.Vector3();
  function frame(now){if(destroyed)return;raf=requestAnimationFrame(frame);const delta=Math.max(0,(now-last)/1000);last=now;if(paused||hintOpen||document.hidden)return;const dt=Math.min(.1,delta);sceneTime+=dt;
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
  return {getDraft:()=>attempt.draft,isPaused:()=>paused||hintOpen,pause(){paused=true;last=performance.now();},resume(){paused=false;last=performance.now();},hint:openHint,destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(raf);observer?.disconnect();cleanups.forEach(fn=>fn());textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();scene.clear();root.remove();}};
}
