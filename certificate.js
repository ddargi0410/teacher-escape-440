import {schoolTime, overtimeLabel, overtimeMinutes, actualPlaySeconds, departureState} from './school-clock.js?v=20261108-stay1';

function elapsedLabel(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}분 ${String(value % 60).padStart(2, '0')}초`;
}


export function certificateTextLines(ctx, text, width) {
  const lines = [];
  const paragraphs=String(text).split(/\r?\n/);
  for(const paragraph of paragraphs){
    let line='';
    for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
      if(ctx.measureText(word).width>width){
        if(line){lines.push(line);line='';}
        // Only a token wider than the entire card may split inside a word.
        for(const character of word){
          if(line&&ctx.measureText(line+character).width>width){lines.push(line);line='';}
          line+=character;
        }
        continue;
      }
      const next=line?`${line} ${word}`:word;
      if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}
      else line=next;
    }
    if(line||paragraphs.length>1)lines.push(line);
  }
  return lines;
}

function wrapText(ctx, text, x, y, width, lineHeight, maxLines = Infinity) {
  const lines=certificateTextLines(ctx,text,width);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) {
    let last = visible.at(-1);
    while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
    visible[visible.length - 1] = last + '…';
  }
  visible.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  return y + visible.length * lineHeight;
}

function roundRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

/** Download one high-resolution PNG, generated entirely on the current device. */
export async function downloadCertificate(state, missions) {
  state = departureState(state);
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 2100;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서 이미지 저장을 준비하지 못했어요.');
  const face = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.fillStyle = '#f5f0e5';
  ctx.fillRect(0, 0, 1600, 2100);
  ctx.fillStyle = '#143b34';
  ctx.fillRect(0, 0, 1600, 410);
  ctx.fillStyle = '#c6e594';
  ctx.font = `600 25px ${face}`;
  ctx.fillText('AFTER SCHOOL CLUB  /  VIBE CODING', 100, 92);
  ctx.font = `900 98px ${face}`;
  ctx.fillStyle = '#fffaf0';
  ctx.fillText('퇴근 증명서', 94, 221);
  ctx.font = `500 31px ${face}`;
  ctx.fillStyle = '#d2e1d8';
  ctx.fillText('4시 40분의 기적 — 바이브 코딩으로 학교 탈출', 100, 290);
  ctx.font = `500 25px ${face}`;
  ctx.fillText('오늘의 업무는 끝났습니다. 내일의 업무는 내일의 나에게.', 100, 349);
  roundRect(ctx, 1120, 100, 370, 165, 20, '#c6e594');
  ctx.fillStyle = '#143b34';
  ctx.textAlign = 'center';
  ctx.font = `900 57px ${face}`;
  ctx.fillText('퇴근 승인', 1305, 178, 322);
  ctx.font = `600 23px ${face}`;
  ctx.fillText('10 / 10 MISSIONS CLEARED', 1305, 220, 322);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#143b34';
  ctx.font = `800 49px ${face}`;
  const name = typeof state.name === 'string' ? state.name.slice(0, 24) : '퇴근희망 교사';
  wrapText(ctx, name.endsWith('선생님') ? name : `${name} 선생님`, 100, 493, 1400, 58, 2);
  ctx.fillStyle = '#53645b';
  ctx.font = `400 27px ${face}`;
  ctx.fillText('10가지 업무를 해결하고, AI에게 일을 맡기는 요령을 익혔습니다.', 100, 600);
  roundRect(ctx, 100, 640, 683, 180, 18, '#143b34');
  ctx.fillStyle = '#d2e1d8';
  ctx.font = `600 26px ${face}`;
  ctx.fillText('게임 속 퇴근 시각', 132, 685);
  ctx.fillStyle = '#fffaf0';
  ctx.font = `900 88px ${face}`;
  ctx.fillText(schoolTime(state), 128, 785);
  const workedLate = overtimeMinutes(state) > 0;
  roundRect(ctx, 817, 640, 683, 180, 18, workedLate ? '#f0d6b8' : '#e3e9d8');
  ctx.fillStyle = workedLate ? '#7a431c' : '#53645b';
  ctx.font = `600 26px ${face}`;
  ctx.fillText('야근 시간 · 16:40 이후', 849, 685);
  ctx.fillStyle = workedLate ? '#7a431c' : '#143b34';
  ctx.font = `900 62px ${face}`;
  ctx.fillText(overtimeLabel(state), 849, 780);
  ctx.fillStyle = '#53645b';
  ctx.font = `500 24px ${face}`;
  ctx.fillText(`실제 플레이 시간  ${elapsedLabel(actualPlaySeconds(state))}`, 100, 870);
  ctx.fillText('챙겨 가는 노하우  10장 / 10장', 817, 870);
  ctx.fillStyle = '#143b34';
  ctx.font = `800 34px ${face}`;
  ctx.fillText('퇴근 가방에 챙긴 10가지', 100, 925);
  (Array.isArray(missions) ? missions : []).slice(0, 10).forEach((mission, index) => {
    const x = 100 + (index % 2) * 717;
    const y = 963 + Math.floor(index / 2) * 190;
    roundRect(ctx, x, y, 683, 178, 14, '#ffffff');
    ctx.fillStyle = '#e7efe0';
    ctx.beginPath();
    ctx.arc(x + 36, y + 37, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#143b34';
    ctx.font = `800 23px ${face}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(index + 1).padStart(2, '0'), x + 36, y + 45);
    ctx.textAlign = 'left';
    ctx.font = `800 26px ${face}`;
    const title = mission.card?.title || mission.shortTitle || mission.title || `노하우 ${index + 1}`;
    ctx.fillText(String(title).replace(/^\d+\s*·\s*/,''), x + 70, y + 45, 585);
    ctx.fillStyle = '#4e5c53';
    ctx.font = `400 21px ${face}`;
    wrapText(ctx, mission.card?.body || '', x + 25, y + 80, 633, 26, 4);
  });
  ctx.strokeStyle = '#a3b0a2';
  ctx.beginPath();
  ctx.moveTo(100, 1940); ctx.lineTo(1500, 1940); ctx.stroke();
  ctx.fillStyle = '#53645b';
  ctx.font = `500 22px ${face}`;
  ctx.fillText('연수 활동 기념 이미지 · 공식 연수 이수증이 아닙니다.', 100, 1990);
  ctx.fillText('프롬프트를 복사해서, 이제 나만의 환경생태 수업자료를 만들어 보세요.', 100, 2031);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('이미지를 만들지 못했어요. 다시 눌러 주세요.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = name.replace(/[\\/:*?"<>|]/g, '').slice(0, 24) || '선생님';
  link.download = `퇴근증명서_${safeName}.png`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}

export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* Older or embedded browsers can still use the selection fallback. */ }
  const previous = document.activeElement;
  const field = document.createElement('textarea');
  field.value = value;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;left:-9999px;top:0;font-size:16px;';
  document.body.appendChild(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, field.value.length);
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  field.remove();
  if (previous instanceof HTMLElement) previous.focus();
  return copied;
}
