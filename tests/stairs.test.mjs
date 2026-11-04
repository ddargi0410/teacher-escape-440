import test from 'node:test';
import assert from 'node:assert/strict';
import {adjacentFloors,canUseStairs} from '../stairs.js';
import {readFileSync} from 'node:fs';
test('central stairs only offer neighbouring storeys within the building',()=>{
  assert.deepEqual(adjacentFloors(1),[2]);assert.deepEqual(adjacentFloors(5),[4]);
  assert.deepEqual(adjacentFloors(3),[4,2]);
  for(let from=1;from<=5;from++)for(let to=0;to<=6;to++)assert.equal(canUseStairs(from,to),to>=1&&to<=5&&Math.abs(to-from)===1);
});
test('mission and room navigation route through the central stairs across floors',()=>{
  const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
  assert.match(source,/if\(m\.floor!==state\.floor\)return routeViaStairs/);
  assert.match(source,/if\(room\.floor!==state\.floor\)return routeViaStairs/);
  assert.match(source,/canUseStairs\(state\.floor,next\)/);
  assert.doesNotMatch(source,/function elevator\(/);
});
