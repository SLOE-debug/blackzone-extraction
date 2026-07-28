import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../../core/geometry/buffer-geometry';
import { BATTLEFIELD_ARROW_CAPACITY } from '../population/battlefield-arrow-population';
import { BATTLEFIELD_MAXIMUM_TETHER_COUNT } from '../population/battlefield-arrow-tether-system';

export const BATTLEFIELD_ARROW_VERTICES_PER_SLOT = 18;
export const BATTLEFIELD_TETHER_VERTICES_PER_SLOT = 6;
export const BATTLEFIELD_QUIVER_VERTEX_COUNT = 36;
export const BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT =
  BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT
  + BATTLEFIELD_MAXIMUM_TETHER_COUNT * BATTLEFIELD_TETHER_VERTICES_PER_SLOT
  + BATTLEFIELD_QUIVER_VERTEX_COUNT;

/** 创建箭体与弦线共享的固定非索引动态拓扑。 */
export function createBattlefieldArrowBatchGeometry(): UnlitColorBufferGeometry {
  const geometry = createUnlitColorGeometry(
    BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT,
    BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT,
    GeometryIndexFormat.Uint32,
  );
  for (let vertex = 0; vertex < BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT; vertex++) {
    geometry.index[vertex] = vertex;
  }
  geometry.commitCounts(BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT, BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT);
  return geometry;
}

/** 原地写入双分面箭杆和不对称箭头。 */
export function writeBattlefieldArrow(
  geometry: UnlitColorBufferGeometry,
  slot: number,
  x: number,
  y: number,
  z: number,
  directionX: number,
  directionY: number,
  directionZ: number,
  visible: boolean,
): void {
  const first = slot * BATTLEFIELD_ARROW_VERTICES_PER_SLOT;
  if (!visible) {
    collapse(geometry, first, BATTLEFIELD_ARROW_VERTICES_PER_SLOT, x, y, z);
    return;
  }
  const length = Math.max(0.0001, Math.hypot(directionX, directionY, directionZ));
  const dx = directionX / length;
  const dy = directionY / length;
  const dz = directionZ / length;
  const sx = Math.abs(dy) > 0.9 ? 1 : dz;
  const sy = 0;
  const sz = Math.abs(dy) > 0.9 ? 0 : -dx;
  const shaftEnd = point(x - dx * 0.72, y - dy * 0.72, z - dz * 0.72);
  const tip = point(x + dx * 0.24, y + dy * 0.24, z + dz * 0.24);
  let vertex = first;
  vertex = writeQuad(geometry, vertex,
    point(x + sx * 0.035, y + sy * 0.035, z + sz * 0.035),
    point(x - sx * 0.035, y - sy * 0.035, z - sz * 0.035),
    point(shaftEnd.x - sx * 0.022, shaftEnd.y, shaftEnd.z - sz * 0.022),
    point(shaftEnd.x + sx * 0.022, shaftEnd.y, shaftEnd.z + sz * 0.022),
    0.48, 0.25, 0.07);
  vertex = writeQuad(geometry, vertex,
    point(x, y + 0.035, z), point(x, y - 0.035, z),
    point(shaftEnd.x, shaftEnd.y - 0.022, shaftEnd.z),
    point(shaftEnd.x, shaftEnd.y + 0.022, shaftEnd.z),
    0.31, 0.13, 0.035);
  vertex = writeTriangle(geometry, vertex,
    point(x + sx * 0.13, y, z + sz * 0.13),
    point(x - sx * 0.11, y, z - sz * 0.11), tip,
    0.92, 0.48, 0.09);
  writeTriangle(geometry, vertex,
    point(x, y + 0.12, z), point(x, y - 0.1, z), tip,
    0.7, 0.29, 0.045);
}

/** 原地写入一条有厚度的弦线色带。 */
export function writeBattlefieldTether(
  geometry: UnlitColorBufferGeometry,
  slot: number,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  visible: boolean,
): void {
  const first = BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT
    + slot * BATTLEFIELD_TETHER_VERTICES_PER_SLOT;
  if (!visible) {
    collapse(geometry, first, BATTLEFIELD_TETHER_VERTICES_PER_SLOT, startX, startY, startZ);
    return;
  }
  const dx = endX - startX;
  const dz = endZ - startZ;
  const inverse = 1 / Math.max(0.0001, Math.hypot(dx, dz));
  const sideX = dz * inverse * 0.028;
  const sideZ = -dx * inverse * 0.028;
  writeQuad(geometry, first,
    point(startX + sideX, startY, startZ + sideZ),
    point(startX - sideX, startY, startZ - sideZ),
    point(endX - sideX, endY, endZ - sideZ),
    point(endX + sideX, endY, endZ + sideZ),
    0.3, 0.88, 0.92);
}

/** 原地写入背部开放式六边箭袋，低段数轮廓带固定非均匀半径。 */
export function writeBattlefieldQuiver(
  geometry: UnlitColorBufferGeometry,
  centerX: number,
  bottomY: number,
  centerZ: number,
  rightX: number,
  rightZ: number,
  forwardX: number,
  forwardZ: number,
): void {
  const first = BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT
    + BATTLEFIELD_MAXIMUM_TETHER_COUNT * BATTLEFIELD_TETHER_VERTICES_PER_SLOT;
  const segmentScales = [0.93, 1.08, 0.97, 1.05, 0.9, 1.02] as const;
  let vertex = first;
  for (let segment = 0; segment < 6; segment++) {
    const next = (segment + 1) % 6;
    const lowerA = quiverPoint(
      centerX, bottomY, centerZ, rightX, rightZ, forwardX, forwardZ,
      0.15 * segmentScales[segment], segment,
    );
    const lowerB = quiverPoint(
      centerX, bottomY, centerZ, rightX, rightZ, forwardX, forwardZ,
      0.15 * segmentScales[next], next,
    );
    const upperB = quiverPoint(
      centerX - forwardX * 0.08,
      bottomY + 1.08,
      centerZ - forwardZ * 0.08,
      rightX,
      rightZ,
      forwardX,
      forwardZ,
      0.23 * segmentScales[next],
      next,
    );
    const upperA = quiverPoint(
      centerX - forwardX * 0.08,
      bottomY + 1.08,
      centerZ - forwardZ * 0.08,
      rightX,
      rightZ,
      forwardX,
      forwardZ,
      0.23 * segmentScales[segment],
      segment,
    );
    vertex = writeQuad(
      geometry,
      vertex,
      lowerA,
      lowerB,
      upperB,
      upperA,
      segment % 2 === 0 ? 0.25 : 0.16,
      segment % 2 === 0 ? 0.095 : 0.055,
      0.025,
    );
  }
}

function quiverPoint(
  centerX: number,
  y: number,
  centerZ: number,
  rightX: number,
  rightZ: number,
  forwardX: number,
  forwardZ: number,
  radius: number,
  segment: number,
): Point {
  const angle = segment / 6 * Math.PI * 2 + 0.11;
  const side = Math.cos(angle) * radius;
  const depth = Math.sin(angle) * radius;
  return point(
    centerX + rightX * side + forwardX * depth,
    y,
    centerZ + rightZ * side + forwardZ * depth,
  );
}

interface Point { readonly x: number; readonly y: number; readonly z: number }
function point(x: number, y: number, z: number): Point { return { x, y, z }; }

function writeQuad(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  a: Point, b: Point, c: Point, d: Point,
  red: number, green: number, blue: number,
): number {
  writeVertex(geometry, vertex, a, red, green, blue);
  writeVertex(geometry, vertex + 1, b, red, green, blue);
  writeVertex(geometry, vertex + 2, c, red, green, blue);
  writeVertex(geometry, vertex + 3, a, red, green, blue);
  writeVertex(geometry, vertex + 4, c, red, green, blue);
  writeVertex(geometry, vertex + 5, d, red, green, blue);
  return vertex + 6;
}

function writeTriangle(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  a: Point, b: Point, c: Point,
  red: number, green: number, blue: number,
): number {
  writeVertex(geometry, vertex, a, red, green, blue);
  writeVertex(geometry, vertex + 1, b, red, green, blue);
  writeVertex(geometry, vertex + 2, c, red, green, blue);
  return vertex + 3;
}

function writeVertex(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  value: Point,
  red: number,
  green: number,
  blue: number,
): void {
  const position = vertex * 3;
  geometry.positions[position] = value.x;
  geometry.positions[position + 1] = value.y;
  geometry.positions[position + 2] = value.z;
  const color = vertex * 4;
  geometry.colors[color] = red;
  geometry.colors[color + 1] = green;
  geometry.colors[color + 2] = blue;
  geometry.colors[color + 3] = 1;
}

function collapse(
  geometry: UnlitColorBufferGeometry,
  first: number,
  count: number,
  x: number,
  y: number,
  z: number,
): void {
  for (let vertex = first; vertex < first + count; vertex++) {
    const offset = vertex * 3;
    geometry.positions[offset] = x;
    geometry.positions[offset + 1] = y;
    geometry.positions[offset + 2] = z;
    geometry.colors[vertex * 4 + 3] = 0;
  }
}
