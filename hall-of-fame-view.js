import * as THREE from './vendor/three.module.js';
import {getHonorTitles} from './hall-of-fame-titles.js';

const KINDS = ['fastest', 'rest'];
const CATEGORIES = {fastest: '오늘의 가장 빠른 퇴근', rest: '오늘의 가장 긴 휴식'};
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const duration = value => {
  const seconds = Math.floor(value), hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60), remainder = seconds % 60;
  return `${hours ? `${hours}시간 ` : ''}${minutes}분 ${remainder}초`;
};

export function formatHallRecord(kind, record) {
  if (!record) return '오늘의 첫 기록에 도전해 보세요';
  if (kind === 'rest') return finite(record.restSeconds) ? `오늘 누적 휴식 · ${duration(record.restSeconds)}` : '';
  if (!finite(record.schoolMinutes) || !finite(record.elapsedSeconds)) return '';
  const minutes = Math.floor(record.schoolMinutes);
  return `퇴근 ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} · 플레이 ${duration(record.elapsedSeconds)}`;
}

const overlaps = (a, b) => {
  const gap = b.gap ?? 12;
  return a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
    && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;
};
// The shoulder camera can see through corridor windows; keep award labels outdoors.
const nearHall = ({visible, floor, position, width, height}) => visible && floor === 1 && position
  && finite(width) && finite(height) && Number.isFinite(position.x) && Number.isFinite(position.z)
  && width >= 240 && height >= 300 && position.z >= 8.4 && position.z <= 17.3 && Math.abs(position.x) <= 14;

function projectBounds(bounds, camera, width, height) {
  const points = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).project(camera);
    if (Number.isFinite(point.x) && point.z >= -1 && point.z <= 1) points.push({x: (point.x * .5 + .5) * width, y: (-point.y * .5 + .5) * height});
  }
  if (!points.length) return null;
  const left = Math.max(0, Math.min(...points.map(point => point.x))), top = Math.max(0, Math.min(...points.map(point => point.y)));
  const right = Math.min(width, Math.max(...points.map(point => point.x))), bottom = Math.min(height, Math.max(...points.map(point => point.y)));
  return right > left && bottom > top ? {left, top, width: right - left, height: bottom - top} : null;
}

export function hallOfFameSceneReservations({camera, anchors, statueBounds = {}, position, width, height}) {
  const y = Number.isFinite(position.y) ? position.y : 0;
  const bounds = [{min: {x: position.x - .52, y, z: position.z - .45}, max: {x: position.x + .52, y: y + 2.75, z: position.z + .45}}];
  for (const kind of KINDS) {
    const anchor = anchors?.[kind]; if (!anchor) continue;
    const halfWidth = kind === 'rest' ? 2.0 : 1.6;
    const fallback = [
      {min: {x: anchor.x - halfWidth, y: 0, z: anchor.z - 1.5}, max: {x: anchor.x + halfWidth, y: 1.4, z: anchor.z + 1.5}},
      {min: {x: anchor.x - (kind === 'rest' ? 1.5 : .8), y: 1.4, z: anchor.z - .55}, max: {x: anchor.x + (kind === 'rest' ? 1.5 : .8), y: kind === 'rest' ? 2.8 : 4.07, z: anchor.z + .55}},
    ];
    bounds.push(...(statueBounds[kind] || fallback));
  }
  return bounds.map((box, index) => {
    const rect = projectBounds(box, camera, width, height);
    return rect ? {...rect, gap: index === 0 ? 8 : 3} : null;
  }).filter(Boolean);
}

function statueSlices(statue) {
  // Height slices preserve the real head/bed silhouette. One huge world box
  // incorrectly extends the wide pedestal footprint all the way to the head.
  const slices = new Map(), point = new THREE.Vector3();
  statue.updateWorldMatrix(true, true);
  statue.traverse(part => {
    const vertices = part.geometry?.attributes?.position;
    if (!vertices) return;
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(part.matrixWorld);
      const slice = Math.floor(point.y / .15);
      if (!slices.has(slice)) slices.set(slice, new THREE.Box3());
      slices.get(slice).expandByPoint(point);
    }
  });
  return [...slices.values()];
}

/** Place labels beside their real projected anchors; never pin offscreen statues onto the HUD. */
export function projectHallOfFameLabels({camera, anchors, visible, floor, position, width, height, sizes = {}, reservedRects = [], statueBounds = {}}) {
  if (!nearHall({visible, floor, position, width, height})) return [];
  camera.updateMatrixWorld();
  const protectedRects = [...reservedRects, ...hallOfFameSceneReservations({camera, anchors, statueBounds, position, width, height})];
  const mobile = width <= 600;
  const topInset = height < 520 ? 104 : mobile ? 156 : 128;
  const bottomInset = height < 520 ? 78 : mobile ? 142 : 126;
  const candidates = [];
  for (const kind of KINDS) {
    const anchor = anchors?.[kind];
    if (!anchor || !finite(Math.abs(anchor.x)) || !finite(Math.abs(anchor.y)) || !finite(Math.abs(anchor.z))) continue;
    const distance = Math.hypot(position.x - anchor.x, position.z - anchor.z);
    if (distance > 18) continue;
    const point = new THREE.Vector3(anchor.x, anchor.y, anchor.z).project(camera);
    if (!Number.isFinite(point.x) || point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
    candidates.push({kind, distance, x: (point.x * .5 + .5) * width, y: (-point.y * .5 + .5) * height});
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const placed = [];
  for (const item of candidates) {
    const cardWidth = Math.min(sizes[item.kind]?.width || (mobile ? 245 : 310), width - 24);
    const cardHeight = sizes[item.kind]?.height || 164;
    const naturalLeft = item.x - cardWidth / 2;
    // Keep a visible edge anchor attached while fitting its card inside the screen.
    const lefts = [naturalLeft, Math.max(6, Math.min(width - cardWidth - 6, naturalLeft))];
    for (const reserved of protectedRects) lefts.push(reserved.left - cardWidth - 12, reserved.left + reserved.width + 12);
    const visibleLefts = [...new Set(lefts)].filter(left => left >= 6 && left + cardWidth <= width - 6
      && item.x >= left + 16 && item.x <= left + cardWidth - 16);
    if (!visibleLefts.length) continue;
    const above = [item.y - cardHeight - 14, ...protectedRects.map(rectangle => rectangle.top - cardHeight - (rectangle.gap ?? 12) - 1)]
      .filter(top => top + cardHeight <= item.y - 14).sort((a, b) => b - a);
    const below = [item.y + 14, ...protectedRects.map(rectangle => rectangle.top + rectangle.height + (rectangle.gap ?? 12) + 1)]
      .filter(top => top >= item.y + 14).sort((a, b) => a - b);
    const options = [...new Set(above)].map(top => ({top, side: 'above'}))
      .concat([...new Set(below)].map(top => ({top, side: 'below'})));
    let match = null;
    for (const option of options) {
      for (const left of visibleLefts) {
        const rectangle = {kind: item.kind, left, top: option.top, width: cardWidth, height: cardHeight, side: option.side, anchorX: item.x, anchorY: item.y};
        if (rectangle.top < topInset || rectangle.top + cardHeight > height - bottomInset) continue;
        if ([...placed, ...protectedRects].some(other => overlaps(rectangle, other))) continue;
        match = rectangle; break;
      }
      if (match) break;
    }
    if (match) placed.push(match);
  }
  return placed;
}

export function createHallOfFameView({camera, world}) {
  const statueBounds = {};
  for (const kind of KINDS) if (world?.hallOfFameStatues?.[kind]?.isObject3D)
    statueBounds[kind] = statueSlices(world.hallOfFameStatues[kind]);
  const layer = document.createElement('section');
  layer.className = 'hall-of-fame-labels'; layer.hidden = true;
  layer.setAttribute('aria-label', '오늘의 명예의 전당');
  const cards = new Map();
  for (const kind of KINDS) {
    const element = document.createElement('article');
    element.className = `hall-of-fame-plate hall-of-fame-${kind}`;
    element.hidden = true;
    const category = document.createElement('p'); category.className = 'hall-of-fame-category';
    const title = document.createElement('p'); title.className = 'hall-of-fame-title';
    const nickname = document.createElement('strong'); nickname.className = 'hall-of-fame-nickname';
    const record = document.createElement('p'); record.className = 'hall-of-fame-record';
    element.append(category, title, nickname, record); layer.append(element);
    cards.set(kind, {element, category, title, nickname, record});
  }
  document.body.append(layer);
  let data = null, status = 'loading', disposed = false, measuredSizes = null, measuredViewport = '', reservedRects = [];

  function render() {
    measuredSizes = null;
    const titles = getHonorTitles(status === 'ready' ? data?.date : undefined);
    for (const [kind, card] of cards) {
      const winner = status === 'ready' ? data?.[kind] : null;
      const nickname = typeof winner?.nickname === 'string' ? Array.from(winner.nickname.trim()).slice(0, 24).join('') : '';
      const date = status === 'ready' && /^\d{4}-\d{2}-\d{2}$/.test(data?.date || '') ? `${data.date.slice(5).replace('-', '.')} · ` : '';
      card.category.textContent = date + CATEGORIES[kind];
      card.title.textContent = titles[kind];
      card.nickname.textContent = status === 'loading' ? '기록 확인 중…' : status === 'error'
        ? '잠시 후 다시 확인해요' : nickname || '첫 주인공을 기다려요';
      card.element.classList.toggle('hall-of-fame-waiting', !nickname);
      card.element.classList.toggle('hall-of-fame-long', Array.from(nickname).length > 12);
      card.record.textContent = status === 'loading' ? '오늘의 주인공을 찾고 있어요' : status === 'error'
        ? '연결되면 오늘 기록을 다시 불러와요' : formatHallRecord(kind, nickname ? winner : null);
    }
  }
  render();

  return {
    setData(value) { if (disposed) return; data = value && typeof value === 'object' ? value : null; status = 'ready'; render(); },
    setStatus(value) { if (disposed || !['loading', 'ready', 'error'].includes(value)) return; status = value; render(); },
    update({visible = true, floor = world?.floor, position} = {}) {
      if (disposed) return;
      const width = globalThis.innerWidth || 0, height = globalThis.innerHeight || 0;
      layer.hidden = !nearHall({visible, floor, position, width, height});
      if (layer.hidden) return;
      const viewport = `${width}:${height}`;
      if (!measuredSizes || measuredViewport !== viewport) {
        measuredSizes = {}; measuredViewport = viewport;
        // Re-measure only after data or viewport changes, not on every animation frame.
        for (const [kind, card] of cards) {
          card.element.hidden = false;
          const bounds = card.element.getBoundingClientRect();
          measuredSizes[kind] = {width: bounds.width || (width <= 600 ? 245 : 310), height: bounds.height || 164};
        }
        const floorRail = document.querySelector?.('.floor-rail')?.getBoundingClientRect();
        reservedRects = floorRail?.width && floorRail?.height ? [floorRail] : [];
        for (const panel of document.querySelectorAll?.('.hud-top > div') || []) {
          const bounds = panel.getBoundingClientRect();
          if (bounds.width && bounds.height) reservedRects.push(bounds);
        }
      }
      const placements = projectHallOfFameLabels({camera, anchors: world?.hallOfFameAnchors, statueBounds, visible, floor, position, width, height, sizes: measuredSizes, reservedRects});
      for (const [kind, card] of cards) {
        const placement = placements.find(item => item.kind === kind);
        card.element.hidden = !placement;
        if (placement) {
          card.element.style.left = `${placement.left}px`;
          card.element.style.top = `${placement.top}px`;
          card.element.style.setProperty('--hall-pointer-x', `${placement.anchorX - placement.left}px`);
          card.element.style.setProperty('--hall-line-height', `${Math.max(0, placement.side === 'above'
            ? placement.anchorY - placement.top - placement.height - 9 : placement.top - placement.anchorY - 9)}px`);
          card.element.dataset.side = placement.side;
        }
      }
      layer.hidden = placements.length === 0;
    },
    dispose() { if (disposed) return; disposed = true; layer.remove(); cards.clear(); },
  };
}
