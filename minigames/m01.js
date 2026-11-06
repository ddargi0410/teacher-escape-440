import * as THREE from '../vendor/three.module.js';
import {SoftwareRenderer} from '../software-renderer.js?v=20261106-immersive1';
import {wantsSoftwareRenderer} from '../visual-test.js?v=20261106-visual1';

// This room is deliberately self-contained: it does not move or modify the
// exploration scene, save record, mission data, or another minigame's controls.
const LIMIT = 90;
const ANSWER_SECONDS = 5;
const BOUNDS = {minX: -6.3, maxX: 6.3, minZ: -2.8, maxZ: 4.5};
const COLORS = {cream: '#f2ead8', ink: '#264c43', green: '#67a68c', coral: '#df8768', gold: '#f5d681'};

export function classifyOXPosition(x, z) {
  if (z < BOUNDS.minZ || z > BOUNDS.maxZ || x < BOUNDS.minX || x > BOUNDS.maxX) return null;
  if (x < -0.9) return true;
  if (x > 0.9) return false;
  return null;
}

export function judgeOXRound(position, answer) {
  const choice = classifyOXPosition(position.x, position.z);
  return {choice, correct: choice !== null && choice === answer};
}

export function start({container, data, onWin = () => {}, onFail = () => {}}) {
  const questions = data.arcade?.questions?.slice(0, 5);
  if (!questions || questions.length !== 5 || questions.some(q => typeof q.answer !== 'boolean')) {
    throw new Error('m01 requires five OX questions in data.arcade.questions.');
  }

  const root = document.createElement('div');
  root.className = 'm01-room';
  root.innerHTML = `<style>
    .m01-room{position:relative;width:100%;height:100%;min-height:360px;overflow:hidden;background:#ede8d8;font-family:inherit;color:#264c43;isolation:isolate;touch-action:none}
    .m01-room canvas{display:block;width:100%;height:100%;touch-action:none}
    .m01-room .m01-hud{position:absolute;top:16px;left:5%;right:5%;display:flex;align-items:center;justify-content:space-between;gap:16px;pointer-events:none;font-weight:800;font-size:clamp(18px,2vw,24px);text-shadow:0 1px #fff}
    .m01-room .m01-question{position:absolute;top:92px;left:5%;right:5%;padding:14px 18px;background:#183f35;color:#fffdf3;border:2px solid #7d9c87;border-radius:14px;text-align:center;font-size:clamp(20px,2.1vw,30px);font-weight:800;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere;pointer-events:none}.m01-room .m01-round{letter-spacing:3px;color:#264c43}
    .m01-room .m01-count{font-size:clamp(28px,4vw,50px);font-variant-numeric:tabular-nums}
    .m01-room .m01-total{position:absolute;right:5%;top:60px;font-size:16px;font-weight:700;color:#596f65}
    .m01-room .m01-feedback{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);font-size:clamp(16px,2.3vw,28px);font-weight:900;text-align:center;white-space:nowrap;pointer-events:none;text-shadow:0 2px 8px #fff,0 0 18px #fff}
    .m01-room .m01-feedback b{display:block;font-size:clamp(40px,7vw,88px);line-height:1.1}
    .m01-room .m01-instruction{position:absolute;left:50%;bottom:25px;transform:translateX(-50%);font-size:clamp(16px,1.5vw,19px);font-weight:800;white-space:nowrap;text-shadow:0 1px 5px white;pointer-events:none}
    .m01-room .m01-pad{position:absolute;bottom:64px;left:18px;display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,44px);gap:5px}
    .m01-room .m01-key{all:unset;box-sizing:border-box;display:grid;place-items:center;background:#ffffffd9;border:2px solid #5b7d6c;border-radius:12px;color:#264c43;font:900 25px sans-serif;cursor:pointer;touch-action:none;user-select:none}
    .m01-room .m01-key:active,.m01-room .m01-key:focus-visible{background:#f5d681;outline:3px solid #df8768}
    .m01-room .m01-key[data-dir="up"]{grid-column:2}
    .m01-room .m01-key[data-dir="left"]{grid-column:1;grid-row:2}
    .m01-room .m01-key[data-dir="down"]{grid-column:2;grid-row:2}
    .m01-room .m01-key[data-dir="right"]{grid-column:3;grid-row:2}
    .m01-room .m01-bubble{all:unset;position:absolute;max-width:240px;padding:7px 12px;transform:translate(-50%,-100%);background:#fffdf4;color:#344b48;border:2px solid #df8768;border-radius:16px;font:800 14px sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 5px 12px #264c431f}
    .m01-room .m01-bubble[hidden],.m01-room .m01-retry[hidden]{display:none}
    .m01-room .m01-retry{all:unset;position:absolute;left:50%;top:62%;transform:translateX(-50%);padding:15px 28px;background:#264c43;color:#fff;border-radius:999px;font-size:20px;font-weight:800;cursor:pointer}
    .m01-room .m01-retry:focus-visible{outline:4px solid #df8768;outline-offset:4px}
    .m01-room.m01-hit{animation:m01-shake .24s linear}
    @keyframes m01-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
    @media(max-width:600px){.m01-room .m01-hud{top:14px}.m01-room .m01-total{top:55px}.m01-room .m01-question{top:84px;font-size:21px;padding:12px}.m01-room .m01-pad{bottom:57px;grid-template-columns:repeat(3,38px);grid-template-rows:repeat(2,38px)}.m01-room .m01-feedback{top:43%;font-size:18px}.m01-room .m01-instruction{bottom:14px;font-size:16px;white-space:normal;text-align:center;width:92%}.m01-room .m01-bubble{font-size:16px;white-space:normal;max-width:190px}}
    @media(prefers-reduced-motion:reduce){.m01-room.m01-hit{animation:none}}
  </style>
  <canvas aria-label="교실 바닥 O와 X 구역으로 달리는 3D 미니게임" tabindex="0"></canvas>
  <div class="m01-hud"><span class="m01-round" aria-label="맞힌 문제 수"></span><strong class="m01-count" aria-label="남은 답변 시간"></strong></div>
  <div class="m01-total"></div><div class="m01-question" aria-live="polite"></div>
  <div class="m01-feedback" role="status" aria-live="polite"></div>
  <div class="m01-instruction">⌨ WASD / 방향키 · 바닥을 눌러 달리기</div>
  <div class="m01-pad" aria-label="달리기 조작">
    <button class="m01-key" data-dir="up" aria-label="교실 앞으로 이동">↑</button>
    <button class="m01-key" data-dir="left" aria-label="O 구역 쪽으로 이동">←</button>
    <button class="m01-key" data-dir="down" aria-label="교실 뒤로 이동">↓</button>
    <button class="m01-key" data-dir="right" aria-label="X 구역 쪽으로 이동">→</button>
  </div>
  <button class="m01-bubble" aria-label="아이 말풍선 건너뛰기" hidden>선생님! 쟤가 먼저 했어요!</button>
  <button class="m01-retry" hidden>↻ 다시 달리기</button>`;
  container.appendChild(root);
  const canvas = root.querySelector('canvas');
  const roundLabel = root.querySelector('.m01-round');
  const countdown = root.querySelector('.m01-count');
  const totalLabel = root.querySelector('.m01-total');
  const questionLabel = root.querySelector('.m01-question');
  const feedback = root.querySelector('.m01-feedback');
  const bubble = root.querySelector('.m01-bubble');
  const retry = root.querySelector('.m01-retry');
  const cleanups = [], materials = new Set(), geometries = new Set(), textures = new Set();
  const keys = new Set(), pointerDirections = new Map();
  let destroyed = false, paused = false, won = false, raf = 0, last = performance.now();
  let elapsed = 0, sceneTime = 0, round = 0, answerLeft = ANSWER_SECONDS;
  let phase = 'ready', phaseLeft = 1.4, correctHighlight = null, flash = 0;
  let target = null, stumble = 0, collisionCooldown = 0, bubbleLeft = 0, speakingChild = null;
  let width = 1, height = 1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e9da');
  const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight('#fff3db', '#779282', 3));
  const light = new THREE.DirectionalLight('#ffddb2', 2.6);
  light.position.set(-5, 13, 8); scene.add(light);

  let renderer;
  try {
    renderer = wantsSoftwareRenderer()?new SoftwareRenderer({canvas}):new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'low-power'});
  } catch {
    renderer = new SoftwareRenderer({canvas});
  }
  canvas.dataset.renderer=renderer.isSoftware?'software':'webgl';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(renderer.isSoftware ? 0.75 : Math.min(devicePixelRatio || 1, 1.5));

  function material(color, basic = false, options = {}) {
    const m = basic ? new THREE.MeshBasicMaterial({color, ...options}) : new THREE.MeshStandardMaterial({color, roughness: .85, ...options});
    materials.add(m); return m;
  }
  function mesh(geometry, mat, parent = scene, position = [0, 0, 0]) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, mat); object.position.set(...position); parent.add(object); return object;
  }
  function box(x, y, z, w, h, d, color, parent = scene) {
    return mesh(new THREE.BoxGeometry(w, h, d), material(color), parent, [x, y, z]);
  }
  function sphere(x, y, z, radius, color, parent = scene) {
    return mesh(new THREE.IcosahedronGeometry(radius, 1), material(color), parent, [x, y, z]);
  }
  function textureCanvas(w, h, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; textures.add(tx); return tx;
  }
  function labelTexture(text, color, bg) {
    return textureCanvas(512, 512, (ctx, w, h) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 310px sans-serif';
      ctx.fillText(text, w / 2, h / 2 + 18);
    });
  }

  box(0, -.15, .3, 16, .3, 12, '#d4c3a1');
  box(0, 2.6, -5.9, 16, 5.5, .25, COLORS.cream);
  for (const x of [-7.8, 7.8]) box(x, 1.2, -.2, .25, 2.5, 11.8, '#d8d6bc');
  for (let x = -7; x < 8; x += 2) box(x, .012, .3, .025, .02, 11.5, '#c6b48e');
  for (let z = -4.7; z < 6; z += 1.8) box(0, .014, z, 15.5, .02, .018, '#c6b48e');
  // Side desks and stationery make a classroom without obstructing the run.
  for (const x of [-6.5, 6.5]) {
    box(x, .85, -3.9, 2, .15, 1.1, '#b89368');
    for (const dx of [-.75, .75]) box(x + dx, .4, -3.9, .1, .8, .75, '#5f7768');
    box(x, 1, -3.9, .8, .1, .55, '#faf4e4');
    box(x + .35, 1.12, -4.1, .2, .3, .2, '#d88968');
  }
  box(0, 3.5, -5.67, 14.6, 2.4, .16, '#af875c');
  const boardMaterial = material('#ffffff', true, {side: THREE.DoubleSide});
  const board = mesh(new THREE.PlaneGeometry(14.1, 1.95), boardMaterial, scene, [0, 3.5, -5.55]);
  const zones = [true, false].map((answer, index) => {
    const x = index === 0 ? -3.65 : 3.65;
    const bg = index === 0 ? '#bad9b7' : '#edc2a6';
    const tx = labelTexture(index === 0 ? 'O' : 'X', COLORS.ink, bg);
    const surface = mesh(new THREE.PlaneGeometry(5.5, 6.8), material('#ffffff', true, {map: tx, side: THREE.DoubleSide}), scene, [x, .027, .85]);
    surface.rotation.x = -Math.PI / 2;
    const outline = new THREE.Group(); scene.add(outline);
    const borderMaterial = material(index === 0 ? '#5e9a74' : '#cb8062', true);
    const boxes = [[x - 2.83, .04, .85, .11, .06, 7.05], [x + 2.83, .04, .85, .11, .06, 7.05], [x, .04, -2.63, 5.65, .06, .11], [x, .04, 4.33, 5.65, .06, .11]];
    boxes.forEach(([bx, by, bz, w, h, d]) => mesh(new THREE.BoxGeometry(w, h, d), borderMaterial, outline, [bx, by, bz]));
    return {answer, surface, borderMaterial, originalColor: borderMaterial.color.clone()};
  });
  box(0, .03, .85, 1.6, .035, 7.0, '#e7dfc6');

  function character(color, size = 1) {
    const g = new THREE.Group(); scene.add(g); g.scale.setScalar(size);
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * .16, .65, 0); g.add(leg);
      box(0, -.25, 0, .22, .5, .25, '#435b55', leg);
      box(0, -.53, .07, .26, .14, .38, '#2b423d', leg); legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * .38, 1.27, 0); g.add(arm);
      box(0, -.22, 0, .19, .45, .23, color, arm); sphere(0, -.49, 0, .12, '#e6b18d', arm); arms.push(arm);
    }
    box(0, 1.01, 0, .62, .68, .36, color, g);
    box(0, 1.08, .19, .12, .5, .025, '#f5dfae', g);
    sphere(0, 1.76, 0, .38, '#e6b18d', g);
    const hair = sphere(0, 1.95, -.03, .36, '#56473b', g); hair.scale.y = .6;
    for (const x of [-.12, .12]) sphere(x, 1.78, .33, .035, '#314a40', g);
    g.userData = {legs, arms}; return g;
  }
  const avatar = character('#346e5c'); avatar.name = 'm01-player'; avatar.position.set(0, 0, 3.5);
  const children = [character('#df8768', .66), character('#87a9ba', .66)];
  const anchor = new THREE.Vector3();
  const highlightColor = new THREE.Color('#fff079');
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundPoint = new THREE.Vector3();

  function updateBoard() {
    const q = questions[round];
    questionLabel.textContent = q.text;
    const old = boardMaterial.map;
    boardMaterial.map = textureCanvas(2048, 286, (ctx, w, h) => {
      ctx.fillStyle = '#264c43'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#729b88'; ctx.lineWidth = 2; ctx.strokeRect(18, 18, w - 36, h - 36);
      ctx.font = '800 62px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff8df'; ctx.fillText(q.text, w / 2, h / 2 + 8, w - 80);
    });
    boardMaterial.needsUpdate = true;
    if (old) { textures.delete(old); old.dispose(); }
    canvas.setAttribute('aria-label', `문제 ${round + 1}. ${q.text} 왼쪽 O, 오른쪽 X. 5초 안에 이동하세요.`);
    roundLabel.textContent = `${'●'.repeat(round)}${'○'.repeat(5 - round)}  ${round + 1}/5`;
  }
  function say(child) { speakingChild = child; bubbleLeft = 2; bubble.hidden = false; }
  function cue(name) { data.runtime?.playSound?.(name); }
  function signal(icon, text = '', good = true) {
    feedback.replaceChildren();
    const glyph = document.createElement('b'); glyph.textContent = icon; feedback.appendChild(glyph);
    feedback.appendChild(document.createTextNode(text)); feedback.style.color = good ? '#264c43' : '#ae4b2f';
  }
  function resetRound() {
    phase = 'ready'; phaseLeft = 1.4; answerLeft = ANSWER_SECONDS; correctHighlight = null;
    avatar.position.set(0, 0, 3.5); avatar.rotation.y = Math.PI; stumble = 0; target = null; clearInput();
    feedback.textContent = ''; updateBoard();
  }
  function resolveAnswer() {
    const q = questions[round];
    const result = judgeOXRound(avatar.position, q.answer);
    correctHighlight = q.answer; phase = result.correct ? 'correct' : 'wrong'; phaseLeft = result.correct ? 1.1 : 2;
    target = null; clearInput();
    if (result.correct) { signal('✓'); cue('success'); }
    else {
      signal(q.answer ? 'O ✓' : 'X ✓', q.tip, false);
      flash = .35; root.classList.remove('m01-hit'); void root.offsetWidth; root.classList.add('m01-hit');
      onFail({reason: result.choice === null ? 'no-zone' : 'wrong-answer', tip: q.tip});
    }
  }
  function timeout() {
    phase = 'timeout'; target = null; clearInput(); countdown.textContent = '⌛';
    signal('↻', '한 번 더 달려 볼까요?', false); retry.hidden = false;
    onFail({reason: 'timeout', tip: '문장을 보고 O 또는 X로 달려요.'}); retry.focus();
  }
  function restart() {
    elapsed = 0; round = 0; sceneTime = 0; collisionCooldown = 1; won = false;
    bubbleLeft = 0; bubble.hidden = true; retry.hidden = true; resetRound(); canvas.focus();
  }
  function listen(targetObject, name, fn, opts) {
    targetObject.addEventListener(name, fn, opts); cleanups.push(() => targetObject.removeEventListener(name, fn, opts));
  }
  function clearInput() { keys.clear(); pointerDirections.clear(); target = null; }
  const codes = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
  listen(window, 'keydown', e => {
    if (!codes.has(e.code) || destroyed || paused || phase === 'timeout') return;
    e.preventDefault(); e.stopPropagation(); keys.add(e.code); target = null;
  });
  listen(window, 'keyup', e => { if (codes.has(e.code)) keys.delete(e.code); });
  listen(window, 'blur', clearInput);
  listen(document, 'visibilitychange', () => { clearInput(); last = performance.now(); });
  root.querySelectorAll('[data-dir]').forEach(button => {
    listen(button, 'pointerdown', e => {
      if (paused || destroyed || phase === 'timeout') return;
      e.preventDefault(); e.stopPropagation(); button.setPointerCapture?.(e.pointerId);
      pointerDirections.set(e.pointerId, button.dataset.dir); target = null;
    });
    const release = e => pointerDirections.delete(e.pointerId);
    listen(button, 'pointerup', release); listen(button, 'pointercancel', release); listen(button, 'lostpointercapture', release);
  });
  function setTarget(e) {
    // A tap during the short ready beat should queue the run, not disappear.
    // The player still starts moving only when the five-second window opens.
    if (paused || (phase !== 'answer' && phase !== 'ready')) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera({x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: 1 - ((e.clientY - rect.top) / rect.height) * 2}, camera);
    if (raycaster.ray.intersectPlane(ground, groundPoint)) target = {x: THREE.MathUtils.clamp(groundPoint.x, BOUNDS.minX, BOUNDS.maxX), z: THREE.MathUtils.clamp(groundPoint.z, BOUNDS.minZ, BOUNDS.maxZ)};
  }
  listen(canvas, 'pointerdown', e => { e.preventDefault(); canvas.focus({preventScroll: true}); setTarget(e); });
  listen(canvas, 'contextmenu', e => e.preventDefault());
  listen(bubble, 'click', () => { bubble.hidden = true; bubbleLeft = 0; });
  listen(retry, 'click', restart);

  function resize() {
    if (destroyed) return;
    const rect = root.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height); camera.aspect = width / height;
    // In portrait, pull back enough to show both full answer zones.
    const distance = camera.aspect < 1.05 ? 19.5 / Math.max(.55, camera.aspect) : 19.5;
    camera.position.set(0, distance * .72, distance * .71);
    camera.lookAt(0, .6, -.4); camera.updateProjectionMatrix();
    if (paused || phase === 'timeout' || won) renderer.render(scene, camera);
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(root); listen(window, 'resize', resize);

  function animateCharacter(actor, speed, t) {
    const swing = Math.sin(t * 10) * Math.min(.65, speed * .13);
    actor.userData.legs[0].rotation.x = swing; actor.userData.legs[1].rotation.x = -swing;
    actor.userData.arms[0].rotation.x = -swing * .8; actor.userData.arms[1].rotation.x = swing * .8;
  }
  function movePlayer(dt) {
    let dx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    let dz = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    for (const dir of pointerDirections.values()) { if (dir === 'left') dx--; if (dir === 'right') dx++; if (dir === 'up') dz--; if (dir === 'down') dz++; }
    if (target && !dx && !dz) {
      dx = target.x - avatar.position.x; dz = target.z - avatar.position.z;
      if (Math.hypot(dx, dz) < .12) { target = null; dx = dz = 0; }
    }
    const len = Math.hypot(dx, dz), speed = stumble > 0 ? 0 : len ? 5.2 : 0;
    if (len && speed) {
      const step = Math.min(speed * dt, target ? len : Infinity);
      avatar.position.x = THREE.MathUtils.clamp(avatar.position.x + dx / len * step, BOUNDS.minX, BOUNDS.maxX);
      avatar.position.z = THREE.MathUtils.clamp(avatar.position.z + dz / len * step, BOUNDS.minZ, BOUNDS.maxZ);
      avatar.rotation.y = Math.atan2(dx, dz);
    }
    avatar.rotation.z = stumble > 0 ? Math.sin(sceneTime * 35) * .12 : 0;
    animateCharacter(avatar, speed, sceneTime);
  }
  function moveChildren(dt, obstruct) {
    children.forEach((child, i) => {
      const t = sceneTime * 1.5 + i * Math.PI;
      const x = Math.sin(t) * 5.4, z = .8 + Math.sin(t * 1.6 + i * 2) * 2.6;
      child.rotation.y = Math.atan2(x - child.position.x, z - child.position.z);
      child.position.set(x, 0, z); animateCharacter(child, 5.2, sceneTime + i);
      if (obstruct && collisionCooldown <= 0 && Math.hypot(x - avatar.position.x, z - avatar.position.z) < .73) {
        const dx = avatar.position.x - x, dz = avatar.position.z - z, len = Math.hypot(dx, dz) || 1;
        avatar.position.x = THREE.MathUtils.clamp(avatar.position.x + dx / len * .35, BOUNDS.minX, BOUNDS.maxX);
        avatar.position.z = THREE.MathUtils.clamp(avatar.position.z + dz / len * .35, BOUNDS.minZ, BOUNDS.maxZ);
        stumble = .28; collisionCooldown = 1.35; say(child); cue('click');
      }
    });
  }
  function drawBubble() {
    if (bubbleLeft <= 0 || !speakingChild) { bubble.hidden = true; return; }
    speakingChild.getWorldPosition(anchor); anchor.y += 1.7; anchor.project(camera);
    bubble.style.left = `${Math.max(90, Math.min(width - 90, (anchor.x + 1) * width / 2))}px`;
    bubble.style.top = `${Math.max(140, (1 - anchor.y) * height / 2)}px`;
    bubble.hidden = false;
  }
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const clockDt = Math.max(0, (now - last) / 1000), dt = Math.min(.15, clockDt); last = now;
    if (paused || document.hidden || phase === 'timeout' || won) return;
    elapsed += clockDt; sceneTime += clockDt; collisionCooldown = Math.max(0, collisionCooldown - clockDt);
    stumble = Math.max(0, stumble - clockDt); bubbleLeft -= clockDt; flash = Math.max(0, flash - clockDt);
    if (elapsed >= LIMIT) { timeout(); renderer.render(scene, camera); return; }
    totalLabel.textContent = `◷ ${Math.ceil(LIMIT - elapsed)}초`;
    if (phase === 'ready') {
      phaseLeft -= clockDt; countdown.textContent = '준비';
      if (phaseLeft <= 0) { phase = 'answer'; answerLeft = ANSWER_SECONDS; }
    } else if (phase === 'answer') {
      movePlayer(dt); answerLeft -= clockDt; countdown.textContent = `${Math.max(0, Math.ceil(answerLeft))}″`;
      countdown.style.color = answerLeft <= 2 ? '#b64f32' : COLORS.ink;
      if (answerLeft <= 0) resolveAnswer();
    } else if (phase === 'correct' || phase === 'wrong') {
      phaseLeft -= clockDt; countdown.textContent = phase === 'correct' ? '✓' : '↻';
      if (phaseLeft <= 0) {
        if (phase === 'correct') round++;
        if (round === 5) { won = true; signal('✓', '5문제 통과!'); roundLabel.textContent = '●●●●●  5/5'; onWin({correct: 5, elapsed}); }
        else resetRound();
      }
    }
    // A host is allowed to dispose immediately inside either callback.
    if (destroyed) return;
    moveChildren(dt, phase === 'answer');
    if (phase !== 'answer') animateCharacter(avatar, 0, sceneTime);
    zones.forEach(zone => zone.borderMaterial.color.copy(correctHighlight === zone.answer && Math.sin(sceneTime * 15) > 0 ? highlightColor : zone.originalColor));
    drawBubble(); renderer.render(scene, camera);
  }

  resize(); resetRound(); raf = requestAnimationFrame(frame);
  return {
    pause() { paused = true; clearInput(); },
    resume() { paused = false; last = performance.now(); },
    hint() {
      if (destroyed || won || phase === 'timeout') return;
      const q = questions[round]; correctHighlight = q.answer;
      signal(q.answer ? 'O' : 'X', q.tip);
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      cancelAnimationFrame(raf); clearInput(); resizeObserver?.disconnect(); cleanups.forEach(fn => fn());
      textures.forEach(tx => tx.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      renderer.dispose(); scene.clear(); root.remove();
    }
  };
}
