/** Optional, local demonstrations. This room neither calls AI nor awards mission stamps. */
export const LEARNING_STEPS = [
  {icon:'✦', label:'바이브 코딩', title:'AI와 말로 대화하며 앱을 만들어요.', core:'ChatGPT·Claude·Gemini 같은 AI에 원하는 앱을 말로 부탁해요. AI가 코드를 만들면, 교사는 실행하고 확인하며 고쳐 가요. 이 방법을 바이브 코딩이라고 불러요.', tip:'코드는 컴퓨터가 할 일을 적은 명령이에요. 최종 판단은 선생님이 해요.'},
  {icon:'⌘', label:'웹의 세 가지', title:'뼈대에 옷을 입히고, 움직여요.', core:'HTML은 내용과 구조, CSS는 모양, JavaScript는 클릭했을 때의 동작을 맡아요.', tip:'코드를 전부 외우지 않아도 역할은 알아 두세요.'},
  {icon:'▦', label:'좋은 요청', title:'다섯 칸을 채우면 덜 엇갈려요.', core:'누가, 누구에게, 무엇을, 어떤 조건으로, 어떤 결과물로 만들지 알려 주세요.', tip:'막연한 “알아서” 대신 수업 장면을 보여 주세요.'},
  {icon:'↻', label:'고쳐 가기', title:'안 되면, 어디가 안 되는지 말해요.', core:'현재 증상과 기대하는 동작을 알려 주세요. 한 부분씩 고치면 무엇이 달라졌는지 확인하기 쉬워요.', tip:'오류 문구가 보이면 그대로 복사해 함께 알려 주세요.'},
  {icon:'✓', label:'교사의 확인', title:'그럴듯해도 한 번 더 확인해요.', core:'AI도 자신 있게 틀릴 수 있어요. 과학 내용과 실행 결과를 확인하고, 학생 개인정보는 빼세요.', tip:'사진·캐릭터·글꼴도 사용 조건을 확인해요.'},
  {icon:'↗', label:'API와 배포', title:'정보를 가져오고, 주소로 나눠요.', core:'API는 다른 서비스에 정보를 요청하는 약속이에요. 배포는 만든 앱을 웹 주소로 접속할 수 있게 올리는 일이에요.', tip:'API 인증키는 서비스 이용 열쇠예요. 공개 코드에 넣지 마세요.'}
];

const PARTS = [
  ['역할','초등 과학 수업자료 제작자처럼'],
  ['대상','4학년이 사용할'],
  ['목표','숲속 생물과 환경의 관계를 배우는'],
  ['조건','큰 글씨와 선택 버튼이 있는'],
  ['출력','웹 퀴즈를 HTML 파일 하나로 만들어 줘.']
];

export function createLearningRoom({container,onClose,onLearned}) {
  let opened=false, disposed=false, index=0, notified=false, returnFocus=null;
  let generated=false, leafSeen=false, webPart='html', webClick=false, service='ChatGPT', quizChoice='';
  let parts=new Set(), repaired=false, count=0, tested=false, checked=new Set(), fetched=false, deployed=false;
  const visited=new Set();
  container.classList.add('learning-overlay');
  container.hidden=true;
  const q=selector=>container.querySelector(selector);
  const all=selector=>[...container.querySelectorAll(selector)];
  const plant='<span class="learn-pot"><span class="learn-stem"></span><span class="learn-leaf left"></span><span class="learn-leaf right"></span><span class="learn-leaf top"></span></span>';

  // Original vector illustrations are drawn from simple shapes; no remote images or logos.
  const svgPlant=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 31V-25" stroke="#608652" stroke-width="4"/><path d="M0 9C-30 8-31-15-27-17C-7-18 2-6 0 9M0-6C3-26 26-30 29-25C31-9 14 3 0-6M0-24C-11-39-9-53-2-57C12-44 11-32 0-24" fill="#87a96b" stroke="#527849" stroke-width="2"/><path d="M-19 24h38l-5 29h-28Z" fill="#cd9e77" stroke="#ac805f" stroke-width="2"/><path d="M-21 22h42v8h-42Z" fill="#dfb38a"/></g>`;
  const arrow=(x1,x2,y,lit=true)=>`<path d="M${x1} ${y}H${x2}" stroke="${lit?'#668c70':'#c8d4be'}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${lit?'0':'6 7'}"/><path d="M${x2-8} ${y-6}l8 6-8 6" fill="none" stroke="${lit?'#668c70':'#c8d4be'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  const label=(x,text)=>`<text x="${x}" y="151" text-anchor="middle" fill="#68816b" font-size="12" font-weight="700">${text}</text>`;
  const frame=(x,w=215,fill='#fffdf7')=>`<rect x="${x}" y="18" width="${w}" height="108" rx="13" fill="${fill}" stroke="#ccd9c0" stroke-width="2"/>`;
  function illustration() {
    let drawing='',description='';
    if(index===0){
      description='선생님이 AI에게 말로 요청하고, AI가 코드를 만들고, 선생님이 완성된 앱을 눌러 확인하는 과정';
      drawing=`${frame(20)}${frame(302,215,generated?'#e5efda':'#f5f6ed')}${frame(585,215,leafSeen?'#e7f1df':'#fffdf7')}
        <g transform="translate(57 76)"><path d="M-15 31q0-32 24-32t25 32" fill="#e9c67d"/><circle cx="10" cy="-19" r="18" fill="#e6b08b"/><path d="M-8-19q-3-22 20-20q23 4 16 21l-11-13Z" fill="#655448"/><circle cx="5" cy="-19" r="1.5" fill="#4d5045"/><circle cx="17" cy="-19" r="1.5" fill="#4d5045"/><path d="M6-10q5 4 10-1" fill="none" stroke="#a7745f" stroke-width="2"/></g>
        <path d="M107 42h101v43h-66l-12 11V85h-23Z" fill="#edf1dd" stroke="#b3c697" stroke-width="2"/><text x="158" y="60" text-anchor="middle" font-size="11" fill="#5d7950">학교 식물 퀴즈</text><text x="158" y="76" text-anchor="middle" font-size="11" fill="#5d7950">만들어 줘!</text><path d="M94 103h95l-9 8h-76Z" fill="#7c998a"/><rect x="111" y="83" width="61" height="23" rx="3" fill="#adc3b5"/>
        ${arrow(249,288,72)}<rect x="337" y="38" width="144" height="66" rx="9" fill="${generated?'#426f58':'#718b78'}"/><path d="M326 50h11m-11 15h11m-11 15h11m144-30h11m-11 15h11m-11 15h11M351 27v11m24-11v11m24-11v11m24-11v11m24-11v11" stroke="#98b38d" stroke-width="3"/>
        <text x="409" y="59" text-anchor="middle" fill="#fff8df" font-size="12" font-weight="700">${service}</text>${['HTML','CSS','JS'].map((t,i)=>`<rect x="${346+i*44}" y="72" width="39" height="20" rx="4" fill="${generated?['#ead29f','#b8d5a5','#a8c9bf'][i]:'#8da18a'}"/><text x="${365+i*44}" y="86" text-anchor="middle" font-size="9" fill="#345a48">${t}</text>`).join('')}
        ${arrow(531,571,72,generated)}<rect x="612" y="33" width="161" height="80" rx="5" fill="#fffdf8" stroke="${generated?'#80aa79':'#bdcab6'}" stroke-width="2"/><path d="M612 49h161" stroke="#d5deca"/><circle cx="622" cy="41" r="2" fill="#d9a078"/><circle cx="629" cy="41" r="2" fill="#b8c98f"/><circle cx="636" cy="41" r="2" fill="#93b9a4"/>${generated?`${svgPlant(643,84,.42)}<rect x="672" y="60" width="80" height="7" rx="3" fill="#c7d7b9"/><rect x="673" y="78" width="67" height="22" rx="5" fill="${leafSeen?'#6d9762':'#dce8ca'}"/><text x="706" y="93" text-anchor="middle" font-size="10" fill="${leafSeen?'#fff8de':'#59724f'}">${leafSeen?'정답!':'잎맥'}</text><path d="M748 87v24l6-7 7 1Z" fill="#f4df9c" stroke="#8b986c" stroke-width="2"/>`:'<path d="M641 71h101m-101 16h72" stroke="#e0e6d6" stroke-width="7" stroke-linecap="round"/>'}${label(127,'1. 말로 요청')}${label(409,'2. AI가 코드 생성')}${label(692,'3. 실행하고 확인')}`;
    }else if(index===1){
      description='HTML은 앱의 뼈대, CSS는 색과 모양, JavaScript는 버튼을 누르면 일어나는 동작';
      drawing=`${frame(20,240,webPart==='html'?'#e9eedf':'#fffdf7')}${frame(290,240,webPart==='css'?'#e9eedf':'#fffdf7')}${frame(560,240,webPart==='js'?'#e9eedf':'#fffdf7')}
        <rect x="62" y="33" width="155" height="77" rx="3" fill="none" stroke="#8fa38a" stroke-width="2"/><rect x="74" y="44" width="129" height="13" fill="none" stroke="#8fa38a" stroke-dasharray="4 3"/><rect x="74" y="66" width="42" height="33" fill="none" stroke="#8fa38a" stroke-dasharray="4 3"/><path d="M128 70h71m-71 12h54m-54 12h64" stroke="#b2c0a6" stroke-width="4"/>
        <path d="M361 38l31-12q17 18 34 0l31 12 18 27-20 14-14-17v48h-67V62l-14 17-20-14Z" fill="#aeca8f" stroke="#709166" stroke-width="2"/><path d="M391 27q18 24 36 0" fill="none" stroke="#709166" stroke-width="3"/><path d="M389 61h36v34h-36Z" fill="#e8db9c"/><circle cx="401" cy="75" r="5" fill="#72956a"/><path d="M389 88l11-10 8 8 17-15v24h-36Z" fill="#8aac79"/>
        <rect x="598" y="37" width="162" height="73" rx="8" fill="#fffdf6" stroke="#88a37d" stroke-width="2"/><rect x="622" y="52" width="113" height="34" rx="8" fill="${webClick?'#75a36a':'#d3e1be'}"/><text x="678" y="74" text-anchor="middle" fill="${webClick?'#fff8e1':'#658157'}" font-size="13">${webClick?'+1 기록!':'클릭'}</text><path d="M704 74l1 35 10-10 9 2Z" fill="#f6dfa8" stroke="#819568" stroke-width="2"/>${webPart==='js'?'<path d="M714 39l5-9m8 15 10-3m-32-8-2-9" stroke="#c3a860" stroke-width="3" stroke-linecap="round"/>':''}${label(140,'HTML · 내용과 구조')}${label(410,'CSS · 모양과 색')}${label(680,'JavaScript · 클릭 동작')}`;
    }else if(index===2){
      description='역할, 대상, 목표, 조건, 출력의 다섯 퍼즐 조각을 누를 때마다 하나의 요청이 완성되는 그림';
      drawing=`<rect x="14" y="13" width="792" height="119" rx="20" fill="#f0f1e4" stroke="#dce3cf"/>${PARTS.map(([name],i)=>{const x=29+i*154;return `<g transform="translate(${x} 32)"><path d="M0 0h51q-6 19 13 19t13-19h68v27q19-6 19 13t-19 13v37H77q6-19-13-19T51 90H0V53q19 6 19-13T0 27Z" fill="${parts.has(i)?['#b4cca1','#b9d1c3','#e5ce9e','#d0c3d9','#b4cbd2'][i]:'#e2e7d6'}" stroke="${parts.has(i)?'#90a67f':'#c8d1ba'}" stroke-width="2"/><text x="72" y="38" text-anchor="middle" font-size="20" fill="#6d8460" font-weight="800">${parts.has(i)?'✓':String(i+1)}</text><text x="72" y="65" text-anchor="middle" font-size="14" fill="#536a4d" font-weight="700">${name}</text></g>`;}).join('')}${label(410,parts.size===5?'다섯 조각이 모여, 하나의 구체적인 요청!':'아래 조각을 누르면 퍼즐도 채워져요')}`;
    }else if(index===3){
      description='고장 난 버튼의 증상을 확인하고 한 부분만 수리한 뒤, 숫자가 늘어나는지 다시 눌러 확인하는 그림';
      drawing=`${frame(20)}${frame(302)}${frame(585,215,repaired?'#e8f0df':'#f5f6ed')}<rect x="53" y="35" width="148" height="72" rx="5" fill="#fffdf7" stroke="#cdb09a" stroke-width="2"/><text x="127" y="69" text-anchor="middle" font-size="31" fill="#b88c72">0</text><rect x="88" y="81" width="79" height="17" rx="4" fill="#eedccb"/><path d="M175 30l14 14m0-14-14 14" stroke="${tested?'#bd7f67':'#d1c1ad'}" stroke-width="3"/><g transform="translate(69 111)"><ellipse rx="10" ry="6" fill="#b99a71"/><path d="M-6-4-8-9m12 5 3-5m-14 13-8 3m24-3 8 3m-27-9-9-2m27 2 9-2" stroke="#967957" stroke-width="2"/></g>${arrow(250,288,72)}<path d="M382 39a22 22 0 0 0 28 28l34 33q10 11 20 0t0-20l-34-33a22 22 0 0 0-26-28l13 13-14 14-13-13Z" fill="${repaired?'#9bb891':'#c5d0bc'}" stroke="#6f8b6a" stroke-width="3"/><circle cx="453" cy="91" r="5" fill="#f5f4e8"/>${arrow(532,571,72,repaired)}<rect x="619" y="35" width="148" height="72" rx="5" fill="#fffdf7" stroke="#9ab58b" stroke-width="2"/><text x="692" y="69" text-anchor="middle" font-size="31" fill="#65905c">${repaired?count:'?'}</text><rect x="654" y="81" width="79" height="17" rx="4" fill="${repaired?'#bfd6a8':'#e2e8d8'}"/>${repaired?'<path d="M737 27l7 8 16-18" fill="none" stroke="#739d65" stroke-width="4" stroke-linecap="round"/>':''}${label(127,'1. 증상 확인')}${label(409,'2. 한 부분만 수정')}${label(692,'3. 다시 눌러 확인')}`;
    }else if(index===4){
      description='과학 설명을 돋보기와 교과서로 확인하고, 실명 자료를 가상 학생 자료로 바꾸는 그림';
      drawing=`${frame(20,376)}${frame(424,376)}<rect x="51" y="31" width="95" height="80" rx="4" fill="#fffdf4" stroke="#bac8ab" stroke-width="2"/><path d="M65 46h66m-66 13h45m-45 13h58m-58 13h51m-51 13h30" stroke="#cad7bb" stroke-width="4"/>${svgPlant(189,76,.6)}<circle cx="190" cy="66" r="33" fill="#dae8be55" stroke="#698b6a" stroke-width="6"/><path d="M213 91l25 25" stroke="#698b6a" stroke-width="10" stroke-linecap="round"/><path d="M270 46q21-12 43 0q22-12 44 0v57q-22-12-44 0q-22-12-43 0Z" fill="#e0c995" stroke="#ac9568" stroke-width="2"/><path d="M313 47v54" stroke="#b69d6b" stroke-width="2"/><text x="313" y="79" text-anchor="middle" fill="#887149" font-size="12">교과서</text>${checked.has('science')?'<circle cx="365" cy="32" r="14" fill="#8eaf78"/><path d="M358 32l5 5 10-12" fill="none" stroke="#fff9e5" stroke-width="3"/>':''}<path d="M460 49h55l13-16h59v78H460Z" fill="#d5c7a2" stroke="#ac9a73" stroke-width="2"/><rect x="480" y="43" width="90" height="60" rx="3" fill="#fff9e9"/><circle cx="501" cy="62" r="8" fill="#b7c9a6"/><path d="M486 87q0-18 15-18t15 18" fill="#b7c9a6"/><path d="M527 61h29m-29 12h22m-22 12h26" stroke="#c1cdb4" stroke-width="4"/>${arrow(603,644,74)}<rect x="660" y="38" width="104" height="71" rx="8" fill="${checked.has('privacy')?'#e0eed2':'#f3e9d4'}" stroke="#adc497" stroke-width="2"/><circle cx="711" cy="62" r="11" fill="#a3bd8a"/><path d="M691 91q0-22 20-22t20 22" fill="#a3bd8a"/><text x="711" y="104" text-anchor="middle" fill="#637c51" font-size="10">${checked.has('privacy')?'가상 학생 A':'실명 대신 가상'}</text>${label(208,'사실은 교과서·신뢰할 자료로 확인')}${label(612,'개인정보는 빼고, 가상 자료로')}`;
    }else{
      description='API는 식물 정보 서랍에서 앱으로 자료를 가져오는 것, 배포는 앱을 웹에 올려 다른 사람이 주소로 여는 것';
      drawing=`${frame(20,376)}${frame(424,376)}<rect x="50" y="31" width="78" height="80" rx="5" fill="#91b195" stroke="#61876a" stroke-width="2"/>${[0,1,2].map(i=>`<rect x="59" y="${40+i*22}" width="60" height="18" rx="2" fill="#d9e4c9"/><path d="M80 ${48+i*22}h17" stroke="#88a17b" stroke-width="3"/>`).join('')}${svgPlant(95,39,.42)}${arrow(143,238,64,fetched)}<text x="189" y="51" text-anchor="middle" fill="#7e976f" font-size="11">정보 요청</text><path d="M238 83h-95m7-6-7 6 7 6" fill="none" stroke="${fetched?'#c39e59':'#ccd6c1'}" stroke-width="3"/><text x="189" y="102" text-anchor="middle" fill="#a38959" font-size="11">${fetched?'민들레 정보 응답':'정보 응답'}</text><rect x="254" y="40" width="104" height="63" rx="6" fill="#fffdf5" stroke="#90aa7e" stroke-width="2"/><path d="M254 53h104" stroke="#d0dcc2"/>${fetched?svgPlant(305,83,.37):'<path d="M274 69h66m-66 16h46" stroke="#d1ddc2" stroke-width="5"/>'}<rect x="454" y="41" width="94" height="61" rx="5" fill="#fffdf6" stroke="#99af8b" stroke-width="2"/>${svgPlant(500,82,.37)}<path d="M449 104h104l-9 7h-86Z" fill="#9eaf91"/>${arrow(568,644,72,deployed)}<circle cx="705" cy="72" r="39" fill="${deployed?'#c9dfc2':'#e2e9d9'}" stroke="#8da982" stroke-width="2"/><ellipse cx="705" cy="72" rx="17" ry="39" fill="none" stroke="#92af86" stroke-width="2"/><path d="M667 72h76m-68-20h61m-61 40h61" stroke="#92af86" stroke-width="2"/>${deployed?'<rect x="659" y="96" width="103" height="21" rx="5" fill="#fffdf5" stroke="#b2c49f"/><text x="710" y="111" text-anchor="middle" fill="#719162" font-size="11">주소로 함께 접속</text>':''}${label(208,'API · 앱이 다른 서비스와 주고받기')}${label(612,'배포 · 웹 주소로 앱 나누기')}`;
    }
    return `<figure class="learn-illustration"><svg viewBox="0 0 820 165" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${description}"><title>${description}</title>${drawing}</svg></figure>`;
  }

  function demo() {
    if(index===0)return `<div class="learn-request"><small>① 대화할 AI 고르기 · 시연용</small><div class="learn-services">${['ChatGPT','Claude','Gemini'].map(name=>`<button data-service="${name}" aria-pressed="${service===name}">${name}</button>`).join('')}</div><small>② 선생님의 요청</small><p>“초4 학교 식물 퀴즈를 만들어 줘.”</p><button data-learn="generate" ${generated?'disabled':''}>${service}에 부탁해 보기</button>${generated?'<div class="learn-code-stack" aria-label="AI가 만든 예시 코드"><code><b>HTML</b> &lt;h3&gt;학교 식물 퀴즈&lt;/h3&gt;</code><code><b>CSS</b> button { background: green; }</code><code><b>JS</b> button.onclick = 정답확인;</code></div>':''}</div><div class="learn-preview ${generated?'is-ready':''}"><span class="learn-window-label">③ 실행 미리보기 · AI 호출 없는 시연</span>${generated?`<div class="learn-mini-quiz">${plant}<h3>학교 식물 퀴즈</h3><p>잎에서 관찰할 수 있는 것은?</p><div><button data-learn="leaf" aria-label="잎맥 정답 고르기">잎맥</button><button data-learn="leaf-wrong">운동화 끈</button></div><p class="learn-live" role="status">${leafSeen?'✓ 정답! 잎의 모양과 잎맥을 살펴보세요.':quizChoice?'잎 그림을 보고 다시 골라 보세요.':'직접 눌러 앱이 작동하는지 확인해요.'}</p></div>`:'<div class="learn-preview-empty"><span class="learn-waiting-code">&lt; / &gt;</span><span>요청하면 여기에 앱이 생겨요.</span></div>'}</div>`;
    if(index===1)return `<div class="learn-part-switch" aria-label="웹의 구성 요소"><button data-part="html" aria-pressed="${webPart==='html'}"><b>HTML</b><span>뼈대</span></button><button data-part="css" aria-pressed="${webPart==='css'}"><b>CSS</b><span>옷</span></button><button data-part="js" aria-pressed="${webPart==='js'}"><b>JavaScript</b><span>동작</span></button></div><div class="learn-preview learn-web ${webPart==='html'?'is-plain':'is-styled'}"><span class="learn-window-label">같은 앱에 하나씩 더해 보기</span><div class="learn-sample"><h3>학교 식물 탐사대</h3>${plant}<button data-learn="web-click" ${webPart==='js'?'':'disabled'}>잎 관찰하기</button><p role="status">${webPart==='html'?'제목과 버튼이 생겼어요.':webPart==='css'?'초록색과 여백으로 꾸몄어요.':webClick?'관찰 기록 1개가 추가됐어요!':'버튼을 눌러 동작을 확인해요.'}</p></div></div>`;
    if(index===2)return `<div class="learn-prompt-parts">${PARTS.map(([label,text],i)=>`<button data-prompt="${i}" aria-pressed="${parts.has(i)}"><span>${parts.has(i)?'✓':'＋'}</span><b>${label}</b><small>${text}</small></button>`).join('')}</div><div class="learn-assembled"><small>나의 요청 · ${parts.size}/5</small><p role="status">${parts.size?PARTS.filter((_,i)=>parts.has(i)).map(p=>p[1]).join(' '):'다섯 칸을 눌러 요청을 조립해 보세요.'}</p></div>`;
    if(index===3)return `<div class="learn-preview learn-counter"><span class="learn-window-label">고장 난 관찰 기록 버튼</span><div class="learn-count" role="status">${count}<small>관찰 기록</small></div><button data-learn="count">잎 관찰 +1</button><p>${repaired?'✓ 다시 눌러 실제로 고쳐졌는지 확인해요.':tested?'버튼을 눌렀는데 숫자가 그대로예요.':'먼저 버튼을 눌러 증상을 확인해요.'}</p></div><div class="learn-repair"><small>AI에게 보낼 구체적인 수정 요청</small><p>“눌러도 0이에요. 1씩 늘게 고쳐 줘.<br>제목과 색은 그대로 둬.”</p><button data-learn="repair" ${repaired?'disabled':''}>↻ 이 부분만 고쳐 보기</button></div>`;
    if(index===4)return `<div class="learn-checks"><button data-check="science" aria-pressed="${checked.has('science')}"><span>${checked.has('science')?'✓':'?'}</span><div><small>AI가 쓴 설명</small><p>${checked.has('science')?'식물도 호흡해요. 교과서로 확인!':'“식물은 호흡하지 않아요.”'}</p></div></button><button data-check="privacy" aria-pressed="${checked.has('privacy')}"><span>${checked.has('privacy')?'✓':'♙'}</span><div><small>AI에게 보낼 예시 자료</small><p>${checked.has('privacy')?'가상 학생 A · 가상의 관찰 기록':'학생 실명 · 얼굴 사진 · 실제 기록'}</p></div></button></div><p class="learn-check-note" role="status">${checked.size===2?'✓ 사실을 고치고, 가상 자료로 바꿨어요.':'두 항목을 눌러 확인하고 바꿔 보세요.'}</p>`;
    return `<div class="learn-service-flow"><div class="learn-service-card"><span class="learn-big-icon">♧</span><h3>API</h3><p>앱 ↔ 식물 정보 서비스</p><button data-learn="fetch" ${fetched?'disabled':''}>식물 정보 요청해 보기</button><small role="status">${fetched?'예시 응답: 민들레 · 노란 꽃':'외부 접속 없는 응답 시연'}</small></div><div class="learn-service-card"><span class="learn-big-icon">↗</span><h3>배포</h3><p>내 컴퓨터 → 웹 주소</p><button data-learn="deploy" ${deployed?'disabled':''}>공유 주소 만들어 보기</button><small role="status">${deployed?'예시: https://school.example/':'시연 주소는 실제로 열리지 않아요.'}</small></div></div><div class="learn-finish-note">🌱 이제 직접 요청하고, 실행하고, 확인할 준비!</div>`;
  }

  function render(focusHeading=false) {
    if(!opened||disposed)return;
    visited.add(index);
    const step=LEARNING_STEPS[index];
    container.innerHTML=`<section class="learning-room" role="dialog" aria-modal="true" aria-labelledby="learn-heading"><header class="learn-header"><div><span class="learn-room-badge">🌱 배움터실</span><small>선택 코스 · 약 2–3분 · 벌점 없음</small></div><button class="learn-leave" data-learn="leave">이미 알아요 · 학교로 <span aria-hidden="true">↗</span></button></header><nav class="learn-stations" aria-label="기초 학습 단계">${LEARNING_STEPS.map((s,i)=>`<button data-step="${i}" ${i===index?'aria-current="step"':''} aria-label="${i+1}단계 ${s.label}"><span>${visited.has(i)&&i!==index?'✓':String(i+1).padStart(2,'0')}</span><small>${s.label}</small></button>`).join('')}</nav><main class="learn-main"><div class="learn-intro"><div class="learn-eyebrow">${step.icon} ${String(index+1).padStart(2,'0')} / 06 · ${step.label}</div><h2 id="learn-heading" tabindex="-1">${step.title}</h2><p>${step.core}</p></div>${illustration()}<div class="learn-workbench learn-step-${index}">${demo()}</div><p class="learn-tip"><span>기억할 한 줄</span>${step.tip}</p></main><footer class="learn-footer"><button data-learn="previous" ${index===0?'disabled':''}>← 이전</button><span>${index+1} / 6</span><button data-learn="next" class="learn-next">${index===5?'이제 학교로 가기 ↗':'다음 배움 →'}</button></footer></section>`;
    const act=(name,fn)=>{const node=q(`[data-learn="${name}"]`);if(node)node.onclick=fn;};
    act('leave',close);act('previous',()=>go(index-1));act('next',()=>index===5?close():go(index+1));
    act('generate',()=>{generated=true;render();q('[data-learn="leaf"]')?.focus();});
    act('leaf',()=>{leafSeen=true;quizChoice='leaf';render();q('[data-learn="leaf"]')?.focus();});
    act('leaf-wrong',()=>{leafSeen=false;quizChoice='wrong';render();q('[data-learn="leaf-wrong"]')?.focus();});
    act('web-click',()=>{webClick=!webClick;render();q('[data-learn="web-click"]')?.focus();});
    act('count',()=>{tested=true;if(repaired)count++;render();q('[data-learn="count"]')?.focus();});
    act('repair',()=>{repaired=true;render();q('[data-learn="count"]')?.focus();});
    act('fetch',()=>{fetched=true;render();q('[data-learn="deploy"]')?.focus();});
    act('deploy',()=>{deployed=true;render();q('[data-learn="next"]')?.focus();});
    all('[data-service]').forEach(button=>button.onclick=()=>{service=button.dataset.service;generated=leafSeen=false;quizChoice='';render();q(`[data-service="${service}"]`)?.focus();});
    all('[data-step]').forEach(button=>button.onclick=()=>go(Number(button.dataset.step)));
    all('[data-part]').forEach(button=>button.onclick=()=>{webPart=button.dataset.part;render();q(`[data-part="${webPart}"]`)?.focus();});
    all('[data-prompt]').forEach(button=>button.onclick=()=>{const id=Number(button.dataset.prompt);parts.has(id)?parts.delete(id):parts.add(id);render();q(`[data-prompt="${id}"]`)?.focus();});
    all('[data-check]').forEach(button=>button.onclick=()=>{checked.add(button.dataset.check);render();q(`[data-check="${button.dataset.check}"]`)?.focus();});
    if(visited.size===LEARNING_STEPS.length&&!notified){notified=true;onLearned?.();}
    if(focusHeading)q('#learn-heading')?.focus();
  }
  function go(next){if(next<0||next>=LEARNING_STEPS.length)return;index=next;render(true);}
  function close(){
    if(!opened)return;
    opened=false;container.hidden=true;container.replaceChildren();
    if(returnFocus?.isConnected)returnFocus.focus?.();
    onClose?.();
  }
  const keydown=event=>{
    if(!opened)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    if(event.key==='Tab'){
      const nodes=all('button:not([disabled])');const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    event.stopPropagation();
  };
  container.onkeydown=keydown;
  return {
    open(){
      if(disposed||opened)return;
      returnFocus=document.activeElement;opened=true;index=0;notified=false;visited.clear();
      generated=leafSeen=webClick=repaired=tested=fetched=deployed=false;service='ChatGPT';quizChoice='';webPart='html';count=0;parts=new Set();checked=new Set();
      container.hidden=false;render(true);
    },
    close,isOpen:()=>opened&&!disposed,
    dispose(){if(disposed)return;close();disposed=true;container.onkeydown=null;container.classList.remove('learning-overlay');}
  };
}
