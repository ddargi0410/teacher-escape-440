import {getStage2Arcade} from './stage2-content.js';

/*
 * Mini-game presentation copy. The complete questions, choices, answers and
 * explanations remain unchanged in ../missions-data.js.
 * These short labels summarize the same content for fast physical play.
 * sourceIndex and originalText preserve the connection to the full lesson.
 */

export const NPC_LINES = {
  1: ['선생님! 쟤가 먼저 했어요!', '판결은 O와 X로 부탁해요.'],
  2: ['커피 한 잔 해요. 두 봉지예요.', '부탁도 다섯 칸이면 구체적이죠.'],
  3: ['우리 아이 마음도 읽어주셨나요?', 'AI도 독심술은 못 한대요.'],
  4: ['공문도 코딩도 한 입씩요.', '작은 것부터 확인해요.'],
  5: ['어떤 버튼이 어떻게 안 되나요?', '증상을 알면 같이 고쳐요.'],
  6: ['말투는 만점, 내용은 재검토!', '과학 내용은 직접 확인해요.'],
  7: ['그 명단, 붙여넣기 잠깐만요!', '가상 예시로도 충분해요.'],
  8: ['어제는 됐는데! 오늘이 행사인데!', '원인부터 나누고 하나씩 고쳐요.'],
  9: ['오늘 밥은 앉아서 드셨나요?', '퇴식 전에 용어 한 숟갈요.'],
  10: ['선생님, 퇴근 전에 잠깐만요~', '오늘 할 범위부터 정해 볼까요?']
};

const oxLabels = [
  ['AI에게 말로 요청하고 실행하며 고친다.', '요청 → 실행 → 확인 → 수정'],
  ['보기 좋은 AI 퀴즈는 정답도 정확하다.', '예쁜 화면도 정답은 직접 검증!'],
  ['교사가 목표를 정하고 직접 시험한다.', '목표와 최종 판단은 교사의 몫!']
];

const coffeeLabels = {
  'c-role': '과학 웹 개발 도우미',
  'c-audience': '초등학교 5학년',
  'c-goal': '생산·소비·분해 구분',
  'c-constraints': '태블릿·큰글자·실명X',
  'c-format': 'HTML 3문항·해설',
  'c-vague': '알아서 대박 나게',
  'c-pressure': '급하니 오류 없겠지'
};

const phoneCopy = [
  {
    parent: '우리 아이 마음도 읽어주셨나요?',
    choices: ['5학년·3문항·이유', '재밌고 교육적으로'],
    tip: '대상·문항 수·반응을 구체적으로!'
  },
  {
    parent: '브로콜리 때문에 속상했대요.',
    choices: ['요즘 감성으로 다시', '내용 유지·20px 이상'],
    tip: '바꿀 것과 유지할 것을 함께!'
  },
  {
    parent: '짝꿍보다 스티커가 하나 적어요.',
    choices: ['먹이순서 선택→화살표', '뭔가 인터랙티브하게'],
    tip: '학생 행동과 화면 반응을 지정!'
  },
  {
    parent: '어젯밤 10시 47분 문자 보셨어요?',
    choices: ['전문가니까 완성본만', '문항 검토→화면 제작'],
    tip: '교과서 대조 후 화면을 만들어요.'
  },
  {
    parent: '우리 애는 원래 착한 애예요.',
    choices: ['공유도 알아서 완벽히', '무실명·배포·기기확인'],
    tip: '공유 환경·개인정보·접속 확인!'
  }
];

/** Return a new presentation object, never mutate the canonical mission. */
export function getArcadeData(mission) {
  if (!mission || !Number.isInteger(mission.id)) throw new TypeError('A mission is required');
  let arcade;
  if (mission.id === 1) {
    const questions = mission.items.map((item, sourceIndex) => ({
      text: oxLabels[sourceIndex][0], answer: item.answer,
      tip: oxLabels[sourceIndex][1], sourceIndex,
      originalText: item.q, explanation: item.explanation
    }));
    // Two additional runs reinforce concepts already explained by the original
    // questions; the three original questions/answers are not replaced.
    questions.push({
      text: 'AI에게 맡기면 교사의 검증은 생략한다.', answer: false,
      tip: 'AI가 만들어도 교사가 검증해요.', sourceIndex: 2,
      originalText: mission.items[2].q, explanation: mission.items[2].explanation,
      reinforcement: true
    }, {
      text: 'AI에게 결과를 보고 수정 요청을 한다.', answer: true,
      tip: '직접 실행한 뒤 필요한 수정을!', sourceIndex: 0,
      originalText: mission.items[0].q, explanation: mission.items[0].explanation,
      reinforcement: true
    });
    arcade = {
      title: '금쪽이 OX 달리기', instruction: '5초 안에 정답 구역으로!', icon: '⌨',
      questions, duration: 90, roundSeconds: 5
    };
  } else if (mission.id === 2) {
    const slots = mission.slots.map(slot => ({ ...slot }));
    const cards = mission.cards.map(card => ({
      id: card.id, slot: card.slot, label: coffeeLabels[card.id] || card.text,
      good: card.slot !== null, originalText: card.text
    }));
    arcade = {
      title: '믹스커피 카드 캐치', instruction: '필요한 카드를 머그컵으로!', icon: '↔',
      duration: 90, slots, cards,
      assembly: slots.map(slot => {
        const card = cards.find(card => card.slot === slot.id);
        return { slot: slot.id, label: card.label, text: card.originalText };
      }),
      tip: '지금 필요한 칸의 카드만 받으세요.',
      spillTip: '“알아서” 대신 구체적인 조건!'
    };
  } else if (mission.id === 3) {
    arcade = {
      title: '민원 전화 두더지', instruction: '전화 받고 구체적인 쪽 선택!', icon: '☝',
      duration: 90, answerSeconds: 3,
      calls: mission.items.map((item, sourceIndex) => ({
        ...phoneCopy[sourceIndex], choices: [...phoneCopy[sourceIndex].choices],
        answer: item.answer, sourceIndex,
        originalText: item.q, originalOptions: [...item.options], explanation: item.explanation
      }))
    };
  }
  arcade ||= getStage2Arcade(mission);
  return { ...mission, ...(arcade ? { arcade } : {}) };
}

/** Long explanations are available outside timed play, on the knowledge card. */
export function getKnowledgeDetails(mission) {
  const details = [];
  if (mission.slots && mission.cards) {
    for (const slot of mission.slots) {
      const card = mission.cards.find(item => item.slot === slot.id);
      if (card) details.push({
        question: slot.label,
        answer: card.text,
        explanation: '짧은 카드에 담긴 원래 요청문입니다.'
      });
    }
  }
  if (mission.items) {
    for (const item of mission.items) {
      const question = item.q || item.text;
      let answer;
      if (typeof item.answer === 'boolean') answer = item.answer ? 'O · 맞는 설명' : 'X · 틀린 설명';
      else if (Number.isInteger(item.answer) && item.options) answer = item.options[item.answer];
      else if (typeof item.wrong === 'boolean') answer = item.wrong ? '고쳐야 하는 문장' : '맞는 문장';
      else if (item.category && mission.categories) answer = mission.categories.find(c => c.id === item.category)?.label;
      if (question && item.explanation) details.push({ question, ...(answer ? { answer } : {}), explanation: item.explanation });
    }
  }
  if (mission.turns) {
    for (const turn of mission.turns) {
      if (turn.q && turn.explanation) details.push({ question: turn.q, answer: turn.options?.[turn.answer], explanation: turn.explanation });
    }
  }
  if (mission.repair) details.push({ question: mission.repair.q, answer: mission.repair.options?.[mission.repair.answer], explanation: mission.repair.explanation });
  details.push(...(getStage2Arcade(mission)?.details || []));
  if (mission.explanation) details.push({ question: '이 업무의 핵심', explanation: mission.explanation });
  return details;
}
