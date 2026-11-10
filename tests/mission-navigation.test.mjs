import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import {createWorld} from '../world.js';
import {MISSIONS} from '../missions-data.js';
import {pointBlocked} from '../crowd.js';

const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})})};
const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
// Execute production navigation and its production messenger callback without
// running the game's DOM/WebGL/audio boot sequence.
function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} exists`);
  const body=source.indexOf('{',start);
  let depth=0;
  for(let i=body;i<source.length;i++){
    if(source[i]==='{')depth++;
    if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`Unclosed function ${name}`);
}
const messengerSource=source.split('\n').find(line=>line.startsWith('const messenger=createSchoolMessenger('));
assert.ok(messengerSource,'production messenger initialization exists');

function harness(){
  const world=createWorld(new THREE.Scene());
  const calls={floors:[],teleports:[],stairs:[],saves:0,closes:0};
  let options;
  const context={
    MISSIONS,world,state:{},pendingDestination:null,lastSpokenNPC:null,isBusy:false,
    player:{setFloor:floor=>calls.floors.push(floor),teleport:point=>calls.teleports.push({...point})},
    rest:{close:noop},learning:{close:noop},clearEncounter:noop,updateHUD:noop,
    audio:{play:noop},persist:()=>calls.saves++,closePanel:()=>calls.closes++,toast:noop,
    routeViaStairs:destination=>{calls.stairs.push({...destination});return false;},
    createSchoolMessenger:settings=>{options=settings;return {};},
    busy:()=>context.isBusy,exitYardSilently:noop
  };
  vm.createContext(context);
  vm.runInContext(['changeFloor','travelToMission','jumpToMission'].map(functionSource).join('\n')+'\n'+messengerSource,context);
  function reset(floor){
    context.state={floor,completed:[2,5],penalty:7,elapsed:123,bossDraft:'이어 쓰는 글',finished:false};
    context.pendingDestination={kind:'mission',id:1,floor:5,label:'예전 계단 경로'};
    context.isBusy=false;world.setFloor(floor);
    calls.floors.length=calls.teleports.length=calls.stairs.length=0;calls.saves=calls.closes=0;
  }
  return {context,calls,reset,locate:id=>options.onLocate(id)};
}

test('messenger locate instantly reaches every mission from every floor without a stair route or progress changes',()=>{
  const h=harness();
  for(let from=1;from<=5;from++)for(const mission of MISSIONS){
    h.reset(from);
    const before=structuredClone(h.context.state);
    h.locate(mission.id);
    const {state,world}=h.context,item=world.interactables.find(i=>i.missionId===mission.id);
    assert.ok(item,`mission ${mission.id} entry is on the active floor`);
    assert.equal(state.floor,mission.floor);assert.equal(world.floor,mission.floor);
    assert.deepEqual(h.calls.floors,from===mission.floor?[]:[mission.floor]);
    assert.equal(h.calls.teleports.length,1,'one direct arrival');
    const arrival=h.calls.teleports[0];
    assert.equal(arrival.y,item.y,'arrival stays on the mission floor');
    assert.ok(Math.hypot(arrival.x-item.x,arrival.z-item.z)<=2.3,'arrival remains within interaction range');
    assert.equal(pointBlocked(arrival,world.colliders,.35),false,'new room proportions leave a walkable arrival');
    assert.equal(h.calls.stairs.length,0,'messenger shortcut must not open the stair route');
    assert.equal(h.context.pendingDestination,null,'old stair destination is discarded');
    assert.deepEqual(state,{...before,floor:mission.floor},'navigation must not award, reset or penalize progress');
    assert.equal(h.calls.closes,1);
  }
});

test('invalid mission ids and a busy game leave position, progress and pending navigation untouched',()=>{
  const h=harness();
  for(const id of [0,11,-1,null,undefined,'1']){
    h.reset(3);const before=structuredClone(h.context.state),pending=h.context.pendingDestination;
    h.locate(id);
    assert.deepEqual(h.context.state,before);assert.equal(h.context.pendingDestination,pending);
    assert.deepEqual(h.calls,{floors:[],teleports:[],stairs:[],saves:0,closes:0});
  }
  h.reset(3);h.context.isBusy=true;
  const before=structuredClone(h.context.state),pending=h.context.pendingDestination;
  h.locate(1);
  assert.deepEqual(h.context.state,before);assert.equal(h.context.pendingDestination,pending);
  assert.deepEqual(h.calls,{floors:[],teleports:[],stairs:[],saves:0,closes:0});
});

test('ordinary map navigation still uses central stairs for a different floor',()=>{
  const h=harness();h.reset(1);
  h.context.travelToMission(1);
  assert.equal(h.context.state.floor,1);assert.equal(h.context.world.floor,1);
  assert.equal(h.calls.teleports.length,0);assert.equal(h.calls.floors.length,0);
  assert.deepEqual(h.calls.stairs,[{kind:'mission',id:1,label:MISSIONS[0].room,floor:5}]);
});
