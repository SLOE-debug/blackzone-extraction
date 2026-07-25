import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';

const VERTICES_PER_QUAD = 6;
const BODY_SEGMENT_COUNT = 3;
const RAIL_QUAD_COUNT = BODY_SEGMENT_COUNT * 2;
const TIP_QUAD_COUNT = 1;
const RUNE_COUNT = 3;
const RUNE_QUAD_COUNT = RUNE_COUNT * 2;
const QUAD_COUNT = BODY_SEGMENT_COUNT + RAIL_QUAD_COUNT + TIP_QUAD_COUNT
  + RUNE_QUAD_COUNT;
const VERTEX_COUNT = QUAD_COUNT * VERTICES_PER_QUAD;
const PREVIEW_DISTANCE = 3.8;
const TARGET_ATTRACTION = 0.18;
const RAIL_WIDTH = 0.045;
const RUNE_WIDTH = 0.035;

const SECTION_PROGRESS = Object.freeze([0.045, 0.29, 0.66, 1]);
const LEFT_WIDTH = Object.freeze([0.16, 0.44, 0.84, 1.18]);
const RIGHT_WIDTH = Object.freeze([0.19, 0.5, 0.78, 1.26]);

/** 世界空间抓取楔形、边沿与流动符文共用的固定拓扑。 */
export function createBattlefieldActionGroundPreviewGeometry(): UnlitColorBufferGeometry {
  const geometry = createUnlitColorGeometry(
    VERTEX_COUNT,
    VERTEX_COUNT,
    GeometryIndexFormat.Uint16,
  );
  for (let vertex = 0; vertex < VERTEX_COUNT; vertex++) {
    geometry.index[vertex] = vertex;
  }
  geometry.commitCounts(VERTEX_COUNT, VERTEX_COUNT);
  return geometry;
}

/** 原地写入不规则蓝色抓取楔形，并让三组符文沿施法方向循环流动。 */
export function writeBattlefieldActionGroundPreviewGeometry(
  geometry: UnlitColorBufferGeometry,
  startX: number,
  y: number,
  startZ: number,
  directionX: number,
  directionZ: number,
  targetX: number,
  targetZ: number,
  targetLocked: boolean,
  flowPhase: number,
): void {
  const rightX = directionZ;
  const rightZ = -directionX;
  let vertex = 0;

  for (let segment = 0; segment < BODY_SEGMENT_COUNT; segment++) {
    const startProgress = requireValue(SECTION_PROGRESS, segment);
    const endProgress = requireValue(SECTION_PROGRESS, segment + 1);
    const startCenterX = calculateCenter(
      startX,
      directionX,
      targetX,
      startProgress,
      targetLocked,
    );
    const startCenterZ = calculateCenter(
      startZ,
      directionZ,
      targetZ,
      startProgress,
      targetLocked,
    );
    const endCenterX = calculateCenter(
      startX,
      directionX,
      targetX,
      endProgress,
      targetLocked,
    );
    const endCenterZ = calculateCenter(
      startZ,
      directionZ,
      targetZ,
      endProgress,
      targetLocked,
    );
    const startLeftWidth = requireValue(LEFT_WIDTH, segment);
    const startRightWidth = requireValue(RIGHT_WIDTH, segment);
    const endLeftWidth = requireValue(LEFT_WIDTH, segment + 1);
    const endRightWidth = requireValue(RIGHT_WIDTH, segment + 1);
    const alpha = 0.085 + segment * 0.028;
    vertex = writeQuad(
      geometry,
      vertex,
      startCenterX - rightX * startLeftWidth,
      startCenterZ - rightZ * startLeftWidth,
      startCenterX + rightX * startRightWidth,
      startCenterZ + rightZ * startRightWidth,
      endCenterX + rightX * endRightWidth,
      endCenterZ + rightZ * endRightWidth,
      endCenterX - rightX * endLeftWidth,
      endCenterZ - rightZ * endLeftWidth,
      y,
      targetLocked ? 0.12 : 0.08,
      targetLocked ? 0.68 : 0.42,
      targetLocked ? 1 : 0.82,
      alpha,
    );
  }

  for (let segment = 0; segment < BODY_SEGMENT_COUNT; segment++) {
    const startProgress = requireValue(SECTION_PROGRESS, segment);
    const endProgress = requireValue(SECTION_PROGRESS, segment + 1);
    const startCenterX = calculateCenter(
      startX,
      directionX,
      targetX,
      startProgress,
      targetLocked,
    );
    const startCenterZ = calculateCenter(
      startZ,
      directionZ,
      targetZ,
      startProgress,
      targetLocked,
    );
    const endCenterX = calculateCenter(
      startX,
      directionX,
      targetX,
      endProgress,
      targetLocked,
    );
    const endCenterZ = calculateCenter(
      startZ,
      directionZ,
      targetZ,
      endProgress,
      targetLocked,
    );
    const startLeftWidth = requireValue(LEFT_WIDTH, segment);
    const endLeftWidth = requireValue(LEFT_WIDTH, segment + 1);
    const startRightWidth = requireValue(RIGHT_WIDTH, segment);
    const endRightWidth = requireValue(RIGHT_WIDTH, segment + 1);
    vertex = writeRibbon(
      geometry,
      vertex,
      startCenterX - rightX * startLeftWidth,
      startCenterZ - rightZ * startLeftWidth,
      endCenterX - rightX * endLeftWidth,
      endCenterZ - rightZ * endLeftWidth,
      y + 0.004,
      RAIL_WIDTH,
      targetLocked,
    );
    vertex = writeRibbon(
      geometry,
      vertex,
      startCenterX + rightX * startRightWidth,
      startCenterZ + rightZ * startRightWidth,
      endCenterX + rightX * endRightWidth,
      endCenterZ + rightZ * endRightWidth,
      y + 0.004,
      RAIL_WIDTH,
      targetLocked,
    );
  }

  const tipProgress = requireValue(SECTION_PROGRESS, SECTION_PROGRESS.length - 1);
  const tipCenterX = calculateCenter(
    startX,
    directionX,
    targetX,
    tipProgress,
    targetLocked,
  );
  const tipCenterZ = calculateCenter(
    startZ,
    directionZ,
    targetZ,
    tipProgress,
    targetLocked,
  );
  vertex = writeRibbon(
    geometry,
    vertex,
    tipCenterX - rightX * requireValue(LEFT_WIDTH, LEFT_WIDTH.length - 1),
    tipCenterZ - rightZ * requireValue(LEFT_WIDTH, LEFT_WIDTH.length - 1),
    tipCenterX + rightX * requireValue(RIGHT_WIDTH, RIGHT_WIDTH.length - 1),
    tipCenterZ + rightZ * requireValue(RIGHT_WIDTH, RIGHT_WIDTH.length - 1),
    y + 0.006,
    RAIL_WIDTH,
    targetLocked,
  );

  for (let rune = 0; rune < RUNE_COUNT; rune++) {
    const cycle = (flowPhase + rune / RUNE_COUNT) % 1;
    const progress = 0.18 + cycle * 0.66;
    const centerX = calculateCenter(
      startX,
      directionX,
      targetX,
      progress,
      targetLocked,
    );
    const centerZ = calculateCenter(
      startZ,
      directionZ,
      targetZ,
      progress,
      targetLocked,
    );
    const halfWidth = 0.18 + progress * 0.42;
    const frontX = centerX + directionX * 0.12;
    const frontZ = centerZ + directionZ * 0.12;
    const backX = centerX - directionX * 0.13;
    const backZ = centerZ - directionZ * 0.13;
    vertex = writeRuneRibbon(
      geometry,
      vertex,
      backX - rightX * halfWidth,
      backZ - rightZ * halfWidth,
      frontX,
      frontZ,
      y + 0.01,
      targetLocked,
    );
    vertex = writeRuneRibbon(
      geometry,
      vertex,
      frontX,
      frontZ,
      backX + rightX * halfWidth,
      backZ + rightZ * halfWidth,
      y + 0.01,
      targetLocked,
    );
  }

  if (vertex !== geometry.vertexCount) {
    throw new Error('抓取地面预览写入数量与固定拓扑不一致。');
  }
}

function calculateCenter(
  start: number,
  direction: number,
  target: number,
  progress: number,
  targetLocked: boolean,
): number {
  const straight = start + direction * PREVIEW_DISTANCE * progress;
  if (!targetLocked) {
    return straight;
  }
  const attraction = TARGET_ATTRACTION * progress * progress;
  return straight + (target - straight) * attraction;
}

function writeRibbon(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  y: number,
  width: number,
  targetLocked: boolean,
): number {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const inverseLength = 1 / Math.max(0.000001, Math.hypot(deltaX, deltaZ));
  const offsetX = deltaZ * inverseLength * width;
  const offsetZ = -deltaX * inverseLength * width;
  return writeQuad(
    geometry,
    vertex,
    startX - offsetX,
    startZ - offsetZ,
    startX + offsetX,
    startZ + offsetZ,
    endX + offsetX,
    endZ + offsetZ,
    endX - offsetX,
    endZ - offsetZ,
    y,
    targetLocked ? 0.2 : 0.12,
    targetLocked ? 0.82 : 0.55,
    1,
    targetLocked ? 0.68 : 0.42,
  );
}

function writeRuneRibbon(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  y: number,
  targetLocked: boolean,
): number {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const inverseLength = 1 / Math.max(0.000001, Math.hypot(deltaX, deltaZ));
  const offsetX = deltaZ * inverseLength * RUNE_WIDTH;
  const offsetZ = -deltaX * inverseLength * RUNE_WIDTH;
  return writeQuad(
    geometry,
    vertex,
    startX - offsetX,
    startZ - offsetZ,
    startX + offsetX,
    startZ + offsetZ,
    endX + offsetX,
    endZ + offsetZ,
    endX - offsetX,
    endZ - offsetZ,
    y,
    targetLocked ? 0.42 : 0.25,
    targetLocked ? 0.9 : 0.66,
    1,
    targetLocked ? 0.78 : 0.5,
  );
}

function writeQuad(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
  y: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): number {
  writeVertex(geometry, vertex, ax, y, az, red, green, blue, alpha);
  writeVertex(geometry, vertex + 1, bx, y, bz, red, green, blue, alpha);
  writeVertex(geometry, vertex + 2, cx, y, cz, red, green, blue, alpha);
  writeVertex(geometry, vertex + 3, ax, y, az, red, green, blue, alpha);
  writeVertex(geometry, vertex + 4, cx, y, cz, red, green, blue, alpha);
  writeVertex(geometry, vertex + 5, dx, y, dz, red, green, blue, alpha);
  return vertex + VERTICES_PER_QUAD;
}

function writeVertex(
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
  const position = vertex * 3;
  geometry.positions[position] = x;
  geometry.positions[position + 1] = y;
  geometry.positions[position + 2] = z;
  const color = vertex * 4;
  geometry.colors[color] = red;
  geometry.colors[color + 1] = green;
  geometry.colors[color + 2] = blue;
  geometry.colors[color + 3] = alpha;
}

function requireValue(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new Error('抓取地面预览布局索引越界。');
  }
  return value;
}
