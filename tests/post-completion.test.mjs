import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {freshState} from '../save.js';
import {freezeDeparture,departureState,actualPlaySeconds,advanceSchoolClock,schoolTime,overtimeMinutes,overtimeLabel} from '../school-clock.js';
import {createDocument} from './dom-stub.mjs';

const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} exists`);
  const next=source.indexOf('\nfunction ',start+1);
  return source.slice(start,next===-1?undefined:next);
}
const clone=value=>JSON.parse(JSON.stringify(value));
const forbidden=()=>{throw Error('Post-completion exploration must not restart missions or rankings');};

// Execute the real completion transitions. This verifies state boundaries;
// tests/visual-check.mjs separately exercises the real browser and 3D rendering.
function harness(){
  const document=createDocument();document.body=document.createElement('body');
  document.body.innerHTML='<div id="home"></div><div id="hud" hidden></div><div id="ending-caption"></div><div id="tutorial"></div><div id="social-bar" hidden></div><div id="app-overlay"></div>';
  const q=selector=>document.body.querySelector(selector),overlay=q('#app-overlay');
  const state={...freshState('쉬고 가는 교사'),completed:[1,2,3,4,5,6,7,8,9,10],finished:true,elapsed:1110,playElapsed:1110,penalty:5,bossDraft:'보존할 프롬프트'};
  freezeDeparture(state);
  const calls={floors:[],completed:[],gates:0,channels:0,rooms:[],beds:[],saves:0,downloads:[]};
  const context={
    state,document,overlay,$:q,mode:'certificate',certificateReturnPoint:null,pendingDestination:{floor:5},activeMission:10,tutorialTime:20,
    freezeDeparture,departureState,actualPlaySeconds,schoolTime,overtimeMinutes,overtimeLabel,
    teacher:{visible:false},
    world:{setFloor:floor=>calls.floors.push(floor),setCompleted:ids=>calls.completed.push([...ids]),openGate:()=>calls.gates++,reset:forbidden},
    player:{position:{x:4,y:8,z:3},yaw:1.2,active:false,setCameraMode(){},setFloor(floor){this.position={x:-5,y:(floor-1)*4,z:4.65};},teleport(point,{lookYaw}={}){this.position={...point};if(lookYaw!==undefined)this.yaw=lookYaw;},resetCamera(){},setActive(value){this.active=value;}},
    channels:{getSnapshot:()=>({connected:false}),start:()=>{calls.channels++;return Promise.resolve(false);}},
    honors:{startRun:forbidden,finish:forbidden},missions:{open:forbidden},arcade:{open:forbidden},
    rest:{close(){}},messenger:{suspend(){}},clearEncounter(){},updateHUD(){},
    closePanel(){overlay.hidden=true;overlay.innerHTML='';},
    showPanel(kind,html){context.overlayKind=kind;overlay.hidden=false;overlay.innerHTML=html;},
    onChannelChange(){q('#social-bar').hidden=context.mode!=='play';},
    persist:()=>calls.saves++,travelToRoom:id=>{calls.rooms.push(id);return true;},lieDown:id=>calls.beds.push(id),
    toast(){},home(){},newGame(){},copyPrompt(){},cardMarkup:()=>'',
    esc:value=>String(value),time:seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`,
    MISSIONS:[],MissionData:{},downloadCertificate:async value=>calls.downloads.push(clone(value))
  };
  vm.createContext(context);
  vm.runInContext(functionSource('showCertificate')+'\n'+functionSource('stayAtSchool'),context);
  return {context,calls,q,overlay};
}

test('staying after the certificate restores walking and channels without resetting completion or submitting another finish',async()=>{
  const h=harness(),before=clone(h.context.state);
  await h.context.stayAtSchool();
  assert.equal(h.context.mode,'play');assert.equal(h.context.teacher.visible,true);assert.equal(h.context.player.active,true);
  assert.equal(h.q('#hud').hidden,false);assert.equal(h.q('#home').hidden,true);assert.equal(h.q('#ending-caption').hidden,true);assert.equal(h.q('#tutorial').hidden,true);
  assert.equal(h.overlay.hidden,true);assert.equal(h.q('#social-bar').hidden,false);
  assert.equal(h.context.document.body.classList.contains('playing'),true);
  assert.equal(h.context.pendingDestination,null);assert.equal(h.context.activeMission,null);
  assert.equal(h.context.tutorialTime,0);assert.deepEqual(h.calls.floors,[1]);assert.equal(h.calls.gates,1);assert.equal(h.calls.channels,1);
  assert.deepEqual(clone(h.context.state),before,'completed missions, prompt, timings and frozen departure remain intact');
  assert.deepEqual(h.calls.completed,[before.completed]);
});

test('certificate nurse-room choice reopens the infirmary and a bed with the completed result intact',async()=>{
  const h=harness();h.context.state.floor=5;
  h.context.showCertificate();
  assert.ok(h.q('#end-stay'));assert.ok(h.q('#end-rest'));
  await h.q('#end-rest').onclick();
  assert.equal(h.context.mode,'play');assert.equal(h.context.state.floor,1);
  assert.deepEqual(h.calls.rooms,['nurse-room']);assert.deepEqual(h.calls.beds,['bed-1']);
  assert.equal(h.context.state.finished,true);assert.equal(h.context.state.completed.length,10);
  assert.equal(schoolTime(departureState(h.context.state)),'16:42');
});

test('reopening and downloading a certificate after more walking or rest retains the original result and returns to the current floor',async()=>{
  const h=harness();await h.context.stayAtSchool();
  h.context.state.floor=3;h.context.player.position={x:6,y:8,z:-2};h.context.player.yaw=.7;
  advanceSchoolClock(h.context.state,300);advanceSchoolClock(h.context.state,120,{resting:true});
  assert.equal(schoolTime(h.context.state),'16:53');
  h.context.showCertificate();
  assert.equal(h.context.mode,'certificate');assert.match(h.overlay.textContent,/16:42/);assert.match(h.overlay.textContent,/18:30/);
  assert.doesNotMatch(h.overlay.textContent,/16:53/);
  await h.q('#download-certificate').onclick();
  assert.equal(schoolTime(h.calls.downloads[0]),'16:42');assert.equal(actualPlaySeconds(h.calls.downloads[0]),1110);
  await h.q('#end-stay').onclick();
  assert.equal(h.context.mode,'play');assert.equal(h.context.state.floor,3);
  assert.deepEqual(clone(h.context.player.position),{x:6,y:8,z:-2});
  assert.equal(h.context.certificateReturnPoint,null);
  assert.equal(schoolTime(departureState(h.context.state)),'16:42');
});

test('unfinished games cannot use the stay transition to bypass the mission sequence',async()=>{
  const h=harness();h.context.state.finished=false;h.context.state.completed=[1,2];
  const before=clone(h.context.state);
  await h.context.stayAtSchool({nurseRoom:true});
  assert.equal(h.context.mode,'certificate');assert.deepEqual(clone(h.context.state),before);
  assert.deepEqual(h.calls.floors,[]);assert.equal(h.calls.channels,0);assert.deepEqual(h.calls.rooms,[]);
});
