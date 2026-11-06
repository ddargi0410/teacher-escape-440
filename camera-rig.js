/** Keep the shoulder camera on the player's side of solid school surfaces. */
export const WALK_CAMERA = Object.freeze({ distance: 4.6, minDistance: 3.0, maxDistance: 6.2, yaw: -Math.PI / 2, elevation: .14, targetHeight: 1.35, shoulder: .48, fov: 62 });
export const OVERVIEW_CAMERA = Object.freeze({ distance:17.7, minDistance:12, maxDistance:24, yaw:0, elevation:.72, targetHeight:.8, fov:42 });

const finite = Number.isFinite;

/** First intersection of a segment with an expanded, height-aware AABB. */
export function cameraHitFraction(from, to, box, padding = .18) {
  if (![box?.x, box?.z, box?.w, box?.d].every(finite) || box.w <= 0 || box.d <= 0) return null;
  const minY = finite(box.minY) ? box.minY : finite(box.y) && finite(box.h) ? box.y - box.h / 2 : -Infinity;
  const maxY = finite(box.maxY) ? box.maxY : finite(box.y) && finite(box.h) ? box.y + box.h / 2 : Infinity;
  if (minY > maxY) return null;
  const lower = [box.x - box.w / 2 - padding, minY - padding, box.z - box.d / 2 - padding];
  const upper = [box.x + box.w / 2 + padding, maxY + padding, box.z + box.d / 2 + padding];
  let enter = 0, leave = 1;
  for (let axis = 0; axis < 3; axis++) {
    const key = ['x', 'y', 'z'][axis], start = from[key], direction = to[key] - start;
    if (Math.abs(direction) < 1e-9) {
      if (start < lower[axis] || start > upper[axis]) return null;
      continue;
    }
    let a = (lower[axis] - start) / direction, b = (upper[axis] - start) / direction;
    if (a > b) [a, b] = [b, a];
    enter = Math.max(enter, a); leave = Math.min(leave, b);
    if (enter > leave) return null;
  }
  return enter;
}

/** Mutates output without allocating rays or geometry every animation frame. */
export function keepCameraClear(from, desired, colliders, output, padding = .18) {
  let fraction = 1;
  for (const box of colliders || []) {
    const hit = cameraHitFraction(from, desired, box, padding);
    if (hit !== null) fraction = Math.min(fraction, Math.max(0, hit - .008));
  }
  output.set(
    from.x + (desired.x - from.x) * fraction,
    from.y + (desired.y - from.y) * fraction,
    from.z + (desired.z - from.z) * fraction
  );
  return fraction;
}

export function validCameraPose(pose) {
  return !!pose && ['position', 'target'].every(key => ['x', 'y', 'z'].every(axis => finite(pose[key]?.[axis])));
}
