import test from 'node:test';
import assert from 'node:assert/strict';
import {certificateTextLines,downloadCertificate} from '../certificate.js';
import {MISSIONS} from '../missions-data.js';

function context(){
  const records=[];
  return {font:'400 21px sans-serif',textAlign:'left',records,
    measureText(text){const size=Number(this.font.match(/([\d.]+)px/)?.[1]||21);return {width:[...text].reduce((sum,c)=>sum+(c===' '?size*.32:/[\x00-\x7f]/.test(c)?size*.65:size),0)};},
    fillText(text,x,y,maxWidth){records.push({text,x,y,maxWidth,font:this.font,align:this.textAlign});},
    fillRect(){},beginPath(){},roundRect(){},fill(){},arc(){},moveTo(){},lineTo(){},stroke(){}};
}

test('certificate text wraps Korean at word boundaries and retains explicit paragraphs',()=>{
  const ctx=context();
  assert.deepEqual(certificateTextLines(ctx,'오류 메시지가 보이면 그대로 전달하고',145),['오류 메시지가','보이면 그대로','전달하고']);
  assert.deepEqual(certificateTextLines(ctx,'첫 번째 줄\n두 번째 줄',633),['첫 번째 줄','두 번째 줄']);
  assert.deepEqual(certificateTextLines(ctx,'',633),[]);
});

test('only oversized tokens split, and all ten actual card bodies fit fully within four lines',()=>{
  const ctx=context(),token='아주긴닉네임이공백없이이어져도내용은남아요';
  const split=certificateTextLines(ctx,token,105);assert.equal(split.join(''),token);assert.ok(split.every(line=>ctx.measureText(line).width<=105));
  for(const mission of MISSIONS){
    const lines=certificateTextLines(ctx,mission.card.body,633);
    assert.equal(lines.join(' '),mission.card.body,`card ${mission.id} keeps every complete word`);
    assert.ok(lines.length<=4,`card ${mission.id} fits without truncating content`);
    assert.ok(lines.every(line=>ctx.measureText(line).width<=633));
  }
});

test('downloaded certificate centers both approval labels inside the badge without changing records',async()=>{
  const ctx=context(),originalDocument=globalThis.document,originalTimeout=globalThis.setTimeout;
  const canvas={width:0,height:0,getContext:()=>ctx,toBlob:callback=>callback(new Blob(['png']))};
  const link={click(){this.clicked=true;},remove(){}};
  globalThis.document={fonts:{ready:Promise.resolve()},createElement:type=>type==='canvas'?canvas:link,body:{appendChild(){}}};
  globalThis.setTimeout=()=>0;
  try{
    const state={name:'화면확인 선생님',elapsed:1110,penalty:5,completed:[1,2,3,4,5,6,7,8,9,10]};
    await downloadCertificate(state,MISSIONS);
    for(const label of ['퇴근 승인','10 / 10 MISSIONS CLEARED']){
      const line=ctx.records.find(record=>record.text===label);
      assert.equal(line.align,'center');assert.equal(line.x,1305);assert.equal(line.maxWidth,322);
      assert.ok(line.x-line.maxWidth/2>=1120+24&&line.x+line.maxWidth/2<=1490-24);
    }
    assert.ok(ctx.records.some(row=>row.text==='화면확인 선생님'));
    assert.ok(ctx.records.some(row=>row.text==='16:42'));
    assert.equal(link.clicked,true);assert.equal(canvas.width,1600);assert.equal(canvas.height,2100);
    assert.ok(!ctx.records.some(row=>row.text.includes('…')),'all complete card content is retained');
    URL.revokeObjectURL(link.href);
  }finally{globalThis.document=originalDocument;globalThis.setTimeout=originalTimeout;}
});
