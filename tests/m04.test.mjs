import * as THREE from '../vendor/three.module.js';
import {SoftwareRenderer} from '../software-renderer.js?v=20261106-immersive1';
import {createDocument} from './dom-stub.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {start,createLibraryState,resolveLibraryAction} from '../minigames/m04.js';

const books=Array.from({length:7},(_,i)=>({id:`stage-${i}`,label:`단계 ${i}`,trap:false})).concat({id:'trap',label:'한꺼번에 완성',trap:true});
const order=books.filter(b=>!b.trap).map(b=>b.id);
const apply=(s,action,id)=>resolveLibraryAction(s,action,id);

test('library completion requires seven books in sequence AND trap return, in either order',()=>{
  let state=createLibraryState(books,order);
  for(const id of order){state=apply(state,'pickup',id).state;const result=apply(state,'shelve');assert.equal(result.event,'shelved');state=result.state;assert.equal(state.complete,false);}
  state=apply(state,'pickup','trap').state;
  state=apply(state,'return').state;
  assert.equal(state.complete,true);assert.deepEqual(state.placed,order);
  assert.equal(apply(state,'pickup',order[0]).event,'ignored');
  state=createLibraryState(books,order);state=apply(state,'pickup','trap').state;state=apply(state,'return').state;
  for(const id of order){state=apply(state,'pickup',id).state;state=apply(state,'shelve').state;}
  assert.equal(state.complete,true);
});

test('wrong order ejects the held book without losing it or advancing progress',()=>{
  let state=createLibraryState(books,order);state=apply(state,'pickup',order[4]).state;
  const before=state;const result=apply(state,'shelve');state=result.state;
  assert.equal(result.event,'ejected');assert.equal(state.holding,null);assert.deepEqual(state.placed,[]);
  assert.equal(before.holding,order[4]);assert.equal(apply(state,'pickup',order[4]).event,'picked');
});

test('trap cannot go on shelf and good books cannot disappear into return bin',()=>{
  let state=createLibraryState(books,order);state=apply(state,'pickup','trap').state;
  let result=apply(state,'shelve');assert.equal(result.event,'ejected');assert.deepEqual(result.state.returned,[]);
  state=apply(result.state,'pickup',order[0]).state;result=apply(state,'return');assert.equal(result.event,'ejected');
  assert.equal(result.state.holding,null);assert.deepEqual(result.state.placed,[]);assert.equal(apply(result.state,'pickup',order[0]).event,'picked');
});

test('one book can be held, dropped and recovered; placed/returned/unknown books cannot be duplicated',()=>{
  let state=createLibraryState(books,order);assert.equal(apply(state,'pickup','missing').event,'ignored');
  state=apply(state,'pickup',order[0]).state;assert.equal(apply(state,'pickup',order[1]).event,'ignored');
  state=apply(state,'drop').state;assert.equal(state.holding,null);
  state=apply(state,'pickup',order[0]).state;state=apply(state,'shelve').state;
  assert.equal(apply(state,'pickup',order[0]).event,'ignored');
  state=apply(state,'pickup','trap').state;state=apply(state,'return').state;assert.equal(apply(state,'pickup','trap').event,'ignored');
});

test('malformed library content fails early instead of producing an unwinnable room',()=>{
  assert.throws(()=>createLibraryState(books,order.slice(1)),/seven/);
  assert.throws(()=>createLibraryState(books,[...order.slice(0,6),'trap']),/seven/);
  assert.throws(()=>createLibraryState(books,[...order.slice(0,6),order[0]]),/seven/);
  const state=createLibraryState(books,order);state.books[0].label='changed';assert.notEqual(books[0].label,'changed');
});

function fixture({initialTick=true}={}) {
  const previous = new Map();
  const assign = (name, value) => {previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, {configurable: true, writable: true, value});};
  const doc = createDocument(), listenerMaps = new Map();
  const emitter = target => {
    const listeners = new Map(); listenerMaps.set(target, listeners);
    target.addEventListener = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); };
    target.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn);
    target.dispatch = (type, props = {}) => { const event = {target, preventDefault() {}, stopPropagation() {}, ...props}; [...(listeners.get(type) || [])].forEach(fn => fn(event)); };
    return target;
  };
  emitter(doc);
  const proto = Object.getPrototypeOf(doc.createElement('div'));
  const oldDescriptors = new Map();
  const patch = (name, descriptor) => {oldDescriptors.set(name, Object.getOwnPropertyDescriptor(proto, name)); Object.defineProperty(proto, name, {configurable: true, ...('value' in descriptor ? {writable: true} : {}), ...descriptor});};
  patch('style', {get() { return this._style ||= {}; }});
  patch('className', {get() { return this.attrs.class || ''; }, set(value) { this.attrs.class = value; }});
  patch('appendChild', {value(node) {this.append(node); return node;}});
  const originalAppend=proto.append;patch('append',{value(...nodes){for(const node of nodes)originalAppend.call(this,typeof node==='string'?doc.createTextNode(node):node);}});
  patch('setAttribute', {value(name, value) {this.attrs[name] = String(value);}});
  patch('getAttribute', {value(name) {return this.attrs[name] ?? null;}});
  patch('remove', {value() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }});
  patch('getBoundingClientRect', {value() {return {left: 0, top: 0, width: 1200, height: 800};}});
  patch('addEventListener', {value(type, fn) { if (!listenerMaps.has(this)) emitter(this); this.addEventListener(type, fn); }});
  patch('removeEventListener', {value(type, fn) {listenerMaps.get(this)?.get(type)?.delete(fn);}});
  const drawing = {fillRect(){},strokeRect(){},fillText(){}};
  patch('getContext', {value(type) { return type === '2d' ? drawing : null; }});
  doc.createTextNode = text => {const node = doc.createElement('#text'); node._text = String(text); return node;};
  const win = emitter({});
  let now = 0, nextFrame = 1, renderCount = 0, disposeCount = 0, renderedScene, renderedCamera;
  const frames = new Map();
  assign('document', doc); assign('window', win); assign('performance', {now: () => now}); assign('devicePixelRatio', 1);
  assign('requestAnimationFrame', callback => {const id = nextFrame++; frames.set(id, callback); return id;});
  assign('cancelAnimationFrame', id => frames.delete(id)); assign('ResizeObserver', undefined);
  const realRender = SoftwareRenderer.prototype.render, realDispose = SoftwareRenderer.prototype.dispose;
  SoftwareRenderer.prototype.render = function(scene, camera) {renderCount++; scene.updateMatrixWorld(); camera.updateMatrixWorld(); renderedScene = scene; renderedCamera = camera;};
  SoftwareRenderer.prototype.dispose = function() {disposeCount++; realDispose.call(this);};
  const originalError = console.error; console.error = () => {};
  const container = doc.createElement('div'), wins = [], fails = [];
  const game = start({container, data: {arcade:{books,order,duration:90}}, onWin: value => wins.push(value), onFail: value => fails.push(value)});
  console.error = originalError;
  const tick = seconds => {now += seconds * 1000; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now));};
  const advance = seconds => {for (let remaining = seconds; remaining > 1e-8;) {const delta = Math.min(.05, remaining); tick(delta); remaining -= delta;}};
  const find = selector => {const node = container.querySelector(selector); assert.ok(node, selector); return node;};
  if(initialTick)tick(.01);
  const tapFloor = (x, z = 3.5) => {
    const pos = new THREE.Vector3(x, 0, z).project(renderedCamera);
    find('canvas').dispatch('pointerdown', {clientX: (pos.x + 1) * 600, clientY: (1 - pos.y) * 400});
  };
  return {
    game, doc, window: win, wins, fails, container, tick, advance, find, tapFloor,
    get player() {return renderedScene.getObjectByName('m04-player');},
    get pendingFrames() {return frames.size;},
    get listenerCount() {return [...listenerMaps.values()].reduce((sum, map) => sum + [...map.values()].reduce((n, set) => n + set.size, 0), 0);},
    get disposeCount() {return disposeCount;},
    cleanup() {
      game.destroy(); SoftwareRenderer.prototype.render = realRender; SoftwareRenderer.prototype.dispose = realDispose;
      for (const [name, descriptor] of oldDescriptors) descriptor ? Object.defineProperty(proto, name, descriptor) : delete proto[name];
      for (const [name, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name];
    }
  };
}


test('physical book routes can complete all seven slots and return trap; callbacks stay single',()=>{
  const f=fixture();
  try{
    const object=(kind,id)=>f.container.querySelectorAll('.m04-object').find(b=>b.dataset.libraryKind===kind&&(!id||b.dataset.bookId===id));
    for(const id of order){object('book',id).dispatch('click');f.advance(2.5);f.find('.m04-act').dispatch('click');assert.match(f.find('.m04-held').textContent,/들고 있는/);object('shelf').dispatch('click');f.advance(2.5);f.find('.m04-act').dispatch('click');}
    assert.match(f.find('.m04-progress').textContent,/7\/7/);assert.equal(f.wins.length,0);
    object('book','trap').dispatch('click');f.advance(2.5);f.find('.m04-act').dispatch('click');object('bin').dispatch('click');f.advance(2.5);f.find('.m04-act').dispatch('click');
    assert.equal(f.wins.length,1);assert.equal(f.wins[0].trapReturned,true);assert.equal(f.fails.length,0);
    f.advance(100);assert.equal(f.wins.length,1);
  }finally{f.cleanup();}
});

test('library pause stops time and inputs; timeout once then retry; dispose releases handlers and frame',()=>{
  const f=fixture();
  try{
    f.advance(1);const remaining=f.find('.m04-time').textContent;f.game.pause();f.window.dispatch('keydown',{code:'ArrowLeft'});f.advance(120);
    assert.equal(f.find('.m04-time').textContent,remaining);assert.equal(f.player.position.x,0);assert.equal(f.fails.length,0);
    f.game.resume();f.doc.hidden=true;f.doc.dispatch('visibilitychange');f.advance(120);assert.equal(f.fails.length,0);
    f.doc.hidden=false;f.doc.dispatch('visibilitychange');f.tick(91);assert.equal(f.fails.length,1);assert.equal(f.fails[0].reason,'timeout');f.advance(10);assert.equal(f.fails.length,1);
    f.find('.m04-retry').dispatch('click');f.advance(1);assert.equal(f.find('.m04-retry').hidden,true);assert.match(f.find('.m04-time').textContent,/89초/);
    f.game.destroy();f.game.destroy();assert.equal(f.pendingFrames,0);assert.equal(f.listenerCount,0);assert.equal(f.disposeCount,1);assert.equal(f.container.children.length,0);
  }finally{f.cleanup();}
});

test('tap-to-walk disables interaction until arrival and E cannot pick an incidental nearby book',()=>{
  const f=fixture();
  try{
    const targetBook=f.container.querySelectorAll('.m04-object').find(b=>b.dataset.bookId===order[0]);
    targetBook.dispatch('click');
    assert.equal(f.find('.m04-act').disabled,true);assert.equal(f.find('.m04-act').textContent,'이동 중…');
    f.window.dispatch('keydown',{code:'KeyE',repeat:false});f.advance(.3);
    f.find('.m04-act').dispatch('click');
    assert.doesNotMatch(f.find('.m04-held').textContent,/들고 있는/);
    f.advance(2.5);assert.equal(f.find('.m04-act').disabled,false);
    f.window.dispatch('keydown',{code:'KeyE',repeat:false});
    assert.match(f.find('.m04-held').textContent,/단계 0/);
  }finally{f.cleanup();}
});


test('initial book hit targets are projected from the current camera before the first animation frame',()=>{
  const f=fixture({initialTick:false});
  try{
    const book=f.container.querySelectorAll('.m04-object').find(b=>b.dataset.bookId===order[0]);
    const initial={left:book.style.left,top:book.style.top};
    f.tick(.01);
    assert.equal(book.style.left,initial.left);assert.equal(book.style.top,initial.top);
    assert.ok(parseFloat(initial.left)>600,'right-side book target must already be right of center');
  }finally{f.cleanup();}
});

test('low-frame-rate tap movement covers the same distance as smooth rendering',()=>{
  const positionAfter=steps=>{
    const f=fixture();
    try{
      f.container.querySelectorAll('.m04-object').find(b=>b.dataset.bookId===order[0]).dispatch('click');
      for(const seconds of steps)f.tick(seconds);
      return {x:f.player.position.x,z:f.player.position.z};
    }finally{f.cleanup();}
  };
  const oneFrame=positionAfter([1]);
  const tenFps=positionAfter(Array(10).fill(.1));
  const smooth=positionAfter(Array(50).fill(.02));
  assert.ok(Math.abs(Math.hypot(oneFrame.x,oneFrame.z-4.5)-5.4)<1e-8);
  for(const point of [tenFps,smooth]){assert.ok(Math.abs(point.x-oneFrame.x)<1e-8);assert.ok(Math.abs(point.z-oneFrame.z)<1e-8);}
});
