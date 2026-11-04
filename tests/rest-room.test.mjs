import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-stub.mjs';
import {createRestRoom} from '../rest-room.js';

const prototype=Object.getPrototypeOf(createDocument().createElement('div'));
Object.defineProperty(prototype,'className',{get(){return this.attrs.class||'';},set(v){this.attrs.class=String(v);}});
prototype.setAttribute=function(n,v){this.attrs[n]=String(v);};
prototype.addEventListener=function(n,fn){this.events??=new Map();if(!this.events.has(n))this.events.set(n,new Set());this.events.get(n).add(fn);};
prototype.removeEventListener=function(n,fn){this.events?.get(n)?.delete(fn);};
prototype.dispatch=function(n,event={}){for(const fn of this.events?.get(n)||[])fn({target:this,...event});};
prototype.click=function(){this.dispatch('click');};
prototype.contains=function(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;};
prototype.blur=function(){this.ownerDocument.activeElement=null;};
prototype.remove=function(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;};

function param(){return {value:0,calls:[],setValueAtTime(...v){this.calls.push(v);},linearRampToValueAtTime(...v){this.calls.push(v);},exponentialRampToValueAtTime(...v){this.calls.push(v);}};}
function context(){
  const nodes=[];
  function node(kind){const n={kind,gain:param(),frequency:param(),Q:param(),links:[],stopped:false,disconnected:false,
    connect(other){this.links.push(other);},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}};nodes.push(n);return n;}
  return {state:'running',sampleRate:8000,currentTime:0,destination:{kind:'destination'},nodes,
    createGain:()=>node('gain'),createOscillator:()=>node('oscillator'),createBufferSource:()=>node('buffer-source'),createBiquadFilter:()=>node('filter'),
    createBuffer:(channels,length,sampleRate)=>({sampleRate,getChannelData:()=>new Float32Array(length)})};
}
function fixture({defer=false}={}){
  const doc=createDocument();doc.body=doc.createElement('body');const events=new Map();
  doc.addEventListener=(n,fn)=>{if(!events.has(n))events.set(n,new Set());events.get(n).add(fn);};
  doc.removeEventListener=(n,fn)=>events.get(n)?.delete(fn);
  doc.dispatch=n=>{for(const fn of events.get(n)||[])fn();};globalThis.document=doc;
  const ctx=context();let unlocks=0,resolve;
  const pending=defer?new Promise(r=>{resolve=r;}):Promise.resolve(true);
  const audio={context:ctx,enabled:false,master:{kind:'effects-master'},unlock(){unlocks++;return pending;}};
  const entered=[],left=[],poses=[];const bed={id:'bed-1',bedPose:{x:1,y:.8,z:2},exitPoint:{x:3,y:0,z:2}};
  const rest=createRestRoom({audio,getBed:id=>id==='bed-1'?bed:null,onEnter:b=>entered.push(b),onLeave:b=>left.push(b),onPosture:(b,pose)=>poses.push({bed:b.id,pose})});
  const strip=doc.body.querySelector('.rest-room');
  return {rest,doc,ctx,audio,bed,entered,left,poses,strip,events,resolve,get unlocks(){return unlocks;},
    sound:value=>strip.querySelector(`[data-rest-sound="${value}"]`).click(),
    visible:flag=>{doc.hidden=!flag;doc.dispatch('visibilitychange');}};
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();};

test('lying down is optional, validates the bed, and never awards or forces an end',async()=>{
  const f=fixture();assert.equal(f.rest.open('missing'),false);assert.equal(f.unlocks,0);
  assert.equal(f.rest.open('bed-1'),true);assert.equal(f.rest.open('bed-1'),false);await settle();
  assert.equal(f.entered.length,1);assert.equal(f.strip.hidden,false);
  for(let n=0;n<120;n++)f.rest.update(1);
  assert.equal(f.rest.isOpen(),true);assert.equal(f.strip.querySelector('.rest-room-clock').textContent,'02:00');
  f.rest.close();f.rest.close();assert.deepEqual(f.left,[f.bed]);assert.equal(f.rest.isOpen(),false);
  f.rest.dispose();
});

test('rest sound follows the lying-down gesture independently of muted game effects',async()=>{
  const f=fixture();assert.equal(f.ctx.nodes.length,0);f.rest.open('bed-1');await settle();
  assert.equal(f.audio.enabled,false);assert.equal(f.unlocks,1);
  const output=f.ctx.nodes.find(n=>n.links.includes(f.ctx.destination));
  assert.ok(output);assert.equal(output.links.includes(f.audio.master),false);
  assert.ok(output.gain.calls.every(([value])=>value<=.08));
  assert.equal(f.ctx.nodes.filter(n=>n.kind==='buffer-source'&&n.loop).length,2);
  f.rest.dispose();assert.ok(f.ctx.nodes.every(n=>n.disconnected));
});

test('switching to moktak stops the forest and close removes all generated audio',async()=>{
  const f=fixture();f.rest.open('bed-1');await settle();const old=[...f.ctx.nodes];
  f.sound('moktak');await settle();
  assert.ok(old.every(n=>n.disconnected));
  assert.ok(old.filter(n=>n.started).every(n=>n.stopped));
  const moktak=f.ctx.nodes.slice(old.length);assert.equal(moktak.filter(n=>n.kind==='oscillator').length,3);
  assert.ok(moktak.filter(n=>n.started).every(n=>!n.loop));
  f.rest.close();assert.ok(f.ctx.nodes.filter(n=>n.started).every(n=>n.stopped));
  assert.ok(f.ctx.nodes.every(n=>n.disconnected));f.rest.dispose();
});

test('hidden tabs stop sound and time; muted rest does not resume audio',async()=>{
  const f=fixture();f.rest.open('bed-1');await settle();f.rest.update(1);
  f.visible(false);f.rest.update(100);assert.equal(f.strip.querySelector('.rest-room-clock').textContent,'00:01');
  assert.ok(f.ctx.nodes.filter(n=>n.started).every(n=>n.stopped));
  f.visible(true);await settle();assert.equal(f.unlocks,2);assert.equal(f.entered.length,1);
  f.rest.setMuted(true);const count=f.ctx.nodes.length;
  f.visible(false);f.visible(true);await settle();assert.equal(f.ctx.nodes.length,count);
  f.rest.setMuted(false);await settle();assert.ok(f.ctx.nodes.length>count);f.rest.dispose();
});

test('a late audio unlock cannot restart sound after leaving the bed',async()=>{
  const f=fixture({defer:true});f.rest.open('bed-1');f.rest.close();f.resolve(true);await settle();
  assert.equal(f.ctx.nodes.length,0);assert.equal(f.rest.isOpen(),false);assert.deepEqual(f.left,[f.bed]);f.rest.dispose();
});

test('disposing releases input and visibility handlers and is idempotent',async()=>{
  const f=fixture();f.rest.open('bed-1');await settle();let stopped=0;
  f.strip.dispatch('keydown',{key:'w',stopPropagation:()=>stopped++});f.strip.dispatch('keydown',{key:'Escape',stopPropagation:()=>stopped++});
  assert.equal(stopped,1);f.rest.dispose();f.rest.dispose();assert.equal(f.rest.isOpen(),false);
  assert.equal(f.events.get('visibilitychange').size,0);const n=f.unlocks;f.visible(false);f.visible(true);await settle();assert.equal(f.unlocks,n);
  assert.equal(f.rest.open('bed-1'),false);assert.equal(f.doc.body.querySelector('.rest-room'),null);
});


test('original gentle music can be selected and all notes stop on exit or hidden tab',async()=>{
  const f=fixture();f.rest.open('bed-1');await settle();f.sound('music');await settle();
  assert.match(f.strip.querySelector('.rest-room-status').textContent,/잔잔한 선율/);
  const active=f.ctx.nodes.filter(n=>n.kind==='oscillator'&&!n.disconnected);
  assert.equal(active.length,5,'two melodic tones and three soft chord tones');
  for(let n=0;n<5;n++)f.rest.update(1);
  assert.ok(f.ctx.nodes.filter(n=>n.kind==='oscillator').length>active.length);
  f.visible(false);assert.ok(f.ctx.nodes.filter(n=>n.started).every(n=>n.stopped));
  f.visible(true);await settle();f.rest.close();assert.ok(f.ctx.nodes.every(n=>n.disconnected));f.rest.dispose();
});

test('back and side choices notify the world without restarting the rest session',async()=>{
  const f=fixture();f.rest.open('bed-1');await settle();f.rest.update(1);
  f.strip.querySelector('[data-rest-pose="side"]').click();
  assert.equal(f.rest.getPosture(),'side');assert.deepEqual(f.poses,[{bed:'bed-1',pose:'side'}]);
  assert.equal(f.strip.querySelector('.rest-room-clock').textContent,'00:01');assert.equal(f.entered.length,1);
  f.strip.querySelector('[data-rest-pose="back"]').click();assert.equal(f.rest.getPosture(),'back');assert.equal(f.poses.length,2);f.rest.dispose();
});
