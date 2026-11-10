// Shared by the browser and the server. Blocks personal details and abuse in
// tree name tags and guestbook notes before anything is stored or shown.
// The checks are deliberately simple and explainable to teachers.

export const FILTER_MESSAGE = '미션 7 기억나시죠? 이 게시판도 학교 밖이에요.';

const REASONS = Object.freeze({
  phone: '전화번호처럼 보이는 숫자가 있어요.',
  email: '이메일 주소가 있어요.',
  school: '학교 이름이 있어요. ‘우리 학교’처럼 바꿔 주세요.',
  classroom: '학년·반 정보가 있어요. ‘우리 반’처럼 바꿔 주세요.',
  profanity: '다른 선생님이 읽기 힘든 표현이 있어요.',
  empty: '내용을 적어 주세요.',
  long: '글자 수를 줄여 주세요.',
});

// Ordinary words that end in 초 and must never look like a school name.
const CHO_WORDS = new Set(['최초', '당초', '연초', '월초', '주초', '해초', '기초', '잡초', '수초', '감초', '애초', '태초', '학기초', '학년초', '개학초', '방학초', '허브초', '몇초', '분초', '매초', '퇴근초']);
// Only a name written directly before the school word: '문남초등학교', not '저는 초등학교 교사'.
const SCHOOL_WORDS = /[가-힣A-Za-z]{1,12}(초등학교|중학교|고등학교|초교|여중|여고|남중|남고)/;
const CHO_SCHOOL = /([가-힣]{2,10})초(?![가-힣])/g;
const PHONE = [
  // A short field can cut the last digit off, so 3-digit endings count too.
  /01[016789][\s.\-]?\d{3,4}[\s.\-]?\d{3,4}/,
  /0\d{1,2}[\s.\-]\d{3,4}[\s.\-]\d{4}/,
  /(?:\d[\s.\-]?){9,}/,
];
const EMAIL = /[A-Za-z0-9._%+\-]+\s?@\s?[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
const CLASSROOM = /\d\s*학년\s*\d{1,2}\s*반/;

// Exceptions are removed before matching ('새끼손가락' is a pinky promise).
const SAFE_PHRASES = ['새끼손가락', '시발점', '시발역', '시바견', '불이 꺼져'];
// '새끼' alone stays allowed: '새끼 고양이' and '새끼손가락' are everyday words.
const PROFANITY = [
  '씨발', '시발', '씨바', '씌발', 'ㅅㅂ', 'ㅆㅂ', 'ㅅ1ㅂ', '병신', '븅신', 'ㅂㅅ', '좆', 'ㅈ같', '존나', '지랄', 'ㅈㄹ',
  '개새끼', '닥쳐', '미친놈', '미친년', '미친새끼', '엿먹', '썅', '쌍놈', '쌍년',
  'fuck', 'shit', 'bitch', 'asshole',
];
// A few strong words are also checked with spaces and symbols removed.
const STRONG = ['씨발', '시발', '병신', '좆', '지랄', '개새끼'];

/** Removes control characters and trims. Keeps ordinary emoji and punctuation. */
export function cleanText(value, max = 200) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function stripSafe(text) {
  let out = text.toLowerCase();
  for (const phrase of SAFE_PHRASES) out = out.split(phrase).join(' ');
  return out;
}

/**
 * @returns {{ok:true}|{ok:false, reason:string, message:string, detail:string}}
 */
export function checkText(value, { max = 80 } = {}) {
  const text = cleanText(value, 10000);
  if (!text) return fail('empty');
  if ([...text].length > max) return fail('long');
  if (PHONE.some(pattern => pattern.test(text.replace(/[()]/g, '')))) return fail('phone');
  if (EMAIL.test(text)) return fail('email');
  if (CLASSROOM.test(text)) return fail('classroom');
  if (SCHOOL_WORDS.test(text) && !/퇴근초등학교/.test(text.replace(/\s/g, ''))) return fail('school');
  for (const match of text.matchAll(CHO_SCHOOL)) {
    const word = match[1] + '초';
    const tail = [...CHO_WORDS].some(safe => word.endsWith(safe));
    if (!tail) return fail('school');
  }
  const lowered = stripSafe(text);
  if (PROFANITY.some(word => lowered.includes(word))) return fail('profanity');
  const squeezed = lowered.replace(/[\s.,·_\-~!?*^0-9]/g, '');
  if (STRONG.some(word => squeezed.includes(word))) return fail('profanity');
  return { ok: true };
}

function fail(reason) {
  return { ok: false, reason, message: FILTER_MESSAGE, detail: REASONS[reason] || '' };
}
