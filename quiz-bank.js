// 수돗가 '오늘의 바이브 코딩 퀴즈' 60문제.
// 한국 날짜로 하루에 한 문제씩 돌아가며, 같은 날에는 모두 같은 문제를 풉니다.
// 문구를 고칠 때는 answer(정답 보기의 순서, 0부터)도 함께 확인하세요.
import {quizIndexFor} from './community/core.js';

export const QUIZ_BANK = Object.freeze([
  {id: 'q01', topic: '바이브 코딩', prompt: '바이브 코딩에서 교사가 맡는 가장 중요한 역할은?', options: ['코드를 한 줄씩 직접 입력하기', '목표를 정하고 결과를 확인·판단하기', 'AI가 만든 결과를 그대로 배포하기'], answer: 1, explanation: '코드는 AI가 써도, 무엇을 만들고 써도 되는지는 교사가 판단해요.'},
  {id: 'q02', topic: '웹 기초', prompt: '웹페이지의 ‘뼈대’(제목·글·버튼의 자리)를 만드는 것은?', options: ['CSS', 'HTML', 'JavaScript'], answer: 1, explanation: 'HTML은 뼈대, CSS는 꾸밈, JavaScript는 움직임이에요.'},
  {id: 'q03', topic: '오류 전달', prompt: '만든 게임의 시작 버튼이 안 눌릴 때, AI에게 가장 좋은 요청은?', options: ['“안 돼. 고쳐 줘.”', '“처음부터 다시 만들어 줘.”', '“시작 버튼을 눌러도 반응이 없어. 콘솔 오류를 붙일게. 이 문제만 고쳐 줘.”'], answer: 2, explanation: '증상·오류 메시지·고칠 범위를 함께 말하면 한 번에 고쳐져요.'},
  {id: 'q04', topic: '과학 내용 검증', prompt: 'AI가 만든 학습지에 ‘버섯은 생산자’라고 쓰여 있다면?', options: ['AI가 썼으니 그대로 쓴다', '교과서로 확인하고 ‘분해자’로 고친다', '학생들이 알아서 찾게 둔다'], answer: 1, explanation: '버섯·곰팡이는 분해자예요. 과학 내용은 교사가 꼭 확인해요.'},
  {id: 'q05', topic: '개인정보', prompt: 'AI 대화창에 넣어도 되는 정보는?', options: ['학생 이름과 성적', '‘5학년, 생물과 환경 단원’', '학부모 연락처'], answer: 1, explanation: '학년·단원 같은 수업 정보는 괜찮고, 누구인지 알 수 있는 정보는 넣지 않아요.'},
  {id: 'q06', topic: '공유하기', prompt: '만든 웹 게임을 링크 하나로 누구나 열 수 있게 올리는 것을 무엇이라 할까요?', options: ['배포', '압축', '결재'], answer: 0, explanation: 'GitHub Pages 같은 곳에 올려 주소를 만드는 것이 배포예요.'},
  {id: 'q07', topic: '프롬프트', prompt: '좋은 프롬프트에 꼭 들어가면 좋은 것은?', options: ['대상 학년과 학습 목표', '“알아서 잘”', '“최대한 화려하게”'], answer: 0, explanation: '역할·대상·목표·조건·출력 형식을 구체적으로 적어요.'},
  {id: 'q08', topic: '웹 기초', prompt: '글자 색·크기·배경색처럼 ‘옷과 꾸밈’을 맡는 것은?', options: ['HTML', 'CSS', 'JavaScript'], answer: 1, explanation: '같은 뼈대(HTML)도 CSS에 따라 완전히 달라 보여요.'},
  {id: 'q09', topic: '디버깅', prompt: '크롬·엣지·웨일에서 F12를 누르면 열리는, 빨간 오류 글씨를 보는 곳은?', options: ['즐겨찾기', '개발자 도구의 콘솔(Console)', '다운로드 목록'], answer: 1, explanation: '콘솔의 빨간 글씨를 그대로 복사해 AI에게 붙여 넣어요.'},
  {id: 'q10', topic: '과학 내용 검증', prompt: '먹이 사슬의 화살표는 어느 방향으로 그릴까요?', options: ['먹는 생물 → 먹히는 생물', '먹히는 생물 → 먹는 생물', '방향은 상관없다'], answer: 1, explanation: '먹히는 생물에서 먹는 생물 쪽으로, 양분이 옮겨 가는 방향이에요.'},
  {id: 'q11', topic: '저작권', prompt: '공개할 웹 게임의 주인공으로 가장 알맞은 것은?', options: ['인기 애니메이션 캐릭터', 'AI와 함께 새로 만든 우리만의 캐릭터', '교과서 삽화를 스캔한 그림'], answer: 1, explanation: '남이 만든 캐릭터와 그림은 공개 자료에 쓰지 않아요.'},
  {id: 'q12', topic: '단계적 요청', prompt: '큰 게임을 만들 때 가장 좋은 순서는?', options: ['모든 기능을 첫 요청에 한꺼번에', '기획안 → 뼈대 → 기능 하나씩 → 점검', '배포부터 하고 나중에 기획'], answer: 1, explanation: '작게 만들고 확인하며 하나씩 늘리는 게 결국 가장 빨라요.'},
  {id: 'q13', topic: '웹 기초', prompt: '버튼을 누르면 점수가 오르는 것처럼 ‘움직임’을 맡는 것은?', options: ['HTML', 'CSS', 'JavaScript'], answer: 2, explanation: '클릭·점수·타이머처럼 움직이는 건 JavaScript예요.'},
  {id: 'q14', topic: '헷갈리는 이름', prompt: 'Java와 JavaScript의 관계로 알맞은 것은?', options: ['같은 언어의 다른 이름', '이름만 비슷한 서로 다른 언어', 'JavaScript는 Java의 새 버전'], answer: 1, explanation: '웹 화면을 움직이는 건 JavaScript예요. Java는 전혀 다른 언어예요.'},
  {id: 'q15', topic: 'AI 결과 검증', prompt: 'AI가 ‘2024년 보고서에 따르면 87%가…’처럼 숫자와 출처를 붙였다면?', options: ['숫자가 있으니 믿는다', '원래 자료에서 숫자와 출처를 확인한다', '숫자를 더 크게 바꾼다'], answer: 1, explanation: 'AI는 그럴듯한 통계와 출처를 지어내기도 해요(할루시네이션).'},
  {id: 'q16', topic: '반복 수정', prompt: '결과가 거의 마음에 드는데 글자만 작을 때, 좋은 요청은?', options: ['“다시 해 줘.”', '“글자를 지금보다 1.5배 크게 해 줘. 나머지는 그대로 둬.”', '“좀 더 느낌 있게.”'], answer: 1, explanation: '무엇을 어떻게 바꿀지, 무엇은 그대로 둘지 말해요.'},
  {id: 'q17', topic: '개인정보', prompt: '학생 이름이 들어간 칭찬 카드 게임을 만들 때 가장 안전한 방법은?', options: ['반 명단을 AI에게 붙여 넣는다', '‘학생1, 학생2’로 만들고 이름은 교실에서 직접 입력한다', '학생 사진도 함께 넣는다'], answer: 1, explanation: '실명은 AI 창에 넣지 말고, 교실에서 직접 입력하게 만들어요.'},
  {id: 'q18', topic: '출력 형식', prompt: '설치 없이 브라우저에서 바로 열리는 결과를 받으려면 프롬프트에 무엇을 적을까요?', options: ['“HTML 파일 하나로 만들어 줘”', '“앱스토어에 올려 줘”', '“편한 형식으로 줘”'], answer: 0, explanation: 'HTML 파일 하나면 크롬·엣지·웨일에서 바로 열려요.'},
  {id: 'q19', topic: '생물과 환경', prompt: '생태계에서 ‘생산자’에 해당하는 것은?', options: ['벼 같은 식물', '메뚜기', '곰팡이'], answer: 0, explanation: '식물은 햇빛을 이용해 스스로 양분을 만드는 생산자예요.'},
  {id: 'q20', topic: '웹 기초', prompt: '웹사이트에 들어가면 가장 먼저 열리는 첫 화면 파일 이름으로 흔히 쓰는 것은?', options: ['index.html', 'start.hwp', 'main.pptx'], answer: 0, explanation: '주소로 들어가면 index.html이 첫 화면으로 열려요.'},
  {id: 'q21', topic: '오류 전달', prompt: 'AI가 만든 코드가 중간에 뚝 끊겨 실행이 안 된다면?', options: ['“끊긴 부분부터 이어서 써 줘” 또는 기능을 나눠 다시 요청한다', '끊긴 코드 그대로 배포한다', '브라우저만 바꿔 본다'], answer: 0, explanation: '한 번에 너무 많이 시키면 코드가 잘려요. 나눠서 요청해요.'},
  {id: 'q22', topic: 'AI 결과 검증', prompt: 'AI가 만든 퀴즈 게임을 학생에게 쓰기 전에 꼭 할 일은?', options: ['처음부터 끝까지 직접 풀어 본다', '첫 화면 디자인만 확인한다', '학생이 먼저 해 보게 한다'], answer: 0, explanation: '정답·해설·버튼이 모두 맞는지 교사가 먼저 해 봐요.'},
  {id: 'q23', topic: '버전 저장', prompt: '잘 작동하는 버전이 나왔을 때 가장 먼저 할 일은?', options: ['바로 다음 기능을 요청한다', '파일로 저장해 둔다', '대화창을 닫는다'], answer: 1, explanation: '잘 될 때 저장해 두면 고치다 망가져도 돌아올 수 있어요.'},
  {id: 'q24', topic: '프롬프트', prompt: '“재밌게 만들어 줘” 대신 더 좋은 요청은?', options: ['“애들이 좋아하게”', '“정답이면 +10점과 박수 소리, 틀리면 이유를 한 줄로 보여 줘”', '“알아서 재밌게”'], answer: 1, explanation: '머릿속 ‘재미’를 조작·점수·소리처럼 보이는 말로 꺼내요.'},
  {id: 'q25', topic: '화면 디자인', prompt: '교실 TV로 보여 줄 자료에서 가장 신경 쓸 것은?', options: ['작은 글씨를 빽빽하게', '큰 글자와 분명한 색 대비', '반짝이 효과 가득'], answer: 1, explanation: '뒷자리에서도 읽히게 글자는 크게, 배경과 글자색은 분명하게 해요.'},
  {id: 'q26', topic: '생물과 환경', prompt: '먹이 그물에 대한 설명으로 알맞은 것은?', options: ['먹이 사슬이 하나만 있는 것', '여러 먹이 사슬이 그물처럼 얽힌 것', '생물이 서로 관계없이 사는 것'], answer: 1, explanation: '실제 생태계는 여러 먹이 사슬이 얽힌 먹이 그물이에요.'},
  {id: 'q27', topic: '보안', prompt: 'AI 서비스 비밀번호나 API 키를 공개 게임 코드에 넣으면?', options: ['괜찮다', '누구나 볼 수 있어 위험하다', '게임이 더 빨라진다'], answer: 1, explanation: '공개 코드는 누구나 볼 수 있어요. 비밀번호·키는 넣지 않아요.'},
  {id: 'q28', topic: '오류 전달', prompt: '수정한 뒤 다른 기능이 갑자기 망가졌다면 AI에게 할 말로 알맞은 것은?', options: ['“다 망가졌어.”', '“방금 수정 후 점수 표시가 사라졌어. 수정 전처럼 보이게 해 줘. 다른 기능은 건드리지 마.”', '“아무거나 고쳐 줘.”'], answer: 1, explanation: '언제부터, 무엇이, 어떻게 달라졌는지 말해요.'},
  {id: 'q29', topic: '배포', prompt: '배포한 게임을 학생들과 나누는 가장 쉬운 방법은?', options: ['코드를 한 줄씩 불러 준다', '링크나 QR코드를 공유한다', 'USB로 하나씩 복사한다'], answer: 1, explanation: '배포하면 링크 하나로 학생 태블릿에서도 열려요.'},
  {id: 'q30', topic: '생물과 환경', prompt: '생태계의 비생물 요소로만 묶은 것은?', options: ['햇빛·물·흙·온도', '나무·새·버섯', '사람·물고기·물'], answer: 0, explanation: '햇빛·물·흙·공기·온도는 비생물 요소예요.'},
  {id: 'q31', topic: '반복 수정', prompt: '바이브 코딩의 ‘반복 수정’이란?', options: ['한 번 만들고 끝내기', '결과를 보고 대화로 조금씩 고쳐 나가기', '같은 요청을 계속 복사해 보내기'], answer: 1, explanation: '첫 결과는 초안이에요. 보고, 말하고, 고쳐 나가요.'},
  {id: 'q32', topic: 'HTML', prompt: 'HTML에서 가장 큰 제목을 나타내는 태그는?', options: ['<h1>', '<p>', '<img>'], answer: 0, explanation: '<h1>은 큰 제목, <p>는 문단, <img>는 그림이에요.'},
  {id: 'q33', topic: '프롬프트', prompt: '프롬프트 첫 줄에 “너는 초등 과학 수업용 웹 게임 개발자야”라고 쓰는 이유는?', options: ['AI에게 역할을 정해 알맞은 관점으로 만들게 하려고', '글자 수를 늘리려고', '아무 의미 없다'], answer: 0, explanation: '역할을 주면 그 관점에 맞는 결과가 나와요.'},
  {id: 'q34', topic: '생물과 환경', prompt: '분해자가 하는 일로 알맞은 것은?', options: ['죽은 생물과 배출물을 분해해 양분을 되돌린다', '햇빛으로 스스로 양분을 만든다', '다른 동물을 사냥한다'], answer: 0, explanation: '버섯·곰팡이·세균 같은 분해자가 양분을 다시 자연으로 돌려보내요.'},
  {id: 'q35', topic: '안전한 공유', prompt: '학생 얼굴 사진을 넣은 수업 앱을 공개 링크로 만들면?', options: ['문제없다', '개인정보가 노출될 수 있어 피한다', '사진이 작으면 괜찮다'], answer: 1, explanation: '얼굴은 그 자체로 누구인지 알 수 있는 정보예요.'},
  {id: 'q36', topic: '오류 전달', prompt: '오류를 AI에게 알릴 때 함께 주지 않아도 되는 정보는?', options: ['무엇을 했더니 어떤 일이 생겼는지', '원래 기대한 모습', '오늘의 날씨'], answer: 2, explanation: '했던 것·생긴 일·기대한 모습·오류 메시지·고칠 범위를 알려요.'},
  {id: 'q37', topic: 'JavaScript', prompt: '“버튼을 클릭하면 박수 소리가 나게”처럼 사용자 행동에 반응하는 것을 무엇이라 할까요?', options: ['이벤트(클릭 이벤트)', '배포', '할루시네이션'], answer: 0, explanation: '클릭·키 누르기 같은 행동에 반응하는 것을 이벤트라고 해요.'},
  {id: 'q38', topic: 'AI 결과 검증', prompt: '태블릿과 노트북 화면 모두에서 잘 보이는지 확인하려면?', options: ['한 기기에서만 본다', '여러 화면 크기에서 직접 열어 본다', 'AI가 괜찮다고 했으니 넘어간다'], answer: 1, explanation: '학생이 쓸 기기에서 직접 열어 봐야 확실해요.'},
  {id: 'q39', topic: '생물과 환경', prompt: '한 생물의 수가 갑자기 줄면 생태계에는 어떤 일이 생길 수 있을까요?', options: ['다른 생물에게 아무 영향이 없다', '먹이 관계로 이어진 다른 생물의 수도 변할 수 있다', '모든 생물이 곧바로 사라진다'], answer: 1, explanation: '생물들은 먹이 관계로 연결되어 서로 영향을 주고받아요.'},
  {id: 'q40', topic: '저작권', prompt: '게임 배경 음악으로 가장 안전한 것은?', options: ['유행하는 가요 음원', '직접 만들었거나 사용이 허락된 음원', '출처를 모르는 인터넷 음원'], answer: 1, explanation: '음악도 저작물이에요. 허락된 음원만 써요.'},
  {id: 'q41', topic: '프롬프트', prompt: '“문제를 많이 넣어 줘”보다 좋은 표현은?', options: ['“문제 10개, 한 판 5분 안에 끝나게”', '“엄청 많이”', '“적당히”'], answer: 0, explanation: '분량과 시간은 숫자로 말하면 정확해져요.'},
  {id: 'q42', topic: '웹 기초', prompt: '새로고침해도 점수가 남아 있게 하는 브라우저 저장 기능은?', options: ['localStorage(로컬 스토리지)', '콘솔', '프롬프트'], answer: 0, explanation: '그 기기 브라우저에 저장돼요. 학생 개인정보는 저장하지 않아요.'},
  {id: 'q43', topic: 'AI 결과 검증', prompt: 'AI가 사실이 아닌 내용을 그럴듯하게 지어내는 현상은?', options: ['할루시네이션(환각)', '디버깅', '배포'], answer: 0, explanation: '그래서 내용과 숫자는 교과서와 원본 자료로 확인해요.'},
  {id: 'q44', topic: '단계적 요청', prompt: '“코드는 쓰지 말고 기획안부터 보여 줘”라고 먼저 요청하는 이유는?', options: ['만들 방향을 미리 맞춰 시행착오를 줄이려고', '코드가 싫어서', 'AI를 시험하려고'], answer: 0, explanation: '방향을 먼저 맞추면 다시 만드는 일이 줄어요.'},
  {id: 'q45', topic: '안전한 공유', prompt: '다른 선생님이 공유한 앱 링크를 수업에 쓰기 전에 할 일은?', options: ['개인정보 입력·광고·결제가 있는지 직접 열어 본다', '링크 모양만 본다', '제목이 재밌으면 바로 쓴다'], answer: 0, explanation: '학생에게 보여 주기 전에 교사가 먼저 끝까지 살펴봐요.'},
  {id: 'q46', topic: 'HTML', prompt: '웹페이지에 그림을 넣는 HTML 태그는?', options: ['<img>', '<h1>', '<button>'], answer: 0, explanation: '<img>는 그림, <button>은 버튼이에요.'},
  {id: 'q47', topic: '생물과 환경', prompt: '사막여우의 큰 귀가 하는 역할로 알맞은 것은?', options: ['몸의 열을 밖으로 내보낸다', '몸의 열을 지킨다', '물을 저장한다'], answer: 0, explanation: '더운 사막에서 큰 귀로 열을 내보내요. 귀가 작은 건 북극여우예요.'},
  {id: 'q48', topic: '이해하기', prompt: '코드가 작동은 하는데 왜 되는지 모르겠다면?', options: ['“이 코드가 하는 일을 초등 교사도 알게 쉽게 설명해 줘”라고 묻는다', '그냥 넘어간다', '코드를 지운다'], answer: 0, explanation: 'AI에게 설명을 부탁하면 다음 수정이 쉬워져요.'},
  {id: 'q49', topic: '개인정보', prompt: '학생 상담 기록을 AI로 요약하려 할 때 알맞은 태도는?', options: ['이름만 지우면 괜찮다', '내용만으로도 누구인지 알 수 있어 넣지 않는다', '전부 붙여 넣는다'], answer: 1, explanation: '상담 기록은 가장 민감한 정보예요.'},
  {id: 'q50', topic: '배포', prompt: '배포한 게임을 고쳤는데 화면에 예전 모습이 보인다면?', options: ['새로고침(강력 새로고침)을 해 본다', '게임을 지운다', '처음부터 다시 만든다'], answer: 0, explanation: '브라우저가 예전 파일을 기억(캐시)하고 있을 수 있어요.'},
  {id: 'q51', topic: 'AI 결과 검증', prompt: 'AI 결과의 정확성을 높이려고 덧붙이면 좋은 말은?', options: ['“확실하지 않은 내용은 따로 표시해 줘”', '“무조건 자신 있게 써 줘”', '“출처는 지어내도 돼”'], answer: 0, explanation: '불확실한 부분을 표시하게 하면 확인할 곳이 보여요.'},
  {id: 'q52', topic: '화면 디자인', prompt: '휴대폰·태블릿·PC 화면 크기에 맞게 배치가 바뀌는 디자인은?', options: ['반응형 디자인', '배포', '콘솔'], answer: 0, explanation: '“태블릿에서도 잘 보이게 반응형으로”라고 요청해요.'},
  {id: 'q53', topic: '생물과 환경', prompt: '하천 오염이 심해질 때 가장 먼저 줄어들 가능성이 큰 생물은?', options: ['깨끗한 물에서만 사는 생물', '오염에 강한 생물', '물 밖에서 사는 생물'], answer: 0, explanation: '깨끗한 물을 좋아하는 생물은 환경 변화에 가장 먼저 영향을 받아요.'},
  {id: 'q54', topic: '반복 수정', prompt: '게임의 한 부분만 고치고 싶을 때 꼭 덧붙일 말은?', options: ['“나머지는 그대로 둬.”', '“전부 새로 만들어.”', '“느낌대로.”'], answer: 0, explanation: '범위를 말하지 않으면 잘 되던 부분까지 바뀔 수 있어요.'},
  {id: 'q55', topic: '안전한 공유', prompt: '동료 선생님과 만든 자료를 나눌 때 가장 좋은 방법은?', options: ['HTML 코드를 메신저에 통째로 붙여 넣기', '배포한 링크와 사용 방법 한 줄 공유', '파일 이름만 알려 주기'], answer: 1, explanation: '링크와 짧은 사용법이면 누구나 바로 열어 볼 수 있어요.'},
  {id: 'q56', topic: '디버깅', prompt: '콘솔에 ‘is not defined’ 오류가 떴다면 대체로 무슨 뜻일까요?', options: ['어떤 이름(함수·변수)을 찾을 수 없다', '인터넷이 끊겼다', '컴퓨터가 고장 났다'], answer: 0, explanation: '이 메시지를 그대로 AI에게 붙여 넣으면 원인을 바로 찾아요.'},
  {id: 'q57', topic: '생물과 환경', prompt: '다음 중 1차 소비자에 해당하는 것은?', options: ['메뚜기', '벼', '곰팡이'], answer: 0, explanation: '식물을 먹는 메뚜기는 1차 소비자예요.'},
  {id: 'q58', topic: '저작권', prompt: 'AI로 만든 그림을 수업 자료에 넣을 때 알맞은 태도는?', options: ['유명 캐릭터를 그대로 그려 달라고 한다', '새로 만든 그림인지 확인하고 서비스의 사용 조건을 지킨다', '아무 그림이나 괜찮다'], answer: 1, explanation: '남의 캐릭터를 흉내 내지 않고, 도구의 사용 조건도 확인해요.'},
  {id: 'q59', topic: 'JavaScript', prompt: '점수처럼 바뀌는 값을 담아 두는 ‘이름표 상자’를 코딩에서 무엇이라 할까요?', options: ['변수', '배포', '태그'], answer: 0, explanation: 'score = 0처럼 값에 이름을 붙여 담는 상자가 변수예요.'},
  {id: 'q60', topic: '마무리', prompt: '이 게임이 추천하는 바이브 코딩의 마지막 단계는?', options: ['저장하고 퇴근하기', '밤새 기능 추가하기', '저장 없이 창 닫기'], answer: 0, explanation: '잘 된 버전을 저장했다면, 이제 퇴근하세요.'},
]);

/** Today's question (Korean date). The same for every teacher on the same day. */
export function quizForDay(now = Date.now()) {
  const index = quizIndexFor(now, QUIZ_BANK.length);
  return {index, question: QUIZ_BANK[index]};
}
export function checkQuizAnswer(questionId, choice) {
  const question = QUIZ_BANK.find(q => q.id === questionId);
  if (!question) return {known: false, correct: false};
  return {known: true, correct: Number(choice) === question.answer, explanation: question.explanation};
}
