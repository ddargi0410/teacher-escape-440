import test from 'node:test';
import assert from 'node:assert/strict';
import {readVisualTestRoute,wantsSoftwareRenderer} from '../visual-test.js';

const location=url=>new URL(url);

test('visual QA requires HTTP loopback and the exact explicit test flag',()=>{
 for(const host of ['localhost','127.0.0.1','[::1]'])assert.equal(readVisualTestRoute(location(`http://${host}:8765/?test=1&mission=3`)).enabled,true);
 for(const url of ['file:///tmp/index.html?test=1&mission=3','http://localhost:8765/?mission=3','http://localhost:8765/?test=true&mission=3','http://localhost:8765/?test=0&mission=3'])assert.equal(readVisualTestRoute(location(url)).enabled,false);
});

test('every public and lookalike hostname ignores mission, ending and renderer shortcuts',()=>{
 for(const host of ['ddargi0410.github.io','teacher-escape-presence.hodumandu.chatgpt.site','localhost.example.com','127.0.0.1.example.com','terminal.local','192.168.1.10']){
  const url=location(`https://${host}/?test=1&mission=10&scene=ending&renderer=software`);
  assert.equal(readVisualTestRoute(url).enabled,false);
  assert.equal(readVisualTestRoute(url).mission,null);
  assert.equal(readVisualTestRoute(url).scene,'home');
  assert.equal(wantsSoftwareRenderer(url),false);
 }
});

test('local routes accept only finite mission and scene values',()=>{
 for(let id=1;id<=10;id++)assert.equal(readVisualTestRoute(location(`http://localhost/?test=1&mission=${id}`)).mission,id);
 for(const id of ['0','11','1.5','03','-1','Infinity','NaN','3x'])assert.equal(readVisualTestRoute(location(`http://localhost/?test=1&mission=${id}`)).mission,null);
 for(const scene of ['home','hub','rest','ending','certificate','classroom','research','office','copier','exterior'])assert.equal(readVisualTestRoute(location(`http://localhost/?test=1&scene=${scene}`)).scene,scene);
 assert.equal(readVisualTestRoute(location('http://localhost/?test=1&scene=anything')).scene,'home');
});

test('fallback and rest variants are explicit local options with safe defaults',()=>{
 const route=readVisualTestRoute(location('http://localhost/?test=1&scene=rest&bed=5&posture=side&renderer=software'));
 assert.deepEqual(route,{enabled:true,scene:'rest',mission:null,renderer:'software',bed:'bed-5',posture:'side',quality:'medium',clock:null});
 assert.equal(wantsSoftwareRenderer(location('http://localhost/?test=1&renderer=software')),true);
 assert.equal(wantsSoftwareRenderer(location('http://localhost/?renderer=software')),false);
 assert.equal(readVisualTestRoute(location('http://localhost/?test=1&bed=99&posture=invalid')).bed,'bed-4');
});


test('visual quality presets are finite and ignored outside explicit local QA',()=>{
 for(const quality of ['low','medium','high'])assert.equal(readVisualTestRoute(location(`http://localhost/?test=1&quality=${quality}`)).quality,quality);
 assert.equal(readVisualTestRoute(location('http://localhost/?test=1&quality=ultra')).quality,'medium');
 assert.equal(readVisualTestRoute(location('https://ddargi0410.github.io/?test=1&quality=low')).quality,'medium');
 assert.equal(readVisualTestRoute(location('http://localhost/?quality=low')).quality,'medium');
});

test('local daylight checks accept only school-clock times between 16:00 and 22:00',()=>{
 assert.equal(readVisualTestRoute(location('http://localhost/?test=1&clock=17:20')).clock,17*60+20);
 assert.equal(readVisualTestRoute(location('http://localhost/?test=1&clock=22:00')).clock,22*60);
 for(const value of ['15:59','22:01','7:00','17:60','abc',''])assert.equal(readVisualTestRoute(location(`http://localhost/?test=1&clock=${value}`)).clock,null);
 assert.equal(readVisualTestRoute(location('https://ddargi0410.github.io/?test=1&clock=21:00')).clock,null);
});
