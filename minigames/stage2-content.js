/* Short physical-play labels for missions 4–10.
 * Canonical questions/answers remain in missions-data.js. sourceId/sourceIndex
 * link shortened lessons back to those originals; additions are explicit practice.
 */
const detail=(question,answer,explanation)=>({question,answer,explanation});
const base=(title,instruction,icon,duration=90)=>({title,instruction,icon,duration});

function library(mission){
  const steps=[
    ['scope','목표 정하기','◎','scope'],
    ['draft','기획안 받기','✎','review'],
    ['review','기획안 검토','✓','review'],
    ['build','뼈대만 만들기','▧','build'],
    ['test','직접 시험','☝','test'],
    ['repair','수정 재시험','↻','test'],
    ['publish','배포 확인','↗','publish']
  ];
  const books=steps.map(([id,label,icon,sourceId],order)=>({id,label,icon,order,trap:false,sourceId,originalText:mission.cards.find(c=>c.id===sourceId).text}));
  books.push({id:'everything',label:'한꺼번에 전부',icon:'⚡',order:-1,trap:true,sourceId:null,originalText:'검토 없이 로그인·순위표·통계를 한 번에 완성한다.'});
  return {...base('제작 순서 책 꽂기','책을 주워 순서대로 꽂기 · 함정은 반납!','⌨'),books,order:steps.map(s=>s[0]),
    tip:'목표 → 검토 → 작은 제작 → 확인!',trapTip:'검토 없이 한꺼번에 만들지 않아요.',
    details:[detail('도서관의 일곱 권',steps.map(s=>s[1]).join(' → '),'원래 다섯 단계의 흐름을 손으로 나누어 익힙니다. 문항 검토는 기획안 받기와 교과서 대조로, 테스트는 직접 시험하기와 수정 후 재시험으로 나눴어요. 실제 제작에서는 확인과 수정을 여러 번 반복합니다. 배포 뒤에는 다른 기기에서 공유 링크도 열어 봅니다.')]
  };
}

function bugs(mission){
  const slots=[{id:'symptom',label:'증상',icon:'!'}, {id:'expected',label:'기대',icon:'✓'}, {id:'error',label:'오류 메시지',icon:'⌘'}, {id:'scope',label:'범위',icon:'▣'}];
  const rows=[
    {id:'restart',label:'초기화 고장',report:'다시 시작해도 3점 그대로!',reproduction:'Chrome · 3문항 완료 → 다시 시작',errorText:'오류 메시지 없음',sourceId:'restart',
      labels:['다시 시작해도 3점','1번 문항·0점으로','오류 메시지 없음','문항·디자인 유지'],tip:'본 증상과 기대 결과를 나눠요.'},
    {id:'feedback',label:'해설 고장',report:'정답을 눌러도 해설이 없음!',reproduction:'연습 사례 · 정답 버튼 선택',errorText:'Error: hint missing',practice:true,
      labels:['정답 뒤 해설이 안 뜸','정답 이유 한 줄 표시','Error: hint missing','문항·점수 계산 유지'],tip:'화면의 오류 문구를 그대로 전달!'},
    {id:'next',label:'다음 문항 고장',report:'다음을 눌러도 1번 문항!',reproduction:'연습 사례 · 1번 답 선택 → 다음',errorText:'오류 메시지 없음',practice:true,
      labels:['다음 눌러도 1번','2번 문항으로 이동','오류 메시지 없음','글자·색·정답 유지'],tip:'고칠 부분과 유지할 부분을 구분!'}
  ];
  const issues=rows.map(({labels,...row})=>({...row,fragments:slots.map((slot,i)=>({id:`${row.id}-${slot.id}`,slot:slot.id,label:labels[i]}))}));
  return {...base('버그 잡기','벌레를 잡고 신고 조각을 알맞은 칸에!','☝'),slots,bugs:issues,
    tip:'증상 · 기대 · 오류 · 유지할 범위',
    details:issues.map(issue=>detail(issue.label,issue.fragments.map((f,i)=>`${slots[i].label}: ${f.label}`).join(' / '),issue.practice?'이 화면은 추가 연습용 사례입니다. 사용 환경과 누른 순서를 먼저 적고 실제 증상, 기대 동작, 보인 오류 문구, 유지할 부분을 구분하세요. 오류가 보이지 않으면 없다고 적고 지어내지 않습니다. 수정 후 같은 순서로 다시 시험합니다.':mission.repair.explanation))
  };
}

function science(mission){
  const tips=[
    '만든 뒤에는 직접 실행해요.',
    '누가 무엇을 할지 먼저 정해요.',
    '바꿀 것과 지킬 것을 함께!',
    '한 부분씩 고치고 다시 확인!',
    '요청 → 실행 → 확인 → 수정',
    '본 오류만 그대로 전달해요.',
    'AI의 확신보다 직접 검증!',
    '실제 기록 대신 완전한 가상 예시!',
    '공유 주소를 다른 기기에서도 확인!'
  ];
  const statements=mission.items.map((item,sourceIndex)=>({id:`vibe-${sourceIndex}`,text:item.q,wrong:item.wrong,tip:tips[sourceIndex],sourceIndex,originalText:item.q,explanation:item.explanation}));
  return {...base('틀린 코딩 습관 썰기','틀린 AI 사용법은 자르고, 맞는 것은 담기!','╱'),statements,
    tip:'과학 암기 대신, AI와 일하는 방법!',
    details:[detail('과학실에서 왜 코딩 습관을 배우나요?','먹이사슬 자료를 만드는 교사의 작업 습관을 실험합니다.',mission.explanation)]};
}

function screening(mission){
  const labels={fiction:['가상 이름','☺'],phone:['실제 명단','☎'],drawing:['직접 그림','♧'],counsel:['상담 기록','▤'],licensed:['허용 자료','©'],character:['무단 캐릭터','★']};
  const tips={fiction:'실제 학생과 무관한 가상 예시예요.',phone:'이 실습에 실제 명단은 필요 없어요.',drawing:'직접 만들고 권리를 가진 그림!',counsel:'이름만 지워도 알아볼 수 있어요.',licensed:'배포·수정·출처 조건까지 확인!',character:'교육용도 공개 이용 허락을 확인!'};
  const items=mission.items.map(item=>({id:item.id,label:labels[item.id][0],icon:labels[item.id][1],action:item.category==='ok'?'pass':'confiscate',tip:tips[item.id],sourceId:item.id,originalText:item.text,explanation:item.explanation}));
  const extra=[
    {id:'name-slot',label:'실명 입력칸',icon:'✎',action:'alias',tip:'실명 대신 가상 이름 칸으로 바꿔요.',aliasResult:'탐험가 A',originalText:'아직 이름을 받지 않은 퀴즈의 “실제 학생 이름” 입력칸',explanation:'실제 이름을 입력받기 전에 입력칸을 가상 탐험가 이름으로 바꿉니다. 실제 학생 명단을 가명 처리해 외부 AI에 보내는 활동이 아닙니다.'},
    {id:'story-slot',label:'실제 사례칸',icon:'◇',action:'alias',tip:'실제 사례 대신 완전한 가상 예시!',aliasResult:'가상의 탐험 이야기',originalText:'아직 내용을 받지 않은 “우리 반 실제 사례를 적어 주세요”라는 프롬프트 칸',explanation:'실제 사례를 받지 않고 완전히 새로 지어낸 생태 탐험 이야기로 바꿉니다. 실제 상담 기록의 이름만 바꾸는 방법은 사용하지 않습니다.'},
    {id:'api-key',label:'비밀 API키',icon:'⚿',action:'confiscate',tip:'비밀 키는 공개 코드에 넣지 않아요.',originalText:'비공개로 보관해야 하는 API 인증 키',explanation:'비밀 API 키는 공개 프롬프트나 저장소, 브라우저 코드에 넣지 않습니다. 공개 가능한 키인지 서비스의 안내를 확인해야 합니다.'},
    {id:'photo',label:'학생 얼굴',icon:'▣',action:'confiscate',tip:'이번 퀴즈에 실제 얼굴은 불필요!',originalText:'우리 반 학생의 얼굴이 보이는 실제 사진',explanation:'이번 생태 퀴즈 제작에는 실제 학생 사진이 필요하지 않습니다. 학생을 알아볼 수 없는 직접 만든 그림이나 이용이 허용된 자료로 대체합니다.'},
    {id:'shapes',label:'도형 나무',icon:'▲',action:'pass',tip:'직접 만든 도형 그림도 좋아요.',originalText:'원과 삼각형으로 직접 만든 나무 그림',explanation:'직접 만든 단순한 도형 그림은 외부 이미지를 무단으로 가져오지 않고도 사용할 수 있는 선택입니다.'}
  ];
  items.splice(2,0,extra[0]);items.splice(6,0,extra[1]);items.push(...extra.slice(2));
  return {...base('개인정보 검색대','← 통과 · ↓ 가상 대체 · → 압수','↔'),items,
    aliasLabel:'가명 도장',aliasTip:'실제 자료는 보내지 않고 가상으로!',tip:'실제 기록은 이름만 바꿔도 안 돼요.',
    details:extra.map(item=>detail(item.originalText,{pass:'통과',alias:'가명 도장 · 실제 자료 수집 전 가상 예시로 대체',confiscate:'압수 · 이 실습에 입력하지 않기'}[item.action],item.explanation))};
}

function broadcast(mission){
  const chips=[
    {id:'font',label:'글씨 24px 이상',fix:'font',tip:'읽기 어려운 글자만 크게!'},
    {id:'color',label:'배경은 차분하게',fix:'color',tip:'문항 유지 · 배경색만 수정!'},
    {id:'button',label:'소리 버튼 복구',fix:'button',tip:'버튼을 화면 안에 복구해요.'},
    {id:'vague',label:'느낌 있게',fix:null,tip:'느낌 대신 위치·크기·동작!'}
  ];
  return {...base('ON AIR 10초 전','장비 확인 → 칩 하나씩 → 저장!','☝',80),chips,
    equipmentLabel:'입력 소스 확인',equipmentTip:'코드 전에 연결·입력부터 확인!',
    busyTip:'한 번에 하나! 지금 수정부터 확인.',saveTip:'잘 된 버전을 저장하고 현장 확인!',failureLine:'여러분, 마지막으로 한 말씀만…',
    details:[detail('행사 당일 갑자기 안 되는 화면','입력·연결 상태 확인 → 필요한 부분만 수정 → 저장 → 현장 확인',mission.turns.map(t=>t.explanation).join('\n\n')),
      detail('수정 칩 세 개','글자 크기 → 배경색 → 소리 버튼, 한 번에 하나씩','짧은 칩은 수정 요청을 쪼개는 연습입니다. 실제 AI에는 “문항·정답·채점은 유지하고 이 부분만 고쳐 줘”처럼 유지할 조건도 함께 말합니다. 코드로 물리적인 케이블이나 마이크 고장을 수리할 수는 없습니다.')]
  };
}

function lunch(mission){
  const rows=[
    ['title','제목 구조','html',0,'▤'],['question','문항 틀','html',0,'▧'],['button','버튼 요소','html',0,'▣'],
    ['color','버튼 색','css',1,'●'],['size','글자 크기','css',1,'Aa'],['layout','화면 배치','css',1,'▦'],
    ['score','점수 올리기','js',2,'+1'],['feedback','답 확인','js',2,'✓'],['restart','다시 시작','js',2,'↻']
  ];
  const foods=rows.map(([id,label,kind,sourceIndex,icon])=>({id,label,kind,icon,sourceIndex,originalText:mission.items[sourceIndex].q,explanation:mission.items[sourceIndex].explanation}));
  const bonus=[
    {id:'deploy',label:'배포',options:['웹에 게시','글자 꾸미기','오류 기록'],answer:0,tip:'배포는 실제 접속할 곳에 올리기!',sourceIndex:3,explanation:mission.items[3].explanation},
    {id:'console',label:'콘솔',options:['화면의 뼈대','오류·기록 확인','가상 이름'],answer:1,tip:'콘솔은 오류·기록을 보는 도구!',explanation:'브라우저 개발자 도구의 콘솔에서 코드가 출력한 기록과 오류를 확인할 수 있습니다. 보이는 오류 문구와 재현 순서를 함께 전달하면 수정 요청에 도움이 됩니다.'},
    {id:'hallucination',label:'할루시네이션',options:['게임 배포','화면의 모양','그럴듯한 오류'],answer:2,tip:'그럴듯한 AI 설명도 직접 검증!',explanation:'AI가 사실과 다른 내용을 그럴듯하게 만들어 내는 현상을 가리킵니다. 자연스럽고 자신 있는 말투가 과학적 정확성을 보장하지 않으므로 교과서와 믿을 만한 자료로 확인합니다.'},
    {id:'pages',label:'GitHub Pages',options:['정적 웹 배포','학생 상담실','내 PC 폴더'],answer:0,tip:'저장소 파일을 웹사이트로 제공!',sourceIndex:4,explanation:mission.items[4].explanation},
    {id:'share',label:'링크 공유',options:['C: 폴더 전달','다른 기기 확인','README만 확인'],answer:1,tip:'실행 주소를 다른 기기에서 확인!',sourceIndex:5,explanation:mission.items[5].explanation}
  ];
  return {...base('3칸 식판','반찬을 뼈대·옷·움직임 칸에 받기!','↔',60),foods,bonus,bonusSeconds:20,
    tray:[{id:'html',label:'뼈대 HTML'},{id:'css',label:'옷 CSS'},{id:'js',label:'움직임 JS'}],
    tip:'HTML 뼈대 · CSS 모양 · JS 동작',
    details:bonus.map(b=>detail(b.label,b.options[b.answer],b.explanation))};
}

function boss(mission){
  const sample='초등 과학 웹 자료 개발 도우미가 되어 줘. 초등학교 5학년이 생태계의 먹이사슬을 배우는 활동을 만들어 줘. 학생이 풀·메뚜기·개구리 카드를 순서대로 놓고 화살표로 연결하면 정답과 이유를 보여 줘. 글씨와 버튼을 크게 하고 태블릿에서 실행되게 해 줘. 실제 학생 정보는 사용하지 마. HTML 파일 하나로 만들어 줘.';
  return {...base('보스전: 4시 29분의 남자','먹이사슬 활동을 AI에게 부탁하는 글 쓰기!','⌨'),
    shields:[
      {id:'role',label:'역할',help:'초등 과학 웹 자료 개발 도우미'},
      {id:'audience',label:'대상',help:'초등학교 5학년 학생'},
      {id:'topic',label:'주제',help:'생태계의 먹이사슬 이해하기'},
      {id:'format',label:'형식',help:'생물 카드 배치·화살표 연결 활동'},
      {id:'constraints',label:'조건',help:'큰 글씨·태블릿·실제 학생 정보 제외'},
      {id:'output',label:'출력',help:'HTML 파일 하나'}
    ],required:5,sample,
    hints:[
      {title:'무엇을 부탁할까요?',text:'AI에게 “초등 5학년이 생태계의 먹이사슬을 배우는 웹 활동을 만들어 줘”라고 시작해 보세요. 지금 쓰는 글은 AI에게 보낼 제작 요청문입니다.'},
      {title:'학생의 행동을 덧붙여요',text:'“학생이 풀·메뚜기·개구리 카드를 순서대로 놓고 화살표로 연결하면 정답과 이유를 보여 줘.” 여기에 큰 글씨·태블릿·HTML 파일 같은 조건을 덧붙여요.'},
      {title:'완성 예시를 참고해요',text:sample}
    ],
    tip:'누가 · 무엇을 · 어떻게 만들지 써요.',
    details:[detail('교문을 여는 여섯 방패','역할·대상·주제·형식·조건·출력 중 다섯 가지 이상','글자 수 제한은 없습니다. 초등 5학년을 위한 생태계 먹이사슬 활동을 AI에게 부탁해 보세요. 학생이 생물 카드를 배치하고 화살표로 연결했을 때 화면이 어떻게 반응할지도 적습니다. 게임의 자동 체크는 표현을 찾는 연습용 판정이며 정확성이나 실제 동작을 보장하지 않습니다. 완성한 프롬프트는 복사해 실습에 쓸 수 있습니다.'),detail('퇴근 후 이어갈 제작 원칙','작게 만들기 → 직접 검증 → 필요한 부분만 수정',mission.explanation)]};
}

export function getStage2Arcade(mission){
  if(!mission||!Number.isInteger(mission.id))throw new TypeError('A mission is required');
  const factories={4:library,5:bugs,6:science,7:screening,8:broadcast,9:lunch,10:boss};
  return factories[mission.id]?.(mission);
}
