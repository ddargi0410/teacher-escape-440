// Floor travel always uses one adjacent flight of the central staircase.
export function adjacentFloors(floor) {
  return [floor + 1, floor - 1].filter(next => Number.isInteger(next) && next >= 1 && next <= 5);
}
export function canUseStairs(from, to) {
  return Number.isInteger(from) && from >= 1 && from <= 5 && adjacentFloors(from).includes(to);
}
