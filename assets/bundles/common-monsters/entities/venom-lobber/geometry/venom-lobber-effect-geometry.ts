import { UnlitColorBufferGeometry } from '../../../../../core/geometry/buffer-geometry';
import { type VenomBombState } from '../model/venom-bomb-state';
import { type VenomPoolState } from '../model/venom-pool-state';
import { type VenomDeathEffectState } from '../model/venom-death-effect-state';
import {
  VENOM_POOL_VERTEX_COUNT,
  writeVenomPoolGeometry,
  writeVenomDeathResidueGeometry,
} from './venom-pool-geometry';
import { writeVenomCocoonGeometry } from './venom-cocoon-geometry';

const BOMB_VERTEX_COUNT = 24;
export const VENOM_WARNING_CIRCLE_SEGMENTS = 32;
const MARKER_SEGMENTS = VENOM_WARNING_CIRCLE_SEGMENTS;
const MARKER_VERTEX_COUNT = MARKER_SEGMENTS * 6;
const POOL_VERTEX_COUNT = VENOM_POOL_VERTEX_COUNT;
const PROJECTILE_RADIUS = 1.85;
const CHARGE_MAXIMUM_RADIUS = 2.05;
const MARKER_COSINES = createUnitCircle(MARKER_SEGMENTS, true);
const MARKER_SINES = createUnitCircle(MARKER_SEGMENTS, false);
const BOMB_TRIANGLE_VERTEX_IDS = Uint8Array.of(
  0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 2,
  1, 3, 2, 1, 4, 3, 1, 5, 4, 1, 2, 5,
);

export const VENOM_EFFECT_SLOT_VERTEX_COUNT = BOMB_VERTEX_COUNT
  + MARKER_VERTEX_COUNT
  + POOL_VERTEX_COUNT;
export const VENOM_EFFECT_SLOT_INDEX_COUNT = VENOM_EFFECT_SLOT_VERTEX_COUNT;
export const VENOM_BOMB_EFFECT_VERTEX_COUNT = BOMB_VERTEX_COUNT;
export const VENOM_WARNING_CIRCLE_VERTEX_COUNT = MARKER_VERTEX_COUNT;

/** 单一效果批次内可按活动阶段提交的实际子拓扑。 */
export enum VenomEffectTopology {
  Charge,
  Projectile,
  Pool,
}

/** 把一个效果槽真正可见的索引范围压入目标前缀。 */
export function appendVenomEffectTopologyIndices(
  target: Uint32Array,
  targetIndexOffset: number,
  slotIndex: number,
  topology: VenomEffectTopology,
): number {
  const slotVertexOffset = slotIndex * VENOM_EFFECT_SLOT_VERTEX_COUNT;
  switch (topology) {
    case VenomEffectTopology.Charge:
      return appendSequentialIndices(
        target,
        targetIndexOffset,
        slotVertexOffset,
        BOMB_VERTEX_COUNT,
      );
    case VenomEffectTopology.Projectile:
      return appendSequentialIndices(
        target,
        targetIndexOffset,
        slotVertexOffset,
        BOMB_VERTEX_COUNT + MARKER_VERTEX_COUNT,
      );
    case VenomEffectTopology.Pool:
      return appendSequentialIndices(
        target,
        targetIndexOffset,
        slotVertexOffset + BOMB_VERTEX_COUNT + MARKER_VERTEX_COUNT,
        POOL_VERTEX_COUNT,
      );
    default:
      throw new Error('Venom Lobber 效果槽包含未知拓扑。');
  }
}

/** 为可紧凑打包的毒弹、落点环和酸池创建统一固定拓扑。 */
export function createVenomEffectGeometry(
  slotCapacity: number,
): UnlitColorBufferGeometry<Uint32Array> {
  if (!Number.isInteger(slotCapacity) || slotCapacity <= 0) {
    throw new Error('Venom Lobber 效果槽位容量必须是正整数。');
  }
  const vertexCount = slotCapacity * VENOM_EFFECT_SLOT_VERTEX_COUNT;
  const geometry = new UnlitColorBufferGeometry(
    vertexCount,
    vertexCount,
    new Uint32Array(vertexCount),
  );
  for (let index = 0; index < vertexCount; index++) {
    geometry.index[index] = index;
  }
  geometry.commitCounts(vertexCount, vertexCount);
  return geometry;
}

/** 把一枚在途毒弹及其持续存在的地面落点环写入紧凑槽位。 */
export function writeVenomBombEffectSlot(
  geometry: UnlitColorBufferGeometry,
  slotIndex: number,
  bombs: VenomBombState,
  bombIndex: number,
  blastRadius: number,
): void {
  const progress = Math.max(0, Math.min(
    (bombs.elapsed[bombIndex] ?? 0) / Math.max(bombs.duration[bombIndex] ?? 1, 0.001),
    1,
  ));
  const originX = bombs.originX[bombIndex] ?? 0;
  const originY = bombs.originY[bombIndex] ?? 0;
  const targetX = bombs.targetX[bombIndex] ?? 0;
  const targetY = bombs.targetY[bombIndex] ?? 0;
  const x = originX + (targetX - originX) * progress;
  const y = originY + (targetY - originY) * progress;
  const elevation = (bombs.startElevation[bombIndex] ?? 0) * (1 - progress)
    + 4 * (bombs.arcHeight[bombIndex] ?? 0) * progress * (1 - progress)
    + 0.18 * progress;
  const pulse = PROJECTILE_RADIUS + Math.sin(progress * Math.PI * 9) * 0.09;
  const baseVertex = slotIndex * VENOM_EFFECT_SLOT_VERTEX_COUNT;
  writeBomb(geometry, baseVertex, x, y, elevation, pulse, progress);
  writeMarker(
    geometry,
    baseVertex + BOMB_VERTEX_COUNT,
    targetX,
    targetY,
    blastRadius,
  );
  collapseSection(
    geometry,
    baseVertex + BOMB_VERTEX_COUNT + MARKER_VERTEX_COUNT,
    POOL_VERTEX_COUNT,
    targetX,
    targetY,
    0.06,
  );
}

/** 把尾刺上从零到一增长的蓄力毒球写入效果槽。 */
export function writeVenomChargeEffectSlot(
  geometry: UnlitColorBufferGeometry,
  slotIndex: number,
  x: number,
  y: number,
  elevation: number,
  charge: number,
  phase: number,
): void {
  const normalizedCharge = Math.max(0, Math.min(charge, 1));
  const radius = 0.035 + CHARGE_MAXIMUM_RADIUS * normalizedCharge;
  const baseVertex = slotIndex * VENOM_EFFECT_SLOT_VERTEX_COUNT;
  writeBomb(geometry, baseVertex, x, y, elevation, radius, phase * 0.37);
  collapseSection(
    geometry,
    baseVertex + BOMB_VERTEX_COUNT,
    MARKER_VERTEX_COUNT + POOL_VERTEX_COUNT,
    x,
    y,
    elevation,
  );
}

/** 把一块酸池写入槽位，毒弹与预警子拓扑保持零面积。 */
export function writeVenomPoolEffectSlot(
  geometry: UnlitColorBufferGeometry,
  slotIndex: number,
  pools: VenomPoolState,
  poolIndex: number,
): void {
  const x = pools.x[poolIndex] ?? 0;
  const y = pools.y[poolIndex] ?? 0;
  const baseVertex = slotIndex * VENOM_EFFECT_SLOT_VERTEX_COUNT;
  collapseSection(geometry, baseVertex, BOMB_VERTEX_COUNT + MARKER_VERTEX_COUNT, x, y, 0.06);
  writeVenomPoolGeometry(
    geometry,
    baseVertex + BOMB_VERTEX_COUNT + MARKER_VERTEX_COUNT,
    x,
    y,
    pools.radius[poolIndex] ?? 0,
    pools.elapsed[poolIndex] ?? 0,
    pools.duration[poolIndex] ?? 1,
    (pools.catalyzed[poolIndex] ?? 0) !== 0,
    poolIndex,
  );
}

/** 使用固定效果槽写入毒茧土包、裂纹与六枚甲壳碎片。 */
export function writeVenomCocoonEffectSlot(
  geometry: UnlitColorBufferGeometry,
  slotIndex: number,
  x: number,
  y: number,
  radius: number,
  cocoonOpen: number,
  lifecycleLegProgress: number,
  seed: number,
): void {
  const baseVertex = slotIndex * VENOM_EFFECT_SLOT_VERTEX_COUNT;
  collapseSection(geometry, baseVertex, BOMB_VERTEX_COUNT + MARKER_VERTEX_COUNT, x, y, 0.06);
  writeVenomCocoonGeometry(
    geometry,
    baseVertex + BOMB_VERTEX_COUNT + MARKER_VERTEX_COUNT,
    x,
    y,
    radius,
    cocoonOpen,
    lifecycleLegProgress,
    seed,
  );
}

/** 使用池拓扑写入延迟出现并向中心收缩的脚印残迹。 */
export function writeVenomDeathEffectSlot(
  geometry: UnlitColorBufferGeometry,
  slotIndex: number,
  deaths: VenomDeathEffectState,
  deathIndex: number,
): void {
  const x = deaths.x[deathIndex] ?? 0;
  const y = deaths.y[deathIndex] ?? 0;
  const baseVertex = slotIndex * VENOM_EFFECT_SLOT_VERTEX_COUNT;
  collapseSection(geometry, baseVertex, BOMB_VERTEX_COUNT + MARKER_VERTEX_COUNT, x, y, 0.06);
  writeVenomDeathResidueGeometry(
    geometry,
    baseVertex + BOMB_VERTEX_COUNT + MARKER_VERTEX_COUNT,
    x,
    y,
    deaths.scale[deathIndex] ?? 1,
    deaths.elapsed[deathIndex] ?? 0,
    deaths.duration[deathIndex] ?? 1,
  );
}

function writeBomb(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  progress: number,
): void {
  const wobble = progress * Math.PI * 7;
  const wobbleSine = Math.sin(wobble);
  const wobbleCosine = Math.cos(wobble);
  for (let vertex = 0; vertex < BOMB_VERTEX_COUNT; vertex++) {
    const sourceVertex = BOMB_TRIANGLE_VERTEX_IDS[vertex];
    if (sourceVertex === undefined) {
      throw new Error('毒弹分面顶点索引越界。');
    }
    const lightFace = Math.floor(vertex / 3) % 2 === 0;
    writeBombVertex(
      geometry,
      vertexOffset + vertex,
      sourceVertex,
      x,
      y,
      z,
      radius,
      wobbleSine,
      wobbleCosine,
      lightFace,
    );
  }
}

function writeMarker(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
): void {
  const outerRadius = radius;
  const innerRadius = Math.max(0, outerRadius - Math.max(0.11, radius * 0.055));
  const z = 0.078;
  let cursor = vertexOffset;
  for (let segment = 0; segment < MARKER_SEGMENTS; segment++) {
    const next = (segment + 1) % MARKER_SEGMENTS;
    const cosineA = MARKER_COSINES[segment] ?? 1;
    const sineA = MARKER_SINES[segment] ?? 0;
    const cosineB = MARKER_COSINES[next] ?? 1;
    const sineB = MARKER_SINES[next] ?? 0;
    writeVertexCoordinates(
      geometry, cursor, x + cosineA * outerRadius, y + sineA * outerRadius, z,
      0.08, 1, 0.14, 1,
    );
    writeVertexCoordinates(
      geometry, cursor + 1, x + cosineB * outerRadius, y + sineB * outerRadius, z,
      0.08, 1, 0.14, 1,
    );
    writeVertexCoordinates(
      geometry, cursor + 2, x + cosineB * innerRadius, y + sineB * innerRadius, z,
      0.08, 1, 0.14, 1,
    );
    writeVertexCoordinates(
      geometry, cursor + 3, x + cosineA * outerRadius, y + sineA * outerRadius, z,
      0.08, 1, 0.14, 1,
    );
    writeVertexCoordinates(
      geometry, cursor + 4, x + cosineB * innerRadius, y + sineB * innerRadius, z,
      0.08, 1, 0.14, 1,
    );
    writeVertexCoordinates(
      geometry, cursor + 5, x + cosineA * innerRadius, y + sineA * innerRadius, z,
      0.08, 1, 0.14, 1,
    );
    cursor += 6;
  }
}

function collapseSection(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  vertexCount: number,
  x: number,
  y: number,
  z: number,
): void {
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const positionOffset = (vertexOffset + vertex) * 3;
    geometry.positions[positionOffset] = x;
    geometry.positions[positionOffset + 1] = y;
    geometry.positions[positionOffset + 2] = z;
    const colorOffset = (vertexOffset + vertex) * 4;
    geometry.colors[colorOffset] = 0;
    geometry.colors[colorOffset + 1] = 0;
    geometry.colors[colorOffset + 2] = 0;
    geometry.colors[colorOffset + 3] = 1;
  }
}

function writeBombVertex(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  sourceVertex: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  wobbleSine: number,
  wobbleCosine: number,
  light: boolean,
): void {
  let vertexX = x;
  let vertexY = y;
  let vertexZ = z;
  switch (sourceVertex) {
    case 0:
      vertexX += wobbleSine * 0.05;
      vertexZ += radius * 1.25;
      break;
    case 1:
      vertexY += wobbleCosine * 0.04;
      vertexZ -= radius;
      break;
    case 2:
      vertexX += radius * 1.08;
      vertexZ += radius * 0.04;
      break;
    case 3:
      vertexY += radius * 0.92;
      vertexZ -= radius * 0.03;
      break;
    case 4:
      vertexX -= radius * 0.96;
      vertexZ += radius * 0.08;
      break;
    case 5:
      vertexY -= radius * 1.04;
      vertexZ -= radius * 0.07;
      break;
    default:
      throw new Error('毒弹源顶点语义无效。');
  }
  writeVertexCoordinates(
    geometry,
    vertex,
    vertexX,
    vertexY,
    vertexZ,
    light ? 0.34 : 0.08,
    light ? 1 : 0.62,
    light ? 0.08 : 0.025,
    1,
  );
}

function writeVertexCoordinates(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  x: number,
  y: number,
  z: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): void {
  const positionOffset = vertex * 3;
  geometry.positions[positionOffset] = x;
  geometry.positions[positionOffset + 1] = y;
  geometry.positions[positionOffset + 2] = z;
  const colorOffset = vertex * 4;
  geometry.colors[colorOffset] = red;
  geometry.colors[colorOffset + 1] = green;
  geometry.colors[colorOffset + 2] = blue;
  geometry.colors[colorOffset + 3] = alpha;
}

function createUnitCircle(segments: number, cosine: boolean): Float32Array {
  const values = new Float32Array(segments);
  for (let index = 0; index < segments; index++) {
    const angle = index / segments * Math.PI * 2;
    values[index] = cosine ? Math.cos(angle) : Math.sin(angle);
  }
  return values;
}

function appendSequentialIndices(
  target: Uint32Array,
  targetOffset: number,
  firstVertex: number,
  count: number,
): number {
  for (let index = 0; index < count; index++) {
    target[targetOffset++] = firstVertex + index;
  }
  return targetOffset;
}
