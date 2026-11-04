import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,saveGame,loadGame} from '../save.js';

test('a long boss prompt survives save and reload without a character limit',()=>{
  const values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const state=freshState('검증 선생님');
  state.bossDraft='초등학교 5학년 생태 퀴즈를 HTML 파일로 만들고 직접 확인해 줘.\n'.repeat(2000);
  assert.ok(state.bossDraft.length>50000);
  assert.equal(saveGame(state),true);
  assert.equal(loadGame().bossDraft,state.bossDraft);
});

test('storage capacity failure is reported without throwing or truncating the draft',()=>{
  globalThis.localStorage={setItem:()=>{throw new Error('QuotaExceededError');}};
  const state=freshState();state.bossDraft='직접 작성한 요청문';
  assert.equal(saveGame(state),false);
  assert.equal(state.bossDraft,'직접 작성한 요청문');
});
