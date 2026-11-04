import * as THREE from './vendor/three.module.js';

/**
 * Buildless, camera-relative controls. The teacher model faces +Z at rotation 0.
 * Gameplay shortcuts are intentionally owned by game.js.
 */
export function createPlayer({ camera, canvas, model, world, onMove }) {
  const position = new THREE.Vector3();
  const keys = new Set();
  const listeners = [];
  const joystick = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  const desiredCamera = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const focusTarget = new THREE.Vector3();
  let focusStarted = false;
  const stick = { x: 0, y: 0 };
  let enabled = true;
  let firstPerson = false;
  let orbitYaw = 0;
  let elevation = 0.72;
  let firstPitch = 0;
  let teacherYaw = Math.PI;
  let moving = false;
  let moved = false;
  let gait = 0;
  let drag = null;
  let stickPointer = null;
  let currentFloor = 5;
  let disposed = false;

  const listen = (target, name, handler, options) => {
    if (!target) return;
    target.addEventListener(name, handler, options);
    listeners.push(() => target.removeEventListener(name, handler, options));
  };
  const editing = target => target instanceof Element &&
    !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
  const controlKeys = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'
  ]);

  function resetStick() {
    if (joystick && stickPointer !== null) {
      try { joystick.releasePointerCapture(stickPointer); } catch {}
    }
    stickPointer = null;
    stick.x = stick.y = 0;
    if (knob) knob.style.transform = 'translate(0px, 0px)';
    joystick?.classList.remove('is-active');
  }

  function clearInput() {
    keys.clear();
    if (drag) {
      try { canvas.releasePointerCapture(drag.id); } catch {}
    }
    drag = null;
    canvas.classList.remove('is-looking');
    resetStick();
    moving = false;
    resetLegs();
  }

  function resetLegs() {
    for (const limbs of [model?.userData?.legs,model?.userData?.arms])
      if (Array.isArray(limbs)) for (const limb of limbs) if (limb?.rotation) limb.rotation.x = 0;
  }

  listen(window, 'keydown', event => {
    if (!enabled || editing(event.target) || !controlKeys.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  listen(window, 'keyup', event => keys.delete(event.code));
  listen(window, 'blur', clearInput);
  listen(document, 'visibilitychange', () => { if (document.hidden) clearInput(); });

  listen(canvas, 'pointerdown', event => {
    if (!enabled || drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    canvas.classList.add('is-looking');
    event.preventDefault();
  });
  listen(canvas, 'pointermove', event => {
    if (!enabled || !drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    orbitYaw -= dx * 0.005;
    if (firstPerson) firstPitch = THREE.MathUtils.clamp(firstPitch - dy * 0.004, -0.9, 0.9);
    else elevation = THREE.MathUtils.clamp(elevation + dy * 0.004, 0.40, 1.13);
    event.preventDefault();
  });
  const endDrag = event => {
    if (!drag || drag.id !== event.pointerId) return;
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
    drag = null;
    canvas.classList.remove('is-looking');
  };
  listen(canvas, 'pointerup', endDrag);
  listen(canvas, 'pointercancel', endDrag);
  listen(canvas, 'lostpointercapture', endDrag);
  listen(canvas, 'contextmenu', event => { if (enabled) event.preventDefault(); });

  if (joystick) {
    joystick.style.touchAction = 'none';
    const updateStick = event => {
      const rect = joystick.getBoundingClientRect();
      const radius = Math.max(12, Math.min(rect.width, rect.height) * 0.31);
      let x = event.clientX - rect.left - rect.width / 2;
      let y = event.clientY - rect.top - rect.height / 2;
      const length = Math.hypot(x, y);
      if (length > radius) { x *= radius / length; y *= radius / length; }
      stick.x = x / radius;
      stick.y = y / radius;
      if (Math.hypot(stick.x, stick.y) < 0.12) stick.x = stick.y = 0;
      if (knob) knob.style.transform = `translate(${x}px, ${y}px)`;
    };
    listen(joystick, 'pointerdown', event => {
      if (!enabled || stickPointer !== null) return;
      event.preventDefault();
      event.stopPropagation();
      stickPointer = event.pointerId;
      try { joystick.setPointerCapture(event.pointerId); } catch {}
      joystick.classList.add('is-active');
      updateStick(event);
    });
    listen(joystick, 'pointermove', event => {
      if (!enabled || event.pointerId !== stickPointer) return;
      event.preventDefault();
      updateStick(event);
    });
    const releaseStick = event => { if (event.pointerId === stickPointer) resetStick(); };
    listen(joystick, 'pointerup', releaseStick);
    listen(joystick, 'pointercancel', releaseStick);
    listen(joystick, 'lostpointercapture', releaseStick);
  }

  function blocked(x, z) {
    const radius = 0.35;
    return (world.colliders || []).some(c => {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) return false;
      const nearestX = THREE.MathUtils.clamp(x, c.x - c.w / 2, c.x + c.w / 2);
      const nearestZ = THREE.MathUtils.clamp(z, c.z - c.d / 2, c.z + c.d / 2);
      return (x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2;
    });
  }

  function updateCamera(dt, snap = false) {
    focusStarted = false;
    if (firstPerson) {
      desiredCamera.set(position.x, position.y + 1.66, position.z);
      lookTarget.set(
        position.x - Math.sin(orbitYaw) * Math.cos(firstPitch),
        position.y + 1.66 + Math.sin(firstPitch),
        position.z - Math.cos(orbitYaw) * Math.cos(firstPitch)
      );
    } else {
      const distance = 17.7;
      lookTarget.set(position.x, position.y + 0.8, position.z);
      desiredCamera.set(
        position.x + Math.sin(orbitYaw) * Math.cos(elevation) * distance,
        position.y + 0.8 + Math.sin(elevation) * distance,
        position.z + Math.cos(orbitYaw) * Math.cos(elevation) * distance
      );
    }
    if (snap || firstPerson) camera.position.copy(desiredCamera);
    else camera.position.lerp(desiredCamera, 1 - Math.exp(-9 * dt));
    camera.lookAt(lookTarget);
  }

  function teleport(point) {
    clearInput();
    position.set(Number(point.x) || 0, Number(point.y) || 0, Number(point.z) || 0);
    model?.position.copy(position);
    updateCamera(0, true);
  }

  function update(dt, active = true) {
    if (disposed || !enabled || !active || document.hidden) {
      if (moving || keys.size || drag || stickPointer !== null) clearInput();
      return;
    }
    dt = THREE.MathUtils.clamp(Number(dt) || 0, 0, 0.05);
    if (keys.has('ArrowLeft')) orbitYaw += 1.65 * dt;
    if (keys.has('ArrowRight')) orbitYaw -= 1.65 * dt;
    if (keys.has('ArrowUp')) {
      if (firstPerson) firstPitch = Math.min(0.9, firstPitch + dt);
      else elevation = Math.min(1.13, elevation + dt * 0.65);
    }
    if (keys.has('ArrowDown')) {
      if (firstPerson) firstPitch = Math.max(-0.9, firstPitch - dt);
      else elevation = Math.max(0.40, elevation - dt * 0.65);
    }
    let side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + stick.x;
    let forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) - stick.y;
    const magnitude = Math.hypot(side, forward);
    if (magnitude > 1) { side /= magnitude; forward /= magnitude; }
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 6 : 4;
    const dx = (Math.cos(orbitYaw) * side - Math.sin(orbitYaw) * forward) * speed * dt;
    const dz = (-Math.sin(orbitYaw) * side - Math.cos(orbitYaw) * forward) * speed * dt;
    const previousX = position.x;
    const previousZ = position.z;
    const bounds = world.bounds || { minX: -13, maxX: 13, minZ: -7, maxZ: 7.5 };
    const nextX = THREE.MathUtils.clamp(position.x + dx, bounds.minX + 0.35, bounds.maxX - 0.35);
    if (!blocked(nextX, position.z)) position.x = nextX;
    const nextZ = THREE.MathUtils.clamp(position.z + dz, bounds.minZ + 0.35, bounds.maxZ - 0.35);
    if (!blocked(position.x, nextZ)) position.z = nextZ;
    moving = Math.hypot(position.x - previousX, position.z - previousZ) > 0.0001;
    if (moving) {
      moved = true;
      teacherYaw = Math.atan2(position.x - previousX, position.z - previousZ);
      gait += dt * (speed === 6 ? 14 : 10);
      onMove?.(position, dt);
    }
    if (model) {
      model.position.copy(position);
      const delta = Math.atan2(Math.sin(teacherYaw - model.rotation.y), Math.cos(teacherYaw - model.rotation.y));
      model.rotation.y += delta * Math.min(1, dt * 14);
      const legs = model.userData?.legs;
      if (Array.isArray(legs)) legs.forEach((leg, index) => {
        if (leg?.rotation) leg.rotation.x = moving ? Math.sin(gait + index * Math.PI) * 0.45 : 0;
      });
      const arms=model.userData?.arms;
      if(Array.isArray(arms)) arms.forEach((arm,index)=>{
        if(arm?.rotation)arm.rotation.x=moving?-Math.sin(gait+index*Math.PI)*0.35:0;
      });
    }
    updateCamera(dt);
  }

  function setActive(value) {
    enabled = !!value;
    if (!enabled) clearInput();
  }

  function setView(value) {
    firstPerson = !!value;
    if (model) model.visible = !firstPerson;
    clearInput();
    updateCamera(0, true);
  }

  function resetCamera() {
    orbitYaw = 0;
    elevation = 0.72;
    firstPitch = 0;
    updateCamera(0, true);
  }

  return {
    position,
    get yaw() { return orbitYaw; },
    get moving() { return moving; },
    get moved() { return moved; },
    get firstPerson() { return firstPerson; },
    get floor() { return currentFloor; },
    setFloor(floor) {
      currentFloor = THREE.MathUtils.clamp(Math.round(Number(floor) || 5), 1, 5);
      const point = world.spawn(currentFloor);
      teleport(point);
    },
    teleport,
    update,
    setActive,
    setView,
    resetCamera,
    focusOn(target,dt){
      if(!focusStarted){camera.getWorldDirection(focusTarget);focusTarget.multiplyScalar(10).add(camera.position);focusStarted=true;}
      const p=target.getWorldPosition?target.getWorldPosition(new THREE.Vector3()):target.clone();
      p.y+=1.6;focusTarget.lerp(p,1-Math.exp(-7*dt));camera.lookAt(focusTarget);
    },
    dispose() {
      clearInput();
      listeners.forEach(remove => remove());
      disposed = true;
    }
  };
}
