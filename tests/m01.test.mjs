// State/input integration tests using real Three scene geometry and raycasts.
// Drawing alone is stubbed: browser QA covers texture rendering and layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {SoftwareRenderer} from '../software-renderer.js?v=20261106-immersive1';
import {start} from '../minigames/m01.js';
import {createDocument} from './dom-stub.mjs';

function fixture() {
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
  const answers = [true, false, true, false, true];
  const game = start({container, data: {arcade: {questions: answers.map((answer, i) => ({text: `연습 문장 ${i + 1}`, answer, tip: '정답 구역으로 이동해요.'}))}}, onWin: value => wins.push(value), onFail: value => fails.push(value)});
  console.error = originalError;
  const tick = seconds => {now += seconds * 1000; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now));};
  const advance = seconds => {for (let remaining = seconds; remaining > 1e-8;) {const delta = Math.min(.05, remaining); tick(delta); remaining -= delta;}};
  const find = selector => {const node = container.querySelector(selector); assert.ok(node, selector); return node;};
  tick(.01);
  const tapFloor = (x, z = 3.5) => {
    const pos = new THREE.Vector3(x, 0, z).project(renderedCamera);
    find('canvas').dispatch('pointerdown', {clientX: (pos.x + 1) * 600, clientY: (1 - pos.y) * 400});
  };
  return {
    game, doc, window: win, wins, fails, answers, container, tick, advance, find, tapFloor,
    get player() {return renderedScene.getObjectByName('m01-player');},
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

test('queued ready tap walks into O; wrong X retries same question; all five rounds award once', () => {
  const f = fixture();
  try {
    f.tapFloor(4); // Queue an intentionally wrong route during 준비.
    f.advance(2.5);
    assert.ok(f.player.position.x > 2, 'ready click must turn into walking after the answer window starts');
    f.advance(4.1);
    assert.equal(f.fails.length, 1); assert.equal(f.fails[0].reason, 'wrong-answer');
    f.advance(2.1);
    assert.match(f.find('.m01-round').textContent, /1\/5$/, 'failure must not skip the question');
    for (const [i, answer] of f.answers.entries()) {
      if (i % 2 === 0) {
        f.tapFloor(answer ? -4 : 4); // Real raycast from a pointer event.
        f.advance(6.6);
      } else {
        f.advance(1.5);
        const code = answer ? 'ArrowLeft' : 'ArrowRight';
        f.window.dispatch('keydown', {code}); f.advance(1.2); f.window.dispatch('keyup', {code}); f.advance(3.9);
      }
      f.advance(1.2);
    }
    assert.equal(f.wins.length, 1); assert.equal(f.wins[0].correct, 5); assert.equal(f.fails.length, 1);
    f.advance(100); assert.equal(f.wins.length, 1, 'extra frames cannot award a second completion');
  } finally {f.cleanup();}
});

test('wall-clock deadline survives a stalled frame and retry resets the full attempt', () => {
  const f = fixture();
  try {
    f.tick(91);
    assert.equal(f.fails.length, 1); assert.equal(f.fails[0].reason, 'timeout');
    assert.equal(f.find('.m01-retry').hidden, false);
    f.advance(10); assert.equal(f.fails.length, 1, 'timeout failure is emitted once');
    f.find('.m01-retry').dispatch('click'); f.advance(1);
    assert.equal(f.find('.m01-retry').hidden, true); assert.match(f.find('.m01-total').textContent, /89초/);
    assert.equal(f.wins.length, 0);
  } finally {f.cleanup();}
});

test('pause and hidden tab stop clocks and input; destroy is idempotent and removes handlers', () => {
  const f = fixture();
  try {
    f.advance(2); const time = f.find('.m01-total').textContent;
    f.game.pause(); f.window.dispatch('keydown', {code: 'ArrowLeft'}); f.advance(120);
    assert.equal(f.find('.m01-total').textContent, time); assert.equal(f.fails.length, 0); assert.equal(f.player.position.x, 0);
    f.game.resume(); f.doc.hidden = true; f.doc.dispatch('visibilitychange'); f.advance(120);
    assert.equal(f.find('.m01-total').textContent, time); assert.equal(f.fails.length, 0);
    f.doc.hidden = false; f.doc.dispatch('visibilitychange'); f.advance(.1);
    f.game.destroy(); f.game.destroy();
    assert.equal(f.pendingFrames, 0); assert.equal(f.listenerCount, 0); assert.equal(f.disposeCount, 1); assert.equal(f.container.children.length, 0);
  } finally {f.cleanup();}
});
