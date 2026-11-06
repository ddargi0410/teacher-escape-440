import * as THREE from './vendor/three.module.js';
import { WALK_CAMERA, OVERVIEW_CAMERA, keepCameraClear, validCameraPose } from './camera-rig.js?v=20261106-immersive1';

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
  const cameraOrigin = new THREE.Vector3();
  const safeCamera = new THREE.Vector3();
  const restTarget = new THREE.Vector3();
  const actorCameraPosition = new THREE.Vector3();
  const actorCameraScale = new THREE.Vector3();
  const hiddenRenderBodies = [];
  let focusStarted = false;
  let restingCameraId = null;
  const stick = { x: 0, y: 0 };
  let enabled = true;
  let cameraMode = 'shoulder';
  let firstPerson = false;
  let orbitYaw = WALK_CAMERA.yaw;
  let elevation = WALK_CAMERA.elevation;
  let cameraDistance = WALK_CAMERA.distance;
  let shoulderTooClose = false;
  let firstPitch = 0;
  const modeViews = {
    shoulder:{yaw:WALK_CAMERA.yaw,elevation:WALK_CAMERA.elevation,distance:WALK_CAMERA.distance,pitch:0},
    overview:{yaw:OVERVIEW_CAMERA.yaw,elevation:OVERVIEW_CAMERA.elevation,distance:OVERVIEW_CAMERA.distance,pitch:0},
    first:{yaw:WALK_CAMERA.yaw,elevation:WALK_CAMERA.elevation,distance:WALK_CAMERA.distance,pitch:0}
  };
  let teacherYaw = Math.PI / 2;
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
    // A paused walking controller must not straighten a sleeping character's
    // knees and arms each frame. The bed owns those joint poses until standing.
    if (model?.userData?.restingBed) return;
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
    else if(cameraMode==='overview') elevation = THREE.MathUtils.clamp(elevation + dy * .004, .40, 1.13);
    else elevation = THREE.MathUtils.clamp(elevation + dy * 0.003, -.08, .45);
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
  listen(canvas, 'wheel', event => {
    if (!enabled || firstPerson || !Number.isFinite(event.deltaY)) return;
    event.preventDefault();
    const rig = cameraMode==='overview' ? OVERVIEW_CAMERA : WALK_CAMERA;
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * (cameraMode==='overview'?.012:.004), rig.minDistance, rig.maxDistance);
  }, { passive: false });

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
    restingCameraId = null;
    const fov = firstPerson ? 68 : cameraMode==='overview' ? OVERVIEW_CAMERA.fov : WALK_CAMERA.fov;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (firstPerson) {
      desiredCamera.set(position.x, position.y + 1.66, position.z);
      lookTarget.set(
        position.x - Math.sin(orbitYaw) * Math.cos(firstPitch),
        position.y + 1.66 + Math.sin(firstPitch),
        position.z - Math.cos(orbitYaw) * Math.cos(firstPitch)
      );
    } else if(cameraMode==='overview') {
      lookTarget.set(position.x,position.y+OVERVIEW_CAMERA.targetHeight,position.z);
      desiredCamera.set(
        position.x+Math.sin(orbitYaw)*Math.cos(elevation)*cameraDistance,
        position.y+OVERVIEW_CAMERA.targetHeight+Math.sin(elevation)*cameraDistance,
        position.z+Math.cos(orbitYaw)*Math.cos(elevation)*cameraDistance
      );
    } else {
      const distance = cameraDistance;
      const rightX = Math.cos(orbitYaw), rightZ = -Math.sin(orbitYaw);
      cameraOrigin.set(position.x, position.y + WALK_CAMERA.targetHeight, position.z);
      lookTarget.set(position.x + rightX * .28, position.y + WALK_CAMERA.targetHeight, position.z + rightZ * .28);
      desiredCamera.set(
        position.x + rightX * WALK_CAMERA.shoulder + Math.sin(orbitYaw) * Math.cos(elevation) * distance,
        position.y + WALK_CAMERA.targetHeight + Math.sin(elevation) * distance,
        position.z + rightZ * WALK_CAMERA.shoulder + Math.cos(orbitYaw) * Math.cos(elevation) * distance
      );
      keepCameraClear(cameraOrigin, desiredCamera, getCameraColliders(), desiredCamera);
    }
    if (snap || firstPerson) camera.position.copy(desiredCamera);
    else camera.position.lerp(desiredCamera, 1 - Math.exp(-9 * dt));
    // A safe destination alone is not enough: smoothing around a corner must
    // also stay on this side of its wall rather than crossing through it.
    if (cameraMode==='shoulder') {
      keepCameraClear(cameraOrigin, camera.position, getCameraColliders(), camera.position);
      const clearance=camera.position.distanceTo(cameraOrigin);
      // A wall can compress the camera into the teacher's head. Temporarily
      // use a clear near-person view; hysteresis prevents flicker at the edge.
      shoulderTooClose=shoulderTooClose ? clearance<2.1 : clearance<1.85;
      const closeBlend=THREE.MathUtils.clamp((2.1-clearance)/.8,0,1);
      lookTarget.x-=Math.sin(orbitYaw)*.6*closeBlend;
      lookTarget.z-=Math.cos(orbitYaw)*.6*closeBlend;
      lookTarget.y+=.3*closeBlend;
    } else shoulderTooClose=false;
    if (model) model.visible = cameraMode==='overview' || (cameraMode==='shoulder'&&!shoulderTooClose);
    camera.lookAt(lookTarget);
  }

  function getCameraColliders() {
    const colliders = world.cameraColliders;
    if (Array.isArray(colliders)) return colliders;
    const base = (currentFloor - 1) * 4;
    return (world.colliders || []).filter(c => c.blocksSight !== false).map(c => ({ ...c, minY: base, maxY: base + 3.5 }));
  }

  function updateRestCamera(bed, dt, { snap = false } = {}) {
    if (disposed || !validCameraPose(bed?.cameraPose)) return false;
    const pose = bed.cameraPose;
    const step = Math.max(0, Math.min(Number(dt) || 0, .1));
    if (restingCameraId !== bed.id) {
      restingCameraId = bed.id;
      world.setCameraMode?.('shoulder');
      camera.getWorldDirection(restTarget).multiplyScalar(4).add(camera.position);
      focusStarted = false;
    }
    desiredCamera.set(pose.position.x, pose.position.y, pose.position.z);
    cameraOrigin.set(pose.target.x, pose.target.y, pose.target.z);
    keepCameraClear(cameraOrigin, desiredCamera, getCameraColliders(), safeCamera, .14);
    const blend = snap ? 1 : 1 - Math.exp(-3.2 * step);
    camera.position.lerp(safeCamera, blend);
    // Rest transitions cannot travel through partitions or the outside facade.
    keepCameraClear(cameraOrigin, camera.position, getCameraColliders(), camera.position, .14);
    restTarget.lerp(cameraOrigin, blend);
    const fov = THREE.MathUtils.clamp(Number(pose.fov) || 58, 48, 64);
    if (Math.abs(camera.fov - fov) > .01) {
      camera.fov += (fov - camera.fov) * blend;
      camera.updateProjectionMatrix();
    }
    if (model) model.visible = true;
    camera.lookAt(restTarget);
    return true;
  }

  function teleport(point, { preserveCamera = false, lookYaw } = {}) {
    clearInput();
    if (Number.isFinite(lookYaw)) orbitYaw = lookYaw;
    position.set(Number(point.x) || 0, Number(point.y) || 0, Number(point.z) || 0);
    model?.position.copy(position);
    if (!preserveCamera) updateCamera(0, true);
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
      else elevation = Math.min(cameraMode==='overview'?1.13:.45, elevation + dt * (cameraMode==='overview'?.65:.45));
    }
    if (keys.has('ArrowDown')) {
      if (firstPerson) firstPitch = Math.max(-0.9, firstPitch - dt);
      else elevation = Math.max(cameraMode==='overview'?.40:-.08, elevation - dt * (cameraMode==='overview'?.65:.45));
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
    const wasEnabled = enabled;
    enabled = !!value;
    if (!enabled && (wasEnabled || keys.size || drag || stickPointer !== null)) clearInput();
  }

  function setView(value) {
    return setCameraMode(value ? 'first' : 'shoulder');
  }

  function setCameraMode(value) {
    if(!Object.hasOwn(modeViews,value))return false;
    modeViews[cameraMode]={yaw:orbitYaw,elevation,distance:cameraDistance,pitch:firstPitch};
    const selected=modeViews[value];cameraMode=value;firstPerson=value==='first';
    orbitYaw=selected.yaw;elevation=selected.elevation;cameraDistance=selected.distance;firstPitch=selected.pitch;
    world.setCameraMode?.(value);
    clearInput();
    updateCamera(0, true);
    return true;
  }

  function resetCamera() {
    const rig=cameraMode==='overview'?OVERVIEW_CAMERA:WALK_CAMERA;
    orbitYaw = rig.yaw;
    elevation = rig.elevation;
    cameraDistance = rig.distance;
    firstPitch = 0;
    updateCamera(0, true);
  }

  function withCameraOcclusion(render) {
    // Only hide the render subtree, and only for the synchronous draw. Patrol,
    // encounters, interaction targeting and other systems still see the actor.
    try {
      if (cameraMode === 'shoulder' && !restingCameraId) {
        for (const actor of world.characters || []) {
          const actorModel=actor.model;
          if (!actorModel?.visible || actor.floor!==currentFloor) continue;
          const body=actorModel.userData?.body||actorModel.getObjectByName?.('character-body');
          if (!body?.visible) continue;
          actorModel.getWorldPosition(actorCameraPosition);
          actorModel.getWorldScale(actorCameraScale);
          const actorScale=Math.max(Math.abs(actorCameraScale.x),Math.abs(actorCameraScale.y),Math.abs(actorCameraScale.z));
          const lensDistance=Math.hypot(actorCameraPosition.x-camera.position.x,actorCameraPosition.z-camera.position.z);
          if (lensDistance>1.65*actorScale) continue;
          // Preserve readable nearby conversations, but not a face occupying
          // the lens. The generous scale-aware radius also catches adult heads
          // at the screen edge before they fill half the view.
          const playerDistance=Math.hypot(actorCameraPosition.x-position.x,actorCameraPosition.z-position.z);
          if (playerDistance<1.2&&lensDistance>1.1*actorScale) continue;
          if (camera.position.y<actorCameraPosition.y-.2 || camera.position.y>actorCameraPosition.y+2.35*actorCameraScale.y+.35) continue;
          body.visible=false;hiddenRenderBodies.push(body);
        }
      }
      return render();
    } finally {
      for (const body of hiddenRenderBodies) body.visible=true;
      hiddenRenderBodies.length=0;
    }
  }

  return {
    position,
    get yaw() { return orbitYaw; },
    get moving() { return moving; },
    get moved() { return moved; },
    get firstPerson() { return firstPerson; },
    get cameraMode() { return cameraMode; },
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
    setCameraMode,
    resetCamera,
    updateRestCamera,
    withCameraOcclusion,
    endRestCamera() { restingCameraId = null; focusStarted = false; world.setCameraMode?.(cameraMode); },
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
