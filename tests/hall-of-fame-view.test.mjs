import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createHallOfFameView, formatHallRecord, projectHallOfFameLabels, hallOfFameSceneReservations} from '../hall-of-fame-view.js';

function scene(width = 1366, height = 936, position = {x: 0, z: 9}) {
  const camera = new THREE.PerspectiveCamera(42, width / height, .1, 220);
  camera.position.set(position.x, .8 + Math.sin(.72) * 17.7, position.z + Math.cos(.72) * 17.7);
  camera.lookAt(position.x, .8, position.z);
  return {camera, width, height, position, floor: 1, visible: true,
    anchors: {fastest: new THREE.Vector3(-5.7, 4.25, 11.25), rest: new THREE.Vector3(5.7, 4.25, 11.25)}};
}

test('both entrance nameplates are readable inside viewport with no overlap', () => {
  const options = scene(), labels = projectHallOfFameLabels(options);
  assert.equal(labels.length, 2);
  for (const label of labels) {
    assert.ok(label.left >= 8 && label.left + label.width <= options.width - 8);
    assert.ok(label.top >= 128 && label.top + label.height <= options.height - 126);
  }
  assert.ok(Math.abs(labels[0].left - labels[1].left) > labels[0].width + 12);
});

test('plates never float through higher floors, interiors, hidden gameplay or offscreen camera', () => {
  const options = scene();
  for (const edit of [{floor: 2}, {floor: null}, {visible: false}, {position: {x: 0, z: -3}}, {position: {x: 23, z: 10}}])
    assert.deepEqual(projectHallOfFameLabels({...options, ...edit}), []);
  options.camera.lookAt(0, 13, 80);
  assert.deepEqual(projectHallOfFameLabels(options), []);
});

test('mobile shows the visible nearby statue without pinning the distant one to the screen', () => {
  const options = scene(390, 844, {x: -5, z: 6.5});
  const labels = projectHallOfFameLabels({...options, sizes: {fastest: {width: 245, height: 130}}});
  assert.equal(labels.length, 1);
  assert.equal(labels[0].kind, 'fastest');
  assert.equal(labels[0].width, 245);
  assert.ok(labels[0].top >= 156 && labels[0].top + labels[0].height <= 702);
});

test('a label moves below its anchor when its natural position would cover the top HUD', () => {
  const labels = projectHallOfFameLabels(scene(1366, 936, {x: 0, z: 13}));
  assert.equal(labels.length, 2);
  assert.ok(labels.every(label => label.side === 'below' && label.top >= 156));
});

test('nameplates steer around the floor selector while their pointers stay attached to the statue', () => {
  const reserved = {left: 1255, top: 205, width: 83, height: 310};
  const labels = projectHallOfFameLabels({...scene(), reservedRects: [reserved]});
  assert.equal(labels.length, 2);
  const right = labels.find(item => item.kind === 'rest');
  assert.ok(right.left + right.width <= reserved.left - 12);
  assert.ok(right.anchorX > right.left && right.anchorX < right.left + right.width);
});

test('large overlapping labels use another vertical slot or hide rather than covering each other', () => {
  const options = scene(); options.anchors.rest.copy(options.anchors.fastest);
  const labels = projectHallOfFameLabels({...options, sizes: {fastest: {width: 310, height: 235}, rest: {width: 310, height: 235}}});
  assert.ok(labels.length <= 1, 'when no safe slot fits, hiding preserves both statues');
});

test('full long-name plates fit above both front statues, and spawn labels avoid the player', () => {
  for (const position of [{x: 0, z: 9}, {x: -5, z: 6.5}]) {
    const options = {...scene(1363, 936, position), sizes: {fastest: {width: 310, height: 193}, rest: {width: 310, height: 193}}};
    const labels = projectHallOfFameLabels(options);
    assert.equal(labels.length, position.x === 0 ? 2 : 1);
    assert.ok(labels.every(label => label.side === 'above'));
    const protectedRects = hallOfFameSceneReservations(options);
    for (const label of labels) for (const reserved of protectedRects) {
      const intersects = label.left < reserved.left + reserved.width && label.left + label.width > reserved.left
        && label.top < reserved.top + reserved.height && label.top + label.height > reserved.top;
      assert.equal(intersects, false, 'neither player nor statue can be covered by the plate');
    }
  }
});

test('record formatting states game clock and accumulated real rest duration', () => {
  assert.equal(formatHallRecord('fastest', {schoolMinutes: 984, elapsedSeconds: 617.9}), '퇴근 16:24 · 플레이 10분 17초');
  assert.equal(formatHallRecord('rest', {restSeconds: 3723.9}), '오늘 누적 휴식 · 1시간 2분 3초');
  assert.equal(formatHallRecord('rest', null), '오늘의 첫 기록에 도전해 보세요');
  assert.equal(formatHallRecord('rest', {restSeconds: NaN}), '');
});

function createDOM() {
  let measurements = 0;
  class Element {
    constructor(tagName) { this.tagName = tagName; this.children = []; this.style = {setProperty: (key, value) => {this.style[key] = value;}}; this.dataset = {}; this.attributes = {}; this.hidden = false; this.textContent = ''; this.className = ''; this.classList = {toggle: (name, enabled) => { const values = new Set(this.className.split(' ')); enabled ? values.add(name) : values.delete(name); this.className = [...values].join(' '); }}; }
    append(...children) { for (const child of children) {child.parent = this; this.children.push(child);} }
    setAttribute(key, value) { this.attributes[key] = value; }
    getBoundingClientRect() { measurements++; return {width: 310, height: 164}; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    set innerHTML(value) { throw new Error('Untrusted names must never use HTML'); }
  }
  return {createElement: tagName => new Element(tagName), body: new Element('body'), get measurements() {return measurements;}};
}

test('nickname data stays literal text, empty/error records never fabricate winners, and disposal removes labels', t => {
  const oldDocument = globalThis.document, oldWidth = globalThis.innerWidth, oldHeight = globalThis.innerHeight;
  const document = createDOM(); globalThis.document = document; globalThis.innerWidth = 1366; globalThis.innerHeight = 936;
  t.after(() => {globalThis.document = oldDocument; globalThis.innerWidth = oldWidth; globalThis.innerHeight = oldHeight;});
  const options = scene(), world = {floor: 1, hallOfFameAnchors: options.anchors};
  const view = createHallOfFameView({camera: options.camera, world});
  const layer = document.body.children[0], [fastest, rest] = layer.children;
  view.setData({date: '2026-11-06', fastest: {nickname: '<퇴근>&"선생님', schoolMinutes: 984, elapsedSeconds: 617}, rest: null});
  assert.equal(fastest.children[2].textContent, '<퇴근>&"선생님');
  assert.equal(rest.children[2].textContent, '첫 주인공을 기다려요');
  view.update({visible: true, floor: 1, position: options.position});
  assert.equal(layer.hidden, false); assert.ok(layer.children.every(element => !element.hidden));
  assert.equal(document.measurements, 2);
  view.update({visible: true, floor: 1, position: options.position});
  assert.equal(document.measurements, 2, 'animation frames reuse measured plate dimensions');
  view.update({visible: true, floor: 1, position: {x: 0, z: -3}});
  assert.equal(document.measurements, 2, 'interior movement never unhides or measures the plates');
  view.setStatus('error');
  assert.equal(fastest.children[2].textContent, '잠시 후 다시 확인해요');
  assert.equal(fastest.children[0].textContent, '오늘의 가장 빠른 퇴근');
  view.update({visible: true, floor: 2, position: options.position});
  assert.equal(layer.hidden, true);
  view.dispose(); view.dispose();
  assert.equal(document.body.children.length, 0);
  assert.doesNotThrow(() => view.setData({}));
});
