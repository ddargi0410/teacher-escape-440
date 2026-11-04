import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-stub.mjs';
import {createChannelUI} from '../channels-ui.js';

function setup(snapshot={}){
  const document=createDocument(),container=document.createElement('div');
  const events=[];
  const ui=createChannelUI({container,onSelect:id=>events.push(['select',id]),onClose:()=>events.push(['close']),onRefresh:()=>events.push(['refresh']),onSolo:()=>events.push(['solo']),onReconnect:()=>events.push(['reconnect'])});
  const state={selected:1,connected:true,loading:false,offline:false,directoryKnown:true,channels:Array.from({length:10},(_,i)=>({id:i+1,count:i===0?3:0,occupiedBeds:i===0?2:0,freeBeds:i===0?3:5,capacity:30})),...snapshot};
  ui.open(state);
  return {document,container,events,ui,state,q:s=>container.querySelector(s)};
}

test('channel picker needs no code and distinguishes actual free beds from unknown counts',()=>{
  const {container,q,ui,state}=setup();
  assert.equal(container.querySelectorAll('input').length,0);
  assert.equal(container.querySelectorAll('[data-channel]').length,10);
  assert.match(q('[data-channel="1"]').textContent,/빈 침대 3 \/ 5/);
  assert.equal(q('[data-channel="1"]').disabled,true);
  ui.update({...state,directoryKnown:false});
  assert.match(q('[data-channel="2"]').textContent,/—/);
  assert.match(q('[data-channel="2"]').textContent,/빈 침대 확인 중/);
  assert.doesNotMatch(q('[data-channel="2"]').textContent,/빈 침대 5/);
});

test('a room with occupied beds remains enterable while a channel at30 users does not',()=>{
  const {q,ui,state,events}=setup();
  const channels=state.channels.map(c=>c.id===2?{...c,count:7,occupiedBeds:5,freeBeds:0}:c.id===3?{...c,count:30}:c);
  ui.update({...state,channels});
  assert.equal(q('[data-channel="2"]').disabled,false);
  assert.match(q('[data-channel="2"]').textContent,/둘러보기 가능/);
  q('[data-channel="2"]').click();q('[data-channel="3"]').click();
  assert.deepEqual(events,[['select',2]]);
});

test('switch in progress blocks repeat selections; directory refresh does not',()=>{
  const {q,ui,state,events}=setup();
  ui.update({...state,refreshing:true});q('[data-channel="2"]').click();
  assert.deepEqual(events,[['select',2]]);
  ui.update({...state,loading:true});q('[data-channel="2"]').click();q('[data-channel-action="solo"]').click();
  assert.deepEqual(events,[['select',2]]);
});

test('solo, reconnect and refresh invoke exactly one callback and preserve readable errors',()=>{
  const {q,ui,state,events,container}=setup();
  q('[data-channel-action="solo"]').click();q('[data-channel-action="refresh"]').click();
  ui.update({...state,offline:true,connected:false,error:'<script>connection</script>'});
  q('[data-channel-action="reconnect"]').click();
  assert.deepEqual(events,[['solo'],['refresh'],['reconnect']]);
  assert.equal(container.querySelectorAll('script').length,0);
  assert.match(q('.channel-error').textContent,/<script>/);
});

test('keyboard focus stays in the picker and Escape closes without triggering school shortcuts',()=>{
  const {q,container,document,ui,events}=setup();
  let prevented=0,stopped=0;
  q('[data-channel-action="solo"]').focus();
  container.onkeydown({key:'Tab',shiftKey:false,preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
  assert.equal(document.activeElement,q('[data-channel-action="close"]'));
  container.onkeydown({key:'Escape',preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
  assert.equal(ui.isOpen(),false);assert.equal(container.hidden,true);
  assert.equal(prevented,2);assert.equal(stopped,2);assert.deepEqual(events,[['close']]);
  ui.close();ui.dispose();ui.dispose();assert.deepEqual(events,[['close']]);
});


test('the channel header shows the actual nickname as safe text and follows name updates',()=>{
  const {q,ui,state,container}=setup({nickname:'<수진> & "퇴근"'});
  assert.equal(q('.channel-nickname').textContent,'내 닉네임: <수진> & "퇴근"');
  assert.equal(container.querySelectorAll('script').length,0);
  ui.update({...state,nickname:'다음 출근 닉네임',offline:true,connected:false});
  assert.equal(q('.channel-nickname').textContent,'내 닉네임: 다음 출근 닉네임');
  ui.update({...state,nickname:''});
  assert.equal(q('.channel-nickname').textContent,'입력한 닉네임으로 함께해요');
  assert.doesNotMatch(q('.channel-nickname').textContent,/퇴근동료|퇴근 동료/);
});
