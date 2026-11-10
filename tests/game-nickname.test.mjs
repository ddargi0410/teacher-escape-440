import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createChannels} from '../channels.js';
import {freshState} from '../save.js';
import {createDocument} from './dom-stub.mjs';
import {createAnalyticsIdentity} from '../analytics-identity.js';

const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
// Run the production start/resume and HUD functions, plus their actual channel
// constructor, without booting WebGL. Only the network boundary is simulated.
function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} exists`);
  const next=source.indexOf('\nfunction ',start+1);
  return source.slice(start,next===-1?undefined:next);
}
const channelsSource=source.split('\n').find(line=>line.trim().startsWith('channels=createChannels('));
const noop=()=>{};
const flush=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};
function setup(){
  const document=createDocument();document.body=document.createElement('body');
  document.body.innerHTML='<div id="home"></div><div id="hud"></div><button id="view-button"></button><div id="tutorial-title"></div><div id="tutorial-text"></div><div id="social-bar"><span id="social-status"></span><span id="social-nickname"></span><span id="social-connect-label"></span><button data-greet="wave"></button></div>';
  let status={state:'offline',connected:false,count:0},saved;
  const connections=[],chooser=[],avatars=[],analyticsNames=[],identity=createAnalyticsIdentity();
  identity.subscribe(name=>analyticsNames.push(name));
  const presence={
    getSnapshotStatus:()=>status,
    disconnect(){status={state:'offline',connected:false,count:0};},
    async connect({room,nickname}){connections.push({room,nickname});status={state:'online',room,nickname,connected:true,count:1};return true;}
  };
  const context={
    state:freshState('수진의 퇴근'),mode:'home',document,presence,honors:null,
    $:selector=>document.body.querySelector(selector),$$:selector=>document.body.querySelectorAll(selector),
    createChannels:options=>createChannels({...options,runtime:{document,fetch:async()=>({ok:false}),now:()=>0}}),
    PRESENCE_ENDPOINT:'https://relay.example/api/presence',
    rest:{close:noop,isOpen:()=>false},learning:{close:noop},channelUI:{close:noop,update:value=>chooser.push(value)},
    messenger:{reset:noop,notifyMissionSuccess:noop},clearEncounter:noop,clearGreetingFeedback:noop,
    world:{applyTeacherAppearance:(model,id)=>avatars.push(id),resetCrowd:noop,reset:noop,setCompleted:noop,setFloor:noop},
    player:{setView:noop,setCameraMode:noop,resetCamera:noop,setFloor:noop},teacher:{visible:false},
    applyQuality:noop,audio:{setEnabled:noop},updateSound:noop,updateHUD:noop,persist:noop,
    loadGame:()=>saved,storageAvailable:()=>true,toast:noop,showCertificate:noop,
    publishAnalyticsNickname:identity.publish,resumeYard:noop
  };
  vm.createContext(context);
  vm.runInContext(functionSource('start')+'\n'+functionSource('onChannelChange')+'\n'+channelsSource,context);
  return {context,connections,chooser,avatars,analyticsNames,identity,q:context.$,setSaved:value=>{saved=value;},dispose:()=>context.channels.dispose()};
}

test('actual game start, continue and channel switching send the entered saved nickname',async t=>{
  const h=setup();t.after(h.dispose);
  assert.deepEqual(h.analyticsNames,[],'loading a saved home page does not publish its nickname');
  h.context.start(false);await flush();
  assert.equal(h.connections.at(-1).nickname,'수진의 퇴근');
  assert.deepEqual(h.analyticsNames,['수진의 퇴근']);
  const saved={...freshState('이어서 하는 닉네임'),completed:[1,4],elapsed:321,penalty:5,bossDraft:'작성 중인 요청'};
  h.setSaved(saved);h.context.start(true);await flush();
  assert.equal(h.connections.at(-1).nickname,saved.name);
  await h.context.channels.select(2);await flush();
  assert.deepEqual(h.connections.map(item=>item.nickname),['수진의 퇴근','이어서 하는 닉네임','이어서 하는 닉네임']);
  assert.deepEqual(h.analyticsNames,['수진의 퇴근','이어서 하는 닉네임']);
  assert.deepEqual(h.context.state,saved,'nickname reconnects keep saved game progress intact');
});

test('production start publishes the current entered name even when saving is unavailable',async t=>{
  const h=setup();t.after(h.dispose);
  h.context.storageAvailable=()=>false;
  h.context.state=freshState('저장 안 돼도 내 이름');
  h.context.start(false);await flush();
  assert.deepEqual(h.analyticsNames,['저장 안 돼도 내 이름']);
  assert.equal(h.context.mode,'play');
});

test('analytics bridge listener failures never prevent actual game start',async t=>{
  const h=setup();t.after(h.dispose);
  h.identity.subscribe(()=>{throw new Error('analytics unavailable');});
  assert.doesNotThrow(()=>h.context.start(false));await flush();
  assert.equal(h.context.mode,'play');assert.equal(h.connections.length,1);
  h.context.publishAnalyticsNickname=()=>{throw new Error('bridge unavailable');};
  assert.doesNotThrow(()=>h.context.start(false));await flush();
  assert.equal(h.context.mode,'play');assert.equal(h.connections.length,2);
});

test('HUD shows the exact connected nickname and uses saved nickname while offline',()=>{
  const h=setup();
  const connected={connected:true,selected:2,count:3,nickname:'실제로 전달한 <이름>'};
  h.context.mode='play';h.context.onChannelChange(connected);
  assert.equal(h.q('#social-nickname').textContent,'내 닉네임 · 실제로 전달한 <이름>');
  assert.equal(h.q('#social-nickname').title,connected.nickname);
  assert.equal(h.chooser.at(-1).nickname,connected.nickname);
  assert.equal(h.q('#social-bar').hidden,false);
  assert.equal(h.q('[data-greet]').disabled,false);
  h.context.onChannelChange({connected:false,offline:true,nickname:''});
  assert.equal(h.q('#social-nickname').textContent,'내 닉네임 · 수진의 퇴근');
  assert.equal(h.chooser.at(-1).nickname,'수진의 퇴근');
  assert.equal(h.q('[data-greet]').disabled,true);
  h.dispose();
});


test('start and resume apply the selected saved teacher without changing progress', async t=>{
  const h=setup();t.after(h.dispose);
  h.context.state.avatarId='sunny';h.context.start(false);await flush();
  assert.equal(h.avatars.at(-1),'sunny');
  const saved={...freshState('캐릭터도 이어서'),avatarId:'indigo',completed:[1,3],elapsed:123};
  h.setSaved(saved);h.context.start(true);await flush();
  assert.equal(h.avatars.at(-1),'indigo');
  assert.deepEqual(h.context.state,saved);
  assert.equal(h.q('#view-button').textContent,'시점 · 어깨높이');
});
