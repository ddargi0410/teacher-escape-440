// Floor travel always uses one adjacent flight of the central staircase.
export function adjacentFloors(floor) {
  return [floor + 1, floor - 1].filter(next => Number.isInteger(next) && next >= 1 && next <= 5);
}
export function canUseStairs(from, to) {
  return Number.isInteger(from) && from >= 1 && from <= 5 && adjacentFloors(from).includes(to);
}

// The same opening clips both structural walls and their decorative panels.
// Keeping this in one place prevents a visible wall from covering a clear collider.
export const STAIR_OPENING_HALF_WIDTH = 2.2;
export function roomFrontWallSegments(centerX) {
  return [-1, 1].map(side => {
    const center = centerX + side * 4.3;
    const left = centerX > 0 ? Math.max(center - 2.25, STAIR_OPENING_HALF_WIDTH) : center - 2.25;
    const right = centerX < 0 ? Math.min(center + 2.25, -STAIR_OPENING_HALF_WIDTH) : center + 2.25;
    return {x:(left + right) / 2, w:right - left};
  });
}
