import * as THREE from './vendor/three.module.js';
import {FRUIT_STAGE, PAPER_COLORS, LIMITS, teacherTitle} from './community/core.js';

// A separate outdoor zone: a Korean primary-school playground with a coffee
// farm, a faucet and a zelkova guestbook. It lives far from the school
// (x + 400 m) and is drawn only while the teacher is outside, so school PCs
// never pay for both. Everything is procedural; no downloaded models.
export const YARD_ORIGIN = Object.freeze({x: 400, z: 0});
const O = YARD_ORIGIN;
const PLOT_ROWS = 30;
const plotZ = row => -21.6 + row * 1.8;
// Plot 0 is the first bed at the farm entrance; it always holds "my" tree.
export const YARD_LAYOUT = Object.freeze({
  arrival: Object.freeze({x: 0, z: -30, lookYaw: Math.PI}),
  exit: Object.freeze({x: 0, z: -33.2, halfWidth: 2.4, triggerZ: -32.75}),
  faucet: Object.freeze({x: -22, z: -27.8}),
  zelkova: Object.freeze({x: -9, z: -27.4}),
  farmSign: Object.freeze({x: -30, z: -25.2}),
  walkwayX: -30,
  podium: Object.freeze({x: 9, z: -27}),
  shed: Object.freeze({x: 29, z: -28.6}),
  bounds: Object.freeze({minX: -35.4, maxX: 36, minZ: -33.9, maxZ: 34.2}),
  plots: Object.freeze(Array.from({length: PLOT_ROWS * 2}, (_, index) => {
    const row = Math.floor(index / 2), east = index % 2 === 0;
    return Object.freeze({index, x: east ? -27.85 : -32.15, z: plotZ(row), side: east ? 'east' : 'west'});
  })),
});
const world = (x, z) => ({x: x + O.x, z: z + O.z});

/** Deterministic random numbers, so every visitor sees the same playground. */
function seeded(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function hashString(text) { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }

function mergeGeometries(entries) {
  const parts = entries.map(({geometry, matrix}) => { const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); if (matrix) g.applyMatrix4(matrix); return g; });
  const merged = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'uv']) {
    if (!parts.length || parts.some(g => !g.attributes[key])) continue;
    const size = parts[0].attributes[key].itemSize, total = parts.reduce((n, g) => n + g.attributes[key].array.length, 0);
    const array = new Float32Array(total); let offset = 0;
    for (const g of parts) { array.set(g.attributes[key].array, offset); offset += g.attributes[key].array.length; }
    merged.setAttribute(key, new THREE.BufferAttribute(array, size));
  }
  parts.forEach(g => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** Merge a static subtree by material: dozens of fence posts become one draw call. */
function batchStatic(parent, keep) {
  parent.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(parent.matrixWorld).invert(), batches = new Map();
  (function visit(node) {
    if (keep.has(node)) return;
    if (node.isMesh && !Array.isArray(node.material)) {
      const key = node.material.uuid;
      if (!batches.has(key)) batches.set(key, {material: node.material, entries: [], sources: [], shadow: node.castShadow});
      batches.get(key).entries.push({geometry: node.geometry, matrix: new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld)});
      batches.get(key).sources.push(node);
    }
    for (const child of [...node.children]) visit(child);
  })(parent);
  for (const {material, entries, sources, shadow} of batches.values()) {
    if (entries.length < 2) continue;
    const mesh = new THREE.Mesh(mergeGeometries(entries), material);
    mesh.castShadow = shadow && !material.transparent; mesh.receiveShadow = !material.transparent; mesh.name = 'yard-batch-' + (material.name || 'surface');
    parent.add(mesh);
    for (const source of sources) source.parent?.remove(source);
  }
}

function canvasTexture(width, height, draw, name, repeat) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.name = name;
  if (repeat) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeat); }
  return texture;
}

export function createPlayground({parent, helpers, surfaces}) {
  const {box, cyl, mesh, geo, mat, ball, sign} = helpers;
  const root = new THREE.Group(); root.name = '운동장'; root.position.set(O.x, 0, O.z); root.visible = false; parent.add(root);
  const scenery = new THREE.Group(); scenery.name = 'yard-scenery'; root.add(scenery);
  const dynamic = new THREE.Group(); dynamic.name = 'yard-dynamic'; root.add(dynamic);
  const keep = new Set();
  const colliders = [], cameraColliders = [], interactables = [];
  const collide = (x, z, w, d, sight = true, maxY = 3) => {
    const p = world(x, z); colliders.push({x: p.x, z: p.z, w, d, blocksSight: sight});
    if (sight) cameraColliders.push({x: p.x, z: p.z, w, d, minY: 0, maxY});
  };
  const interact = (item, x, z) => { const p = world(x, z); interactables.push({...item, x: p.x, y: 0, z: p.z, floor: 1, zone: 'yard'}); };
  // One material per surface and tiling, so each yard texture name maps to one texture.
  const surfaceCache = new Map();
  const surface = (kind, repeat) => {
    const id = `yard-${kind}-${repeat}`;
    if (surfaceCache.has(id)) return surfaceCache.get(id);
    const base = surfaces.material(kind), material = base.clone();
    material.map = base.map.clone(); material.map.repeat.set(repeat, repeat); material.map.name = id; material.map.needsUpdate = true; material.name = id;
    surfaceCache.set(id, material);
    return material;
  };
  const mark = (object, name) => { if (name) object.name = name; keep.add(object); return object; };
  // Dynamic parts get their own materials; world's mat() cache is shared with the school.
  const own = (color, options = {}) => new THREE.MeshStandardMaterial({color, roughness: .88, metalness: 0, ...options});

  // --- Ground, track and field lines ------------------------------------
  const outer = box(scenery, 0, -.62, 8, 240, 1.2, 240, '#8fa585'); outer.name = 'yard-outer-ground';
  const field = mesh(scenery, geo('BoxGeometry', 73, .2, 69), surface('sand', 22), 0, -.09, 0); field.name = 'yard-masato-ground';
  const line = mat('#f7f4ea', {roughness: 1});
  const strip = (x, z, w, d, angle = 0) => { const o = mesh(scenery, geo('PlaneGeometry', w, d), line, x, .025, z, false); o.rotation.x = -Math.PI / 2; o.rotation.z = angle; o.receiveShadow = true; return o; };
  const half = 11;
  for (const radius of [9.5, 10.7, 11.9, 13.1]) {
    for (const side of [-1, 1]) strip(0, side * radius, half * 2, .1);
    for (const [cx, start] of [[half, -Math.PI / 2], [-half, Math.PI / 2]]) {
      const ring = mesh(scenery, new THREE.RingGeometry(radius - .05, radius + .05, 40, 1, start, Math.PI), line, cx, .025, 0, false);
      ring.rotation.x = -Math.PI / 2; ring.receiveShadow = true;
    }
  }
  strip(-3, 11.3, .14, 3.7);
  strip(0, 0, .1, 18); // halfway line
  const circle = mesh(scenery, new THREE.RingGeometry(2.9, 3, 36), line, 0, .025, 0, false); circle.rotation.x = -Math.PI / 2;
  for (const side of [-1, 1]) { strip(side * 16.1, 0, .1, 9); strip(side * 17.2, 4.5, 2.2, .1); strip(side * 17.2, -4.5, 2.2, .1); }

  // --- Soccer goals --------------------------------------------------------
  const netTexture = canvasTexture(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; for (let i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } }, 'yard-goal-net', [4, 2]);
  const netMaterial = new THREE.MeshStandardMaterial({map: netTexture, transparent: true, alphaTest: .35, side: THREE.DoubleSide, roughness: 1}); netMaterial.name = 'yard-net';
  for (const side of [-1, 1]) {
    const x = side * 17.6, back = x + side * 1.3;
    for (const z of [-2.5, 2.5]) { cyl(scenery, x, 1.05, z, .07, .07, 2.1, '#fbfbf6', 8); cyl(scenery, back, .55, z, .05, .05, 1.1, '#e2e2dc', 6); collide(x, z, .2, .2, false); }
    const bar = cyl(scenery, x, 2.1, 0, .07, .07, 5.14, '#fbfbf6', 8); bar.rotation.x = Math.PI / 2;
    const net = mesh(scenery, geo('PlaneGeometry', 5, 2.1), netMaterial, back, 1.05, 0, false); net.rotation.y = Math.PI / 2;
    const top = mesh(scenery, geo('PlaneGeometry', 1.3, 5), netMaterial, (x + back) / 2, 2.0, 0, false); top.rotation.x = -Math.PI / 2;
  }

  // --- School building behind the 중앙현관 (backdrop, not walkable) --------
  const facadeTexture = canvasTexture(1024, 680, (c, w, h) => {
    c.fillStyle = '#efe9dc'; c.fillRect(0, 0, w, h);
    const bands = ['#a58fe0', '#6fb7e8', '#f28ca6', '#f29a5c', '#f6c445'];
    for (let floor = 0; floor < 5; floor++) {
      const y = 20 + floor * 128;
      c.fillStyle = bands[floor]; c.fillRect(0, y + 92, w, 26);
      for (let i = 0; i < 12; i++) {
        const x = 18 + i * 84; if (floor === 4 && i >= 5 && i <= 6) continue;
        c.fillStyle = '#e4e7ea'; c.fillRect(x - 3, y + 14, 72, 70);
        c.fillStyle = ['#9fc3dc', '#a9cbe2', '#93b9d4'][(i + floor) % 3]; c.fillRect(x, y + 17, 66, 64);
        c.fillStyle = '#f4f5f6'; c.fillRect(x + 31, y + 17, 4, 64); c.fillRect(x, y + 47, 66, 3);
      }
    }
    c.fillStyle = '#3a6fb0'; c.fillRect(330, 0, 364, 18);
  }, 'yard-school-facade');
  const facadeMaterial = new THREE.MeshStandardMaterial({map: facadeTexture, roughness: .9}); facadeMaterial.name = 'yard-school-facade';
  box(scenery, 0, 10.2, -39, 32, 20.4, 5.6, '#efe9dc');
  const facade = mesh(scenery, geo('PlaneGeometry', 31.6, 20.4), facadeMaterial, 0, 10.2, -36.18, false); facade.name = 'yard-school-front';
  box(scenery, 0, 21, -39, 32.6, 1.2, 6.2, '#e7e1d2');
  box(scenery, -.8, 22.1, -36.3, 15, 1.9, .5, '#3a6fb0');
  sign(scenery, '퇴근초등학교', -.8, 22.1, -36.02, 10.5, 1.25, '#ffffff', '#3a6fb0');
  for (const side of [-1, 1]) {
    box(scenery, side * 22, 2, -39, 12, 4, 6, side < 0 ? '#f6d27a' : '#d6e9f5');
    box(scenery, side * 22, 4.12, -39, 12.4, .24, 6.4, '#e7e1d2');
    for (const dx of [-3, 3]) { box(scenery, side * 22 + dx, 2, -35.97, 2.8, 1.6, .06, '#ffffff'); box(scenery, side * 22 + dx, 2, -35.92, 2.6, 1.4, .04, '#bfe0f5'); }
    sign(scenery, side < 0 ? '배움터' : '보건실', side * 22, 3.35, -35.9, 3, .5, '#2f3e5c', '#fff4dc');
  }
  // 중앙현관: canopy, glass doors and the way back inside.
  box(scenery, 0, 3.15, -34.6, 7.2, .22, 3.2, '#3a6fb0');
  for (const x of [-3.35, 3.35]) { box(scenery, x, 1.55, -33.25, .18, 3.1, .18, '#e9e6df'); collide(x, -33.25, .3, .3, true, 3.2); }
  for (const x of [-1.85, 1.85]) box(scenery, x, 1.25, -35.94, 1.7, 2.5, .06, '#5f7f99');
  box(scenery, 0, 2.62, -35.92, 3.9, .25, .08, '#e9e6df');
  const exitSign = sign(scenery, '↩ 중앙현관 · 학교 안으로', 0, 2.82, -33.05, 4.6, .55, '#ffffff', '#2c956c'); exitSign.name = 'yard-exit-sign';
  const doorMat = mesh(scenery, geo('PlaneGeometry', 4, 1.6), mat('#8a929c'), 0, .03, -34.3, false); doorMat.rotation.x = -Math.PI / 2;
  collide(0, -36.1, 54, .5, true, 21); collide(-22, -39, 12, 6, true, 4.2); collide(22, -39, 12, 6, true, 4.2);
  interact({id: 'yard-exit', kind: 'yard-exit', label: '중앙현관 · 학교 안으로 돌아가기'}, 0, -32.2);

  // --- 구령대와 국기 게양대 --------------------------------------------------
  const P = YARD_LAYOUT.podium;
  box(scenery, P.x, .55, P.z, 8, 1.1, 3.6, '#cfcac0');
  box(scenery, P.x, 1.13, P.z, 8.1, .06, 3.7, '#e1ddd4');
  for (let step = 0; step < 3; step++) box(scenery, P.x, .18 + step * .36, P.z + 2.25 - step * .3, 3.2, .36, .6, '#d8d3ca');
  box(scenery, P.x, 2.4, P.z - 1.75, 8, 2.5, .25, '#e8e2d4');
  sign(scenery, '오늘도 무사히 퇴근', P.x, 2.6, P.z - 1.6, 5.4, .62, '#fff8ec', '#3a6fb0');
  for (const dx of [-3.8, 3.8]) cyl(scenery, P.x + dx, 2.4, P.z - 1.4, .09, .09, 2.6, '#e9e6df', 8);
  box(scenery, P.x, 3.78, P.z - .3, 8.6, .18, 3.2, '#3a6fb0');
  collide(P.x, P.z, 8.2, 3.8, true, 2.2);
  const flags = [];
  for (const [index, dx] of [-2.6, 0, 2.6].entries()) {
    const height = index === 1 ? 9 : 8;
    cyl(scenery, P.x + dx, height / 2, P.z - 3.3, .06, .07, height, '#f1efe9', 8);
    ball(scenery, P.x + dx, height + .08, P.z - 3.3, .12, '#d9b447');
    const flagGroup = mark(new THREE.Group(), 'yard-flag'); flagGroup.position.set(P.x + dx + .05, height - .55, P.z - 3.3); root.add(flagGroup);
    const colors = [['#fffaf0', '#3a6fb0', '배움'], ['#ffffff', '#2c956c', '퇴근초'], ['#fffaf0', '#e0703f', '쉼']][index];
    const cloth = mesh(flagGroup, geo('PlaneGeometry', 1.5, .95), new THREE.MeshBasicMaterial({map: canvasTexture(256, 160, (c, w, h) => { c.fillStyle = colors[0]; c.fillRect(0, 0, w, h); c.fillStyle = colors[1]; c.fillRect(0, h - 26, w, 26); c.font = '800 54px "Noto Sans KR", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(colors[2], w / 2, h / 2 - 10); }, 'yard-flag-cloth-' + index), side: THREE.DoubleSide}), .75, 0, 0, false);
    cloth.name = 'yard-flag-cloth'; flags.push(flagGroup);
    collide(P.x + dx, P.z - 3.3, .25, .25, false);
  }
  interact({id: 'yard-podium', kind: 'podium', label: '구령대 · 한마디 하기'}, P.x, P.z + 2.9);

  // --- 수돗가 ---------------------------------------------------------------
  const F = YARD_LAYOUT.faucet, concrete = surface('concrete', 2);
  mesh(scenery, geo('BoxGeometry', 6.4, .78, 1.1), concrete, F.x, .39, F.z);
  box(scenery, F.x, .7, F.z + .02, 6, .14, .82, '#9fa5a8');
  mesh(scenery, geo('BoxGeometry', 6.4, 1.5, .22), concrete, F.x, 1.5, F.z - .62);
  cyl(scenery, F.x, 1.42, F.z - .44, .05, .05, 6.2, '#c4ccd2', 8).rotation.z = Math.PI / 2;
  const tap = mat('#dfe6eb', {metalness: .75, roughness: .22});
  for (let i = 0; i < 6; i++) {
    const x = F.x - 2.5 + i;
    mesh(scenery, geo('CylinderGeometry', .045, .045, .22, 8), tap, x, 1.33, F.z - .36).rotation.x = Math.PI / 2;
    mesh(scenery, geo('CylinderGeometry', .035, .03, .16, 8), tap, x, 1.22, F.z - .25);
    mesh(scenery, geo('BoxGeometry', .14, .05, .05), tap, x, 1.45, F.z - .33);
  }
  sign(scenery, '수돗가 · 오늘의 퀴즈 맞히고 물 받기', F.x, 2.55, F.z - .5, 4.8, .5, '#2f3e5c', '#fff4dc');
  for (const dx of [-2.4, 2.4]) box(scenery, F.x + dx, 1.65, F.z - .55, .1, 1.9, .1, '#8a929c');
  const water = mark(mesh(dynamic, geo('CylinderGeometry', .025, .045, .5, 8), new THREE.MeshStandardMaterial({color: '#bfe3ff', transparent: true, opacity: .75, roughness: .1}), F.x + .5, .98, F.z - .25, false), 'yard-faucet-water');
  water.visible = false;
  collide(F.x, F.z - .2, 6.6, 1.5, false);
  interact({id: 'yard-faucet', kind: 'faucet', label: '수돗가 · 오늘의 바이브 코딩 퀴즈'}, F.x, F.z + 1.5);

  // --- 느티나무와 벤치 -------------------------------------------------------
  const Z = YARD_LAYOUT.zelkova;
  const zelkova = mark(new THREE.Group(), 'yard-zelkova'); zelkova.position.set(Z.x, 0, Z.z); root.add(zelkova);
  const bark = own('#7a5b43', {roughness: .95}), leafy = ['#5f8f4f', '#6f9d58', '#55834a', '#7aa760'].map(color => own(color, {roughness: .92}));
  mesh(zelkova, geo('CylinderGeometry', .48, .72, 3.6, 12), bark, 0, 1.8, 0);
  const branchSpec = [[0, .9], [1.25, .7], [2.5, .85], [3.8, .75], [5.0, .8]];
  for (const [angle, tilt] of branchSpec) {
    const branch = mesh(zelkova, geo('CylinderGeometry', .14, .26, 3.4, 8), bark, Math.sin(angle) * 1.2, 4.3, Math.cos(angle) * 1.2);
    branch.rotation.set(Math.cos(angle) * tilt, 0, -Math.sin(angle) * tilt);
  }
  const crown = seeded(814);
  for (let i = 0; i < 16; i++) {
    const a = crown() * Math.PI * 2, r = 1.2 + crown() * 3.4, y = 5.4 + crown() * 2.6;
    const blob = mesh(zelkova, geo('IcosahedronGeometry', 1.6 + crown() * .9, 1), leafy[i % 4], Math.cos(a) * r, y, Math.sin(a) * r);
    blob.scale.set(1.2, .72, 1.2);
  }
  mesh(zelkova, geo('CylinderGeometry', 2.1, 2.1, .12, 20), own('#8c7a62'), 0, .06, 0, false);
  const notesGroup = mark(new THREE.Group(), 'yard-zelkova-notes'); zelkova.add(notesGroup);
  const lightsGroup = mark(new THREE.Group(), 'yard-zelkova-lights'); lightsGroup.visible = false; zelkova.add(lightsGroup);
  collide(Z.x, Z.z, 1.5, 1.5, true, 4);
  const benchAt = (x, z, rot) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scenery.add(g);
    for (let j = 0; j < 3; j++) box(g, 0, .48, -.2 + j * .2, 2.4, .08, .16, '#b07d55');
    for (let j = 0; j < 2; j++) box(g, 0, .82 + j * .2, -.34, 2.4, .12, .07, '#b07d55');
    for (const dx of [-.95, .95]) box(g, dx, .24, 0, .1, .48, .7, '#4b6f99');
  };
  benchAt(Z.x + 3.6, Z.z + .4, Math.PI / 2 + Math.PI); collide(Z.x + 3.6, Z.z + .4, .8, 2.5, false);
  benchAt(Z.x - 3.6, Z.z + .4, Math.PI / 2); collide(Z.x - 3.6, Z.z + .4, .8, 2.5, false);
  // Hung above head height so the walking teacher never hides it.
  sign(scenery, '느티나무 쪽지 방명록', Z.x, 2.3, Z.z + 2.35, 2.6, .42, '#2f3e5c', '#fff4dc');
  box(scenery, Z.x, 1.04, Z.z + 2.3, .08, 2.08, .08, '#6d5a4a');
  interact({id: 'yard-zelkova', kind: 'zelkova', label: '느티나무 · 쪽지 걸기와 읽기'}, Z.x, Z.z + 3.4);

  // --- 생태 밭 ---------------------------------------------------------------
  const soil = surface('soil', 1);
  const fenceWood = mat('#b98a5c', {roughness: .9});
  const farmTop = -23.4, farmBottom = plotZ(PLOT_ROWS - 1) + 1.4, farmLength = farmBottom - farmTop, farmMid = (farmTop + farmBottom) / 2;
  for (const x of [-25.95, -34.05]) {
    for (let z = farmTop; z <= farmBottom + .01; z += 2.2) mesh(scenery, geo('BoxGeometry', .1, .72, .1), fenceWood, x, .36, z);
    for (const y of [.3, .6]) mesh(scenery, geo('BoxGeometry', .05, .07, farmLength), fenceWood, x, y, farmMid);
    collide(x, farmMid, .2, farmLength, false);
  }
  for (const side of ['east', 'west']) {
    const x = side === 'east' ? -27.85 : -32.15;
    mesh(scenery, geo('BoxGeometry', 1.7, .12, farmLength), mat('#6d4c33'), x, .06, farmMid);
    collide(x, farmMid, 1.55, farmLength, false);
  }
  for (const plot of YARD_LAYOUT.plots) {
    const bed = mesh(scenery, geo('BoxGeometry', 1.42, .16, 1.42), soil, plot.x, .12, plot.z); bed.name = 'yard-plot-soil';
    const stakeX = plot.x + (plot.side === 'east' ? -.78 : .78);
    box(scenery, stakeX, .26, plot.z + .52, .05, .52, .05, '#a77f59');
  }
  const walkway = mesh(scenery, geo('BoxGeometry', 2.4, .04, farmLength + 1.2), surface('concrete', 3), -30, .02, farmMid, false); walkway.name = 'yard-farm-walkway';
  // Entrance signs face the school side, where everyone arrives from.
  sign(scenery, '생태 밭 · 우리들의 커피나무', -30, 2.15, farmTop - .3, 3.8, .55, '#ffffff', '#2c956c').rotation.y = Math.PI;
  for (const dx of [-1.85, 1.85]) box(scenery, -30 + dx, 1.25, farmTop - .25, .1, 2.5, .1, '#6d5a4a');
  sign(scenery, '물은 하루 한 번 · 수돗가에서', -30, 1.62, farmTop - .3, 3.1, .34, '#2f3e5c', '#fff4dc').rotation.y = Math.PI;
  interact({id: 'yard-farm', kind: 'farm', label: '생태 밭 · 내 커피나무와 나무 찾기'}, -30, farmTop - 1.4);

  // --- 계단식 스탠드, 철봉, 놀이터, 체육 창고 --------------------------------------
  const standConcrete = surface('concrete', 4);
  for (let tier = 0; tier < 4; tier++) {
    mesh(scenery, geo('BoxGeometry', 1.25, .46 * (tier + 1), 30), standConcrete, 29.7 + tier * 1.25, .23 * (tier + 1), 0);
    box(scenery, 29.25 + tier * 1.25, .46 * (tier + 1) + .02, 0, .36, .05, 30, tier % 2 ? '#3a6fb0' : '#e0703f');
  }
  collide(31.6, 0, 5.1, 30.2, true, 1.9);
  for (const [index, height] of [1.25, 1.55, 1.85].entries()) {
    const x = 31.5, z = 21 + index * 1.7;
    for (const dz of [-.75, .75]) cyl(scenery, x, height / 2, z + dz, .06, .06, height, '#5b7fa8', 8);
    cyl(scenery, x, height, z, .03, .03, 1.5, '#d7dde2', 8).rotation.x = Math.PI / 2;
    collide(x, z, .3, 1.7, false);
  }
  const mat2 = mesh(scenery, geo('BoxGeometry', 14, .06, 9), surface('rubber', 3), 19, .03, 27, false); mat2.name = 'yard-play-mat';
  // Swing set.
  const swings = [];
  for (const dz of [-1.7, 1.7]) for (const side of [-1, 1]) { const leg = cyl(scenery, 14.6 + side * .5, 1.22, 27 + dz, .06, .06, 2.5, '#e0703f', 8); leg.rotation.z = side * .2; }
  cyl(scenery, 14.6, 2.45, 27, .07, .07, 3.6, '#e0703f', 8).rotation.x = Math.PI / 2;
  for (const dz of [-.75, .75]) {
    const swing = mark(new THREE.Group(), 'yard-swing'); swing.position.set(14.6, 2.42, 27 + dz); root.add(swing);
    for (const dz2 of [-.22, .22]) mesh(swing, geo('CylinderGeometry', .012, .012, 1.9, 4), own('#8a929c'), 0, -.95, dz2, false);
    mesh(swing, geo('BoxGeometry', .24, .05, .55), own('#3a6fb0'), 0, -1.9, 0);
    swings.push(swing);
  }
  collide(14.6, 27, 1.4, 3.6, false);
  // Slide.
  box(scenery, 22, 1.6, 25.6, 1.7, .14, 1.7, '#f6c445');
  for (const dx of [-.75, .75]) for (const dz of [-.75, .75]) box(scenery, 22 + dx, .8, 25.6 + dz, .1, 1.6, .1, '#3a6fb0');
  for (let i = 0; i < 5; i++) box(scenery, 22, .3 + i * .3, 24.55, .9, .05, .1, '#3a6fb0');
  const slide = box(scenery, 22, .95, 27.9, 1, .08, 3.2, '#2c956c'); slide.rotation.x = .5;
  for (const dx of [-.52, .52]) { const rail = box(scenery, 22 + dx, 1.12, 27.9, .06, .22, 3.2, '#2c956c'); rail.rotation.x = .5; }
  collide(22, 26.4, 1.9, 4.4, false);
  // Equipment shed.
  const S = YARD_LAYOUT.shed;
  box(scenery, S.x, 1.6, S.z, 6, 3.2, 4, '#dcd6c8');
  box(scenery, S.x, 3.3, S.z, 6.5, .22, 4.5, '#5b7fa8');
  const shutter = canvasTexture(256, 192, (c, w, h) => { c.fillStyle = '#9aa7b4'; c.fillRect(0, 0, w, h); c.fillStyle = '#7f8c99'; for (let y = 0; y < h; y += 12) c.fillRect(0, y, w, 4); }, 'yard-shed-shutter');
  mesh(scenery, geo('PlaneGeometry', 3.4, 2.4), new THREE.MeshStandardMaterial({map: shutter, roughness: .7}), S.x, 1.22, S.z + 2.01, false);
  sign(scenery, '체육 창고', S.x, 2.75, S.z + 2.03, 2.2, .45, '#ffffff', '#5b7fa8');
  collide(S.x, S.z, 6.2, 4.2, true, 3.4);
  interact({id: 'yard-shed', kind: 'shed', label: '체육 창고 · 살짝 들여다보기'}, S.x, S.z + 3.1);

  // --- Trees, fences, lights around the edge --------------------------------
  const edgeTree = (x, z, s = 1) => {
    cyl(scenery, x, 1.9 * s, z, .2 * s, .3 * s, 3.8 * s, '#8e6c4d', 8);
    ball(scenery, x, 4.5 * s, z, 1.9 * s, '#6f9b66', [1, 1.05, 1]);
    ball(scenery, x - .9 * s, 3.9 * s, z + .3 * s, 1.3 * s, '#84ad73');
    ball(scenery, x + .7 * s, 5.1 * s, z - .2 * s, 1.4 * s, '#9fbe82');
    collide(x, z, .6 * s, .6 * s, false);
  };
  for (const x of [-20, -12, -4, 4, 10]) edgeTree(x, 32.6, .95 + (Math.abs(x) % 3) * .05);
  for (const z of [-22, 19, 27]) edgeTree(35.2, z, 1);
  for (const z of [-14, 2, 18, 30]) edgeTree(-35.2, z, .9);
  const meshFence = canvasTexture(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#3f7a50'; c.lineWidth = 4; for (let i = -w; i < w * 2; i += 22) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); } }, 'yard-fence-mesh', [1, 1]);
  const fenceMaterial = new THREE.MeshStandardMaterial({map: meshFence, transparent: true, alphaTest: .4, side: THREE.DoubleSide, roughness: .8}); fenceMaterial.name = 'yard-fence';
  const fenceMaterials = new Map();
  const fenceFor = length => {
    const id = 'yard-fence-mesh-' + Math.round(length * 10);
    if (!fenceMaterials.has(id)) {
      const texture = meshFence.clone(); texture.name = id; texture.repeat.set(length / 1.4, 1.6); texture.needsUpdate = true;
      const material = fenceMaterial.clone(); material.map = texture; fenceMaterials.set(id, material);
    }
    return fenceMaterials.get(id);
  };
  const fence = (x, z, length, along) => {
    const material = fenceFor(length);
    const panel = mesh(scenery, geo('PlaneGeometry', length, 2.3), material, x, 1.15, z, false); if (along === 'z') panel.rotation.y = Math.PI / 2;
    for (let t = -length / 2; t <= length / 2 + .01; t += 3) cyl(scenery, along === 'z' ? x : x + t, 1.2, along === 'z' ? z + t : z, .05, .05, 2.4, '#2f5d42', 6);
    collide(x, z, along === 'z' ? .3 : length, along === 'z' ? length : .3, true, 2.4);
  };
  fence(0, 34.9, 73, 'x'); fence(36.6, -.5, 70.8, 'z'); fence(-36.4, -.5, 70.8, 'z');
  const floodHeads = [];
  for (const [x, z] of [[-34.6, -33], [34.6, -33], [-34.6, 33.4], [34.6, 33.4]]) {
    cyl(scenery, x, 6, z, .14, .2, 12, '#9aa3ad', 8);
    const head = mark(new THREE.Group(), 'yard-floodlight'); head.position.set(x, 12, z); root.add(head);
    head.rotation.order = 'YXZ'; head.rotation.y = Math.atan2(-x, -z); head.rotation.x = .38;
    mesh(head, geo('BoxGeometry', 2.2, 1.2, .3), own('#3f4a5c'), 0, 0, 0);
    const glow = mesh(head, geo('PlaneGeometry', 2, 1), new THREE.MeshBasicMaterial({color: '#e9e4d6'}), 0, 0, .16, false); glow.name = 'yard-floodlight-face';
    floodHeads.push(glow);
  }
  const lampPools = [];
  for (const [x, z, r] of [[Z.x + 2.5, Z.z + 3.5, 5], [F.x, F.z + 2, 3.2], [-30, farmTop - 1, 3.4], [0, -31, 3.4]]) {
    const pool = mark(mesh(dynamic, geo('CircleGeometry', r, 24), new THREE.MeshBasicMaterial({color: '#ffd98a', transparent: true, opacity: 0, depthWrite: false}), x, .06, z, false), 'yard-lamp-glow');
    pool.rotation.x = -Math.PI / 2; pool.visible = false; lampPools.push(pool);
  }
  // Field floodlights spill wide, soft light on the sand after dark.
  for (const [x, z] of [[-13, -11], [13, -11], [-13, 12], [13, 12]]) {
    const pool = mark(mesh(dynamic, geo('CircleGeometry', 13, 32), new THREE.MeshBasicMaterial({color: '#fff1cf', transparent: true, opacity: 0, depthWrite: false}), x, .05, z, false), 'yard-flood-glow');
    pool.rotation.x = -Math.PI / 2; pool.visible = false; lampPools.push(pool);
  }
  const lampBulbs = [];
  for (const [x, z] of [[Z.x + 2.6, Z.z + 3.2], [-27.6, farmTop - 1.6]]) {
    cyl(scenery, x, 1.7, z, .06, .08, 3.4, '#5b6573', 6); collide(x, z, .24, .24, false);
    box(scenery, x, 3.48, z, .46, .16, .46, '#3f4a5c');
    const bulb = mesh(dynamic, geo('SphereGeometry', .17, 10, 6), new THREE.MeshBasicMaterial({color: '#f4ecd6'}), x, 3.3, z, false); bulb.name = 'yard-lamp-bulb'; lampBulbs.push(bulb);
  }

  // Beyond the fence: the same apartment neighbourhood the school sees.
  const nightSky = mark(new THREE.Group(), 'yard-night-sky'); nightSky.visible = false; root.add(nightSky);
  const moon = new THREE.Mesh(geo('SphereGeometry', 3.2, 16, 10), new THREE.MeshBasicMaterial({color: '#fff6d8', fog: false, transparent: true, opacity: 0})); moon.position.set(-30, 46, 96); nightSky.add(moon);
  {
    const random = seeded(5512), stars = [];
    for (let n = 0; n < 160; n++) { const a = random() * Math.PI * 2, h = .22 + random() * .7, r = 150; stars.push(Math.cos(a) * Math.cos(h) * r, Math.sin(h) * r, Math.sin(a) * Math.cos(h) * r); }
    const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    nightSky.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({color: '#ffffff', size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false})));
  }

  // --- Coffee trees (merged per part, rebuilt only when data changes) ---------
  const treeMaterials = {
    mound: own('#5a3d28', {roughness: 1}), stem: own('#6b4a2f', {roughness: .9}), leaf: own('#3f8a45', {roughness: .55}),
    foliage: own('#2e6f3c', {roughness: .5}), flower: own('#fffdf2', {emissive: '#fff6d8', emissiveIntensity: .12}), cherry: own('#c8302a', {roughness: .35}),
    ring: own('#f2c869', {emissive: '#f2c869', emissiveIntensity: .45}),
  };
  const treeGeometries = {
    mound: new THREE.SphereGeometry(.34, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), stem: new THREE.CylinderGeometry(.03, .05, 1, 6),
    leaf: new THREE.SphereGeometry(.14, 8, 5), foliage: new THREE.IcosahedronGeometry(.36, 1), flower: new THREE.SphereGeometry(.055, 6, 4),
    cherry: new THREE.SphereGeometry(.07, 8, 5), ring: new THREE.TorusGeometry(.85, .05, 5, 28),
  };
  const treeGroup = mark(new THREE.Group(), 'yard-coffee-trees'); dynamic.add(treeGroup);
  const scratch = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const placed = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => scratch.clone().compose(position.set(x, y, z), quaternion.setFromEuler(euler.set(rx, ry, rz)), scale.set(sx, sy, sz));
  // trees[index] sits on plot index; null keeps a plot empty (plot 0 waits for my tree).
  let trees = [], plotOfTree = new Map(), viewerHasTree = false;
  function treeParts(tree, plot, out) {
    const random = seeded(hashString(tree.id)), turn = random() * Math.PI * 2, x = plot.x, z = plot.z, top = .2;
    out.mound.push(placed(x, top, z, 1, .5, 1));
    const stage = Math.max(0, Math.min(FRUIT_STAGE, tree.stage | 0));
    if (stage === 0) { out.cherry.push(placed(x + .05, top + .17, z, .55, .45, .55)); return; }
    const height = [0, .3, .72, 1.12, 1.18][stage];
    out.stem.push(placed(x, top + height / 2, z, 1 + stage * .25, height, 1 + stage * .25));
    if (stage === 1) { for (const side of [-1, 1]) out.leaf.push(placed(x + Math.cos(turn) * side * .12, top + height + .02, z + Math.sin(turn) * side * .12, 1, .32, .55, 0, turn, side * .5)); return; }
    const size = stage === 2 ? .62 : 1;
    const blobs = stage === 2 ? 3 : 5;
    const centers = [];
    for (let i = 0; i < blobs; i++) {
      const a = turn + i / blobs * Math.PI * 2, r = (stage === 2 ? .14 : .26) * (i === 0 ? .2 : 1), y = top + height - .05 + (i === 0 ? .26 * size : random() * .22);
      const cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
      out.foliage.push(placed(cx, y, cz, size * 1.05, size * .82, size * 1.05, 0, a));
      centers.push([cx, y, cz]);
    }
    if (stage >= 3) {
      const parts = stage === 3 ? out.flower : out.cherry, count = stage === 3 ? 9 : 11;
      for (let i = 0; i < count; i++) {
        const [cx, cy, cz] = centers[1 + (i % (blobs - 1))], a = random() * Math.PI * 2, r = .3 + random() * .08;
        parts.push(placed(cx + Math.cos(a) * r, cy - .05 + random() * .18, cz + Math.sin(a) * r, stage === 4 && i % 3 === 0 ? 1.15 : 1, 1, 1));
      }
    }
  }
  function rebuildTrees() {
    for (const child of [...treeGroup.children]) { treeGroup.remove(child); child.geometry?.dispose(); }
    const out = {mound: [], stem: [], leaf: [], foliage: [], flower: [], cherry: [], ring: []};
    plotOfTree = new Map();
    trees.forEach((tree, index) => { if (!tree) return; const plot = YARD_LAYOUT.plots[index]; if (!plot) return; plotOfTree.set(tree.id, plot); treeParts(tree, plot, out); });
    const first = YARD_LAYOUT.plots[0];
    out.ring.push(placed(first.x, .22, first.z, 1, 1, 1, Math.PI / 2));
    for (const [part, matrices] of Object.entries(out)) {
      if (!matrices.length) continue;
      const merged = new THREE.Mesh(mergeGeometries(matrices.map(matrix => ({geometry: treeGeometries[part], matrix}))), treeMaterials[part]);
      merged.name = 'yard-coffee-' + part; merged.castShadow = part !== 'ring'; merged.receiveShadow = true; treeGroup.add(merged);
    }
    for (const slot of tagPool) slot.key = '';
  }

  // Name tags: a small pool of sprites follows the nearest trees.
  const tagPool = [];
  for (let i = 0; i < 9; i++) {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 112;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.name = 'yard-tree-tag-' + i;
    const sprite = mark(new THREE.Sprite(new THREE.SpriteMaterial({map: texture, depthWrite: false, transparent: true})), 'yard-tree-tag');
    sprite.scale.set(1.65, .48, 1); sprite.visible = false; dynamic.add(sprite);
    tagPool.push({sprite, canvas, texture, key: ''});
  }
  const plantHere = mark(new THREE.Sprite(new THREE.SpriteMaterial({map: canvasTexture(256, 96, (c, w, h) => { c.fillStyle = 'rgba(44,149,108,.95)'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 28); c.fill(); c.fillStyle = '#ffffff'; c.font = '800 38px "Noto Sans KR", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('＋ 여기에 심기', w / 2, h / 2 + 2); }, 'yard-plant-here'), depthWrite: false, transparent: true})), 'yard-plant-here');
  plantHere.scale.set(1.5, .56, 1); plantHere.position.set(YARD_LAYOUT.plots[0].x, 1.15, YARD_LAYOUT.plots[0].z); dynamic.add(plantHere);
  function drawTag(slot, tree) {
    const key = `${tree.id}|${tree.name}|${tree.owner}|${tree.stage}|${tree.hearts}|${tree.harvests}|${tree.mine}`;
    if (slot.key === key) return;
    slot.key = key;
    const c = slot.canvas.getContext('2d'), w = slot.canvas.width, h = slot.canvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = tree.mine ? 'rgba(242,200,105,.97)' : 'rgba(255,250,240,.95)'; c.strokeStyle = tree.mine ? '#a8740c' : '#b98a5c'; c.lineWidth = 5;
    c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 22); c.fill(); c.stroke();
    c.fillStyle = '#2f3e5c'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 38px "Noto Sans KR", "Malgun Gothic", sans-serif';
    c.fillText((tree.mine ? '내 나무 · ' : '') + tree.name, w / 2, 40, w - 30);
    c.font = '600 25px "Noto Sans KR", "Malgun Gothic", sans-serif';
    const stars = tree.harvests ? ' ' + '★'.repeat(Math.min(5, tree.harvests)) + (tree.harvests > 5 ? '+' : '') : '';
    c.fillText(`${tree.owner} · ${tree.stageName}${tree.hearts ? ' · 💧' + tree.hearts : ''}${stars}`, w / 2, 80, w - 30);
    slot.texture.needsUpdate = true;
  }
  function updateTags(player) {
    const local = {x: player.x - O.x, z: player.z - O.z};
    const candidates = [];
    for (const tree of trees) {
      if (!tree) continue;
      const plot = plotOfTree.get(tree.id); if (!plot) continue;
      const d = Math.hypot(plot.x - local.x, plot.z - local.z);
      if (d < 8.5 || tree.mine) candidates.push({tree, plot, d: tree.mine ? Math.min(d, 6) : d});
    }
    candidates.sort((a, b) => a.d - b.d);
    tagPool.forEach((slot, index) => {
      const item = candidates[index];
      slot.sprite.visible = !!item && item.d < 14;
      if (!item) return;
      drawTag(slot, item.tree);
      const height = [.62, .9, 1.38, 1.85, 1.92][item.tree.stage] || 1;
      slot.sprite.position.set(item.plot.x, height + .45, item.plot.z);
    });
  }

  // --- Guestbook notes on the zelkova ----------------------------------------
  const notePaper = Object.fromEntries(PAPER_COLORS.map(c => [c.id, (() => { const m = new THREE.MeshStandardMaterial({color: c.hex, roughness: .9, side: THREE.DoubleSide}); m.name = 'yard-note-' + c.id; return m; })()]));
  const noteGeometry = new THREE.PlaneGeometry(.2, .27), stringGeometry = new THREE.CylinderGeometry(.006, .006, .3, 3);
  const stringMaterial = own('#f4efe2');
  const anchors = (() => {
    const random = seeded(4401), list = [];
    for (let i = 0; i < LIMITS.visibleNotes; i++) {
      const a = random() * Math.PI * 2, r = 1.7 + Math.sqrt(random()) * 3.1, y = 3.05 + random() * 1.15 + (r - 1.7) * .12;
      list.push({x: Math.cos(a) * r, y, z: Math.sin(a) * r, turn: -a + Math.PI / 2 + (random() - .5) * .6, tilt: (random() - .5) * .3});
    }
    return list;
  })();
  let noteState = {total: 0, hanging: 0, lights: false, bigTree: false, palette: []};
  function rebuildNotes() {
    for (const child of [...notesGroup.children]) { notesGroup.remove(child); child.geometry?.dispose(); }
    const byColor = new Map(), strings = [];
    for (let i = 0; i < noteState.hanging; i++) {
      const anchor = anchors[i], color = noteState.palette[noteState.palette.length - noteState.hanging + i] || PAPER_COLORS[i % PAPER_COLORS.length].id;
      if (!byColor.has(color)) byColor.set(color, []);
      byColor.get(color).push(placed(anchor.x, anchor.y, anchor.z, 1, 1, 1, 0, anchor.turn, anchor.tilt));
      strings.push(placed(anchor.x, anchor.y + .28, anchor.z));
    }
    for (const [color, matrices] of byColor) {
      const merged = new THREE.Mesh(mergeGeometries(matrices.map(matrix => ({geometry: noteGeometry, matrix}))), notePaper[color] || notePaper.yellow);
      merged.name = 'yard-notes-' + color; notesGroup.add(merged);
    }
    if (strings.length) { const merged = new THREE.Mesh(mergeGeometries(strings.map(matrix => ({geometry: stringGeometry, matrix}))), stringMaterial); merged.name = 'yard-note-strings'; notesGroup.add(merged); }
    lightsGroup.visible = noteState.lights;
    zelkova.scale.setScalar(noteState.bigTree ? 1.22 : 1);
  }
  const bulbMaterial = new THREE.MeshBasicMaterial({color: '#ffe7a3'}); bulbMaterial.name = 'yard-string-lights';
  {
    const bulbs = [];
    for (let i = 0; i < 70; i++) { const a = i * .55, r = 4.3 + Math.sin(i * .7) * .3, y = 3.9 + (i / 70) * 2.6; bulbs.push(placed(Math.cos(a) * r, y, Math.sin(a) * r)); }
    const lights = new THREE.Mesh(mergeGeometries(bulbs.map(matrix => ({geometry: new THREE.SphereGeometry(.07, 6, 4), matrix}))), bulbMaterial); lights.name = 'yard-zelkova-bulbs';
    lightsGroup.add(lights);
  }

  batchStatic(scenery, keep);

  // Daylight: the yard darkens with the school sky; lamps glow at dusk.
  const tints = new Map();
  root.traverse(node => {
    if (!node.isMesh || Array.isArray(node.material) || !node.material.isMeshStandardMaterial) return;
    if (node.parent === notesGroup || node.parent === treeGroup) return;
    const original = node.material;
    if (!tints.has(original)) tints.set(original, {material: original.clone(), day: original.color.clone()});
    node.material = tints.get(original).material;
  });
  const tintable = [...Object.values(treeMaterials), ...Object.values(notePaper), stringMaterial];
  for (const material of tintable) if (!tints.has(material)) tints.set(material, {material, day: material.color.clone()});

  // E reach for a plot: on the walkway edge beside the tree, so neighbours never tie.
  const plotReach = plot => world(YARD_LAYOUT.walkwayX + (plot.side === 'east' ? 1 : -1), plot.z + .5);
  const exitTrigger = {minX: O.x - YARD_LAYOUT.exit.halfWidth, maxX: O.x + YARD_LAYOUT.exit.halfWidth, maxZ: O.z + YARD_LAYOUT.exit.triggerZ};
  const bounds = {minX: YARD_LAYOUT.bounds.minX + O.x, maxX: YARD_LAYOUT.bounds.maxX + O.x, minZ: YARD_LAYOUT.bounds.minZ + O.z, maxZ: YARD_LAYOUT.bounds.maxZ + O.z};
  let splashTime = 0;

  const api = {
    root, colliders, cameraColliders, bounds,
    get interactables() {
      const list = [...interactables];
      trees.forEach((tree, index) => {
        const plot = YARD_LAYOUT.plots[index]; if (!tree || !plot) return;
        const p = plotReach(plot);
        list.push({id: 'tree-' + tree.id, kind: 'coffee-tree', treeId: tree.id, mine: tree.mine, x: p.x, y: 0, z: p.z, floor: 1, zone: 'yard', label: `${tree.mine ? '내 커피나무' : teacherTitle(tree.owner) + '의 나무'} · ${tree.name}`});
      });
      if (!viewerHasTree) { const p = plotReach(YARD_LAYOUT.plots[0]); list.push({id: 'plot-mine', kind: 'farm-plot', x: p.x, y: 0, z: p.z, floor: 1, zone: 'yard', label: '빈 밭 · 내 커피나무 심기'}); }
      return list;
    },
    arrival() { return {...world(YARD_LAYOUT.arrival.x, YARD_LAYOUT.arrival.z), y: 0, lookYaw: YARD_LAYOUT.arrival.lookYaw}; },
    wantsExit(p) { return !!p && p.z < exitTrigger.maxZ && p.x > exitTrigger.minX && p.x < exitTrigger.maxX; },
    contains(p) { return !!p && Math.abs(p.x - O.x) < 60 && Math.abs(p.z - O.z) < 60; },
    /** Public trees in display order: index 0 is the viewer's own tree when they have one. */
    setTrees(list = []) {
      const mine = list.find(t => t?.mine) || null, others = list.filter(t => t && !t.mine);
      const slots = new Array(YARD_LAYOUT.plots.length).fill(null);
      if (mine) slots[0] = mine;
      others.slice(0, slots.length - 1).forEach((tree, index) => { slots[index + 1] = tree; });
      trees = slots; viewerHasTree = !!mine; plantHere.visible = !mine;
      rebuildTrees();
    },
    approachTree(id) {
      const index = trees.findIndex(t => t?.id === id); if (index < 0) return null;
      // Stand on the walkway just past the tree, facing the entrance: the camera then
      // looks down the open walkway instead of through the entrance signs.
      const plot = YARD_LAYOUT.plots[index], p = world(YARD_LAYOUT.walkwayX + (plot.side === 'east' ? .45 : -.45), plot.z + 1.2);
      return {x: p.x, y: 0, z: p.z, lookYaw: 0};
    },
    approach(kind) {
      const spots = {
        faucet: [YARD_LAYOUT.faucet.x, YARD_LAYOUT.faucet.z + 3.4, 0], zelkova: [YARD_LAYOUT.zelkova.x + .4, YARD_LAYOUT.zelkova.z + 5.6, 0],
        farm: [YARD_LAYOUT.walkwayX, -26.6, Math.PI], podium: [YARD_LAYOUT.podium.x, YARD_LAYOUT.podium.z + 5.2, 0],
        overview: [0, -14, 0], field: [-6, 2, Math.PI * .8],
      };
      const spot = spots[kind]; if (!spot) return null;
      return {...world(spot[0], spot[1]), y: 0, lookYaw: spot[2]};
    },
    setNotes(decor = {}, palette = []) {
      noteState = {total: decor.total || 0, hanging: Math.min(LIMITS.visibleNotes, decor.hanging || 0), lights: !!decor.lights, bigTree: !!decor.bigTree, palette: Array.isArray(palette) ? palette : []};
      rebuildNotes();
    },
    get noteState() { return {...noteState}; },
    splash() { splashTime = 1.6; water.visible = true; },
    setVisible(value) { root.visible = !!value; },
    setDaylight({night = 0, window} = {}) {
      for (const {material, day} of tints.values()) { material.color.copy(day); if (window?.isColor) material.color.multiply(window); }
      const dark = Math.max(0, Math.min(1, (night - .35) / .5)), glow = Math.max(0, Math.min(1, (night - .15) / .4));
      nightSky.visible = dark > 0; moon.material.opacity = dark; nightSky.children[1].material.opacity = dark * .9;
      for (const face of floodHeads) face.material.color.set(glow > .05 ? '#fff6dc' : '#e9e4d6');
      for (const pool of lampPools) { pool.visible = glow > 0; pool.material.opacity = glow * (pool.name === 'yard-flood-glow' ? .24 : .3); }
      for (const bulb of lampBulbs) bulb.material.color.set(glow > .05 ? '#ffd98a' : '#f4ecd6');
      bulbMaterial.color.set(glow > .05 ? '#ffd36b' : '#ffe7a3');
    },
    update(dt, time, player) {
      if (!root.visible) return;
      for (const [index, flag] of flags.entries()) flag.rotation.y = Math.sin(time * .9 + index) * .12;
      for (const [index, swing] of swings.entries()) swing.rotation.z = Math.sin(time * 1.3 + index * 1.7) * .08;
      notesGroup.rotation.y = Math.sin(time * .25) * .015;
      plantHere.position.y = 1.15 + Math.sin(time * 2.4) * .08;
      if (splashTime > 0) { splashTime -= dt; water.scale.y = .9 + Math.sin(time * 30) * .1; if (splashTime <= 0) water.visible = false; }
      if (player) updateTags(player);
    },
  };
  api.setTrees([]);
  api.setNotes({total: 0, hanging: 0});
  return api;
}
