import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../../core/geometry/buffer-geometry';
import {
  BATTLEFIELD_ARROW_CAPACITY,
  BATTLEFIELD_PERMANENT_ARROW_CAPACITY,
} from '../population/battlefield-arrow-population';
import { BATTLEFIELD_MAXIMUM_TETHER_COUNT } from '../population/battlefield-arrow-tether-system';

export const BATTLEFIELD_ARROW_VERTICES_PER_SLOT = 18;
export const BATTLEFIELD_TETHER_VERTICES_PER_SLOT = 12;
export const BATTLEFIELD_TETHER_MARKER_VERTICES_PER_SLOT = 24;
export const BATTLEFIELD_QUIVER_VERTEX_COUNT = 36;
export const BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT =
  BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT
  + BATTLEFIELD_MAXIMUM_TETHER_COUNT * BATTLEFIELD_TETHER_VERTICES_PER_SLOT
  + BATTLEFIELD_PERMANENT_ARROW_CAPACITY * BATTLEFIELD_TETHER_MARKER_VERTICES_PER_SLOT
  + BATTLEFIELD_QUIVER_VERTEX_COUNT;
const QUIVER_SEGMENT_SCALES = new Float32Array([0.93, 1.08, 0.97, 1.05, 0.9, 1.02]);
const QUIVER_SEGMENT_COSINES = createQuiverTrigTable(Math.cos);
const QUIVER_SEGMENT_SINES = createQuiverTrigTable(Math.sin);

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
  visualScale: number,
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
  const sz = Math.abs(dy) > 0.9 ? 0 : -dx;
  const shaftEndX = x - dx * 0.72 * visualScale;
  const shaftEndY = y - dy * 0.72 * visualScale;
  const shaftEndZ = z - dz * 0.72 * visualScale;
  const tipX = x + dx * 0.24 * visualScale;
  const tipY = y + dy * 0.24 * visualScale;
  const tipZ = z + dz * 0.24 * visualScale;
  const width = visualScale;
  let vertex = first;
  vertex = writeQuadXYZ(geometry, vertex,
    x + sx * 0.035 * width, y, z + sz * 0.035 * width,
    x - sx * 0.035 * width, y, z - sz * 0.035 * width,
    shaftEndX - sx * 0.022 * width, shaftEndY, shaftEndZ - sz * 0.022 * width,
    shaftEndX + sx * 0.022 * width, shaftEndY, shaftEndZ + sz * 0.022 * width,
    0.48, 0.25, 0.07);
  vertex = writeQuadXYZ(geometry, vertex,
    x, y + 0.035 * width, z,
    x, y - 0.035 * width, z,
    shaftEndX, shaftEndY - 0.022 * width, shaftEndZ,
    shaftEndX, shaftEndY + 0.022 * width, shaftEndZ,
    0.31, 0.13, 0.035);
  vertex = writeTriangleXYZ(geometry, vertex,
    x + sx * 0.13 * width, y, z + sz * 0.13 * width,
    x - sx * 0.11 * width, y, z - sz * 0.11 * width,
    tipX, tipY, tipZ,
    0.92, 0.48, 0.09);
  writeTriangleXYZ(geometry, vertex,
    x, y + 0.12 * width, z,
    x, y - 0.1 * width, z,
    tipX, tipY, tipZ,
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
  halfWidth: number,
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
  const sideX = dz * inverse * halfWidth;
  const sideZ = -dx * inverse * halfWidth;
  const raisedStartY = startY + 0.06;
  const raisedEndY = endY + 0.06;
  writeQuadXYZ(geometry, first,
    startX + sideX, raisedStartY, startZ + sideZ,
    startX - sideX, raisedStartY, startZ - sideZ,
    endX - sideX, raisedEndY, endZ - sideZ,
    endX + sideX, raisedEndY, endZ + sideZ,
    0.3, 0.88, 0.92);
  writeQuadXYZ(geometry, first + 6,
    startX, raisedStartY + halfWidth, startZ,
    startX, raisedStartY - halfWidth, startZ,
    endX, raisedEndY - halfWidth, endZ,
    endX, raisedEndY + halfWidth, endZ,
    0.22, 0.76, 0.94);
}

/** 在猎场织网期间写入可从远处辨认的八面锚点。 */
export function writeBattlefieldTetherMarker(
  geometry: UnlitColorBufferGeometry,
  slot: number,
  x: number,
  y: number,
  z: number,
  visible: boolean,
): void {
  const first = BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT
    + BATTLEFIELD_MAXIMUM_TETHER_COUNT * BATTLEFIELD_TETHER_VERTICES_PER_SLOT
    + slot * BATTLEFIELD_TETHER_MARKER_VERTICES_PER_SLOT;
  if (!visible) {
    collapse(geometry, first, BATTLEFIELD_TETHER_MARKER_VERTICES_PER_SLOT, x, y, z);
    return;
  }
  const topY = y + 0.48;
  const bottomY = y + 0.04;
  const middleY = y + 0.25;
  let vertex = first;
  vertex = writeTriangleXYZ(geometry, vertex, x, topY, z, x + 0.16, middleY, z,
    x, middleY, z + 0.16, 0.18, 0.96, 1);
  vertex = writeTriangleXYZ(geometry, vertex, x, topY, z, x, middleY, z + 0.16,
    x - 0.16, middleY, z, 0.12, 0.72, 0.96);
  vertex = writeTriangleXYZ(geometry, vertex, x, topY, z, x - 0.16, middleY, z,
    x, middleY, z - 0.16, 0.18, 0.96, 1);
  vertex = writeTriangleXYZ(geometry, vertex, x, topY, z, x, middleY, z - 0.16,
    x + 0.16, middleY, z, 0.12, 0.72, 0.96);
  vertex = writeTriangleXYZ(geometry, vertex, x, bottomY, z, x, middleY, z + 0.16,
    x + 0.16, middleY, z, 0.1, 0.62, 0.84);
  vertex = writeTriangleXYZ(geometry, vertex, x, bottomY, z, x - 0.16, middleY, z,
    x, middleY, z + 0.16, 0.16, 0.86, 0.92);
  vertex = writeTriangleXYZ(geometry, vertex, x, bottomY, z, x, middleY, z - 0.16,
    x - 0.16, middleY, z, 0.1, 0.62, 0.84);
  writeTriangleXYZ(geometry, vertex, x, bottomY, z, x + 0.16, middleY, z,
    x, middleY, z - 0.16, 0.16, 0.86, 0.92);
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
    + BATTLEFIELD_MAXIMUM_TETHER_COUNT * BATTLEFIELD_TETHER_VERTICES_PER_SLOT
    + BATTLEFIELD_PERMANENT_ARROW_CAPACITY * BATTLEFIELD_TETHER_MARKER_VERTICES_PER_SLOT;
  let vertex = first;
  for (let segment = 0; segment < 6; segment++) {
    const next = (segment + 1) % 6;
    const lowerRadiusA = 0.15 * (QUIVER_SEGMENT_SCALES[segment] ?? 1);
    const lowerRadiusB = 0.15 * (QUIVER_SEGMENT_SCALES[next] ?? 1);
    const upperRadiusA = 0.23 * (QUIVER_SEGMENT_SCALES[segment] ?? 1);
    const upperRadiusB = 0.23 * (QUIVER_SEGMENT_SCALES[next] ?? 1);
    const lowerSideA = (QUIVER_SEGMENT_COSINES[segment] ?? 0) * lowerRadiusA;
    const lowerDepthA = (QUIVER_SEGMENT_SINES[segment] ?? 0) * lowerRadiusA;
    const lowerSideB = (QUIVER_SEGMENT_COSINES[next] ?? 0) * lowerRadiusB;
    const lowerDepthB = (QUIVER_SEGMENT_SINES[next] ?? 0) * lowerRadiusB;
    const upperSideA = (QUIVER_SEGMENT_COSINES[segment] ?? 0) * upperRadiusA;
    const upperDepthA = (QUIVER_SEGMENT_SINES[segment] ?? 0) * upperRadiusA;
    const upperSideB = (QUIVER_SEGMENT_COSINES[next] ?? 0) * upperRadiusB;
    const upperDepthB = (QUIVER_SEGMENT_SINES[next] ?? 0) * upperRadiusB;
    const upperCenterX = centerX - forwardX * 0.08;
    const upperCenterZ = centerZ - forwardZ * 0.08;
    vertex = writeQuadXYZ(geometry, vertex,
      centerX + rightX * lowerSideA + forwardX * lowerDepthA,
      bottomY,
      centerZ + rightZ * lowerSideA + forwardZ * lowerDepthA,
      centerX + rightX * lowerSideB + forwardX * lowerDepthB,
      bottomY,
      centerZ + rightZ * lowerSideB + forwardZ * lowerDepthB,
      upperCenterX + rightX * upperSideB + forwardX * upperDepthB,
      bottomY + 1.08,
      upperCenterZ + rightZ * upperSideB + forwardZ * upperDepthB,
      upperCenterX + rightX * upperSideA + forwardX * upperDepthA,
      bottomY + 1.08,
      upperCenterZ + rightZ * upperSideA + forwardZ * upperDepthA,
      segment % 2 === 0 ? 0.25 : 0.16,
      segment % 2 === 0 ? 0.095 : 0.055,
      0.025,
    );
  }
}

function writeQuadXYZ(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  dx: number, dy: number, dz: number,
  red: number, green: number, blue: number,
): number {
  writeVertexXYZ(geometry, vertex, ax, ay, az, red, green, blue);
  writeVertexXYZ(geometry, vertex + 1, bx, by, bz, red, green, blue);
  writeVertexXYZ(geometry, vertex + 2, cx, cy, cz, red, green, blue);
  writeVertexXYZ(geometry, vertex + 3, ax, ay, az, red, green, blue);
  writeVertexXYZ(geometry, vertex + 4, cx, cy, cz, red, green, blue);
  writeVertexXYZ(geometry, vertex + 5, dx, dy, dz, red, green, blue);
  return vertex + 6;
}

function writeTriangleXYZ(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  red: number, green: number, blue: number,
): number {
  writeVertexXYZ(geometry, vertex, ax, ay, az, red, green, blue);
  writeVertexXYZ(geometry, vertex + 1, bx, by, bz, red, green, blue);
  writeVertexXYZ(geometry, vertex + 2, cx, cy, cz, red, green, blue);
  return vertex + 3;
}

function writeVertexXYZ(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  x: number,
  y: number,
  z: number,
  red: number,
  green: number,
  blue: number,
): void {
  const position = vertex * 3;
  geometry.positions[position] = x;
  geometry.positions[position + 1] = y;
  geometry.positions[position + 2] = z;
  const color = vertex * 4;
  geometry.colors[color] = red;
  geometry.colors[color + 1] = green;
  geometry.colors[color + 2] = blue;
  geometry.colors[color + 3] = 1;
}

function createQuiverTrigTable(operation: (angle: number) => number): Float32Array {
  const values = new Float32Array(6);
  for (let segment = 0; segment < values.length; segment++) {
    values[segment] = operation(segment / values.length * Math.PI * 2 + 0.11);
  }
  return values;
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
