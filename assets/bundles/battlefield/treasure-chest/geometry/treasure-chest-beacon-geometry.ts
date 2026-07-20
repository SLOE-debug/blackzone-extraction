import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';
import { TREASURE_CHEST_ATTENTION } from '../animation/treasure-chest-attention';
import { TREASURE_CHEST_BEACON_LAYOUT } from '../model/treasure-chest-beacon-layout';

const TAU = Math.PI * 2;
const VERTICES_PER_QUAD = 6;
const VERTICES_PER_WISP = 12;
const RING_VERTEX_COUNT = TREASURE_CHEST_BEACON_LAYOUT.ringSegments * VERTICES_PER_QUAD;
const RUNE_VERTEX_COUNT = TREASURE_CHEST_BEACON_LAYOUT.runeCount * VERTICES_PER_QUAD;
const WISP_VERTEX_COUNT = TREASURE_CHEST_BEACON_LAYOUT.wispCount * VERTICES_PER_WISP;

/** 宝箱信标使用的固定三角拓扑容量。 */
export const TREASURE_CHEST_BEACON_TOPOLOGY = Object.freeze({
  vertexCount: RING_VERTEX_COUNT + RUNE_VERTEX_COUNT + WISP_VERTEX_COUNT,
  indexCount: RING_VERTEX_COUNT + RUNE_VERTEX_COUNT + WISP_VERTEX_COUNT,
});

/** 创建由地面断环、旋转符片和交叉漂浮光片组成的动态无光几何。 */
export function createTreasureChestBeaconGeometry(): UnlitColorBufferGeometry {
  const topology = TREASURE_CHEST_BEACON_TOPOLOGY;
  const geometry = createUnlitColorGeometry(
    topology.vertexCount,
    topology.indexCount,
    GeometryIndexFormat.Uint16,
  );
  for (let vertex = 0; vertex < topology.vertexCount; vertex++) {
    geometry.index[vertex] = vertex;
  }
  geometry.commitCounts(topology.vertexCount, topology.indexCount);
  writeTreasureChestBeaconGeometry(geometry, 0, 0);
  return geometry;
}

/** 以固定拓扑原地求值信标的旋转、呼吸尺度和逐片透明度。 */
export function writeTreasureChestBeaconGeometry(
  geometry: UnlitColorBufferGeometry,
  elapsed: number,
  signalStrength: number,
): void {
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new Error('宝箱信标动画时间必须是有限非负数。');
  }
  if (!Number.isFinite(signalStrength) || signalStrength < 0 || signalStrength > 1) {
    throw new Error('宝箱信标强度必须位于零到一之间。');
  }
  const topology = TREASURE_CHEST_BEACON_TOPOLOGY;
  if (geometry.maxVertices !== topology.vertexCount
    || geometry.maxIndices !== topology.indexCount) {
    throw new Error('宝箱信标几何容量与固定拓扑不一致。');
  }

  let vertex = writeGroundRing(geometry, elapsed, signalStrength, 0);
  vertex = writeOrbitingRunes(geometry, elapsed, signalStrength, vertex);
  vertex = writeWisps(geometry, elapsed, signalStrength, vertex);
  if (vertex !== topology.vertexCount) {
    throw new Error('宝箱信标几何没有完整写入固定拓扑。');
  }
}

function writeGroundRing(
  geometry: UnlitColorBufferGeometry,
  elapsed: number,
  signalStrength: number,
  firstVertex: number,
): number {
  const layout = TREASURE_CHEST_BEACON_LAYOUT;
  const rotation = elapsed * layout.ringRotationSpeed;
  const radialPulse = 1 + signalStrength * 0.055;
  let vertex = firstVertex;
  for (let segment = 0; segment < layout.ringSegments; segment++) {
    const next = (segment + 1) % layout.ringSegments;
    const angleA = rotation + segment / layout.ringSegments * TAU;
    const angleB = rotation + (segment + 1) / layout.ringSegments * TAU;
    const variationA = requireVariation(segment);
    const variationB = requireVariation(next);
    const innerA = layout.innerRadius * variationA * radialPulse;
    const innerB = layout.innerRadius * variationB * radialPulse;
    const outerA = layout.outerRadius * (2 - variationA) * radialPulse;
    const outerB = layout.outerRadius * (2 - variationB) * radialPulse;
    const segmentWave = 0.78 + Math.sin(
      elapsed / TREASURE_CHEST_ATTENTION.cycleDuration * TAU + segment * 0.72,
    ) * 0.22;
    vertex = writeQuad(
      geometry,
      vertex,
      Math.cos(angleA) * innerA,
      layout.groundY,
      Math.sin(angleA) * innerA,
      Math.cos(angleA) * outerA,
      layout.groundY + 0.004,
      Math.sin(angleA) * outerA,
      Math.cos(angleB) * outerB,
      layout.groundY + 0.004,
      Math.sin(angleB) * outerB,
      Math.cos(angleB) * innerB,
      layout.groundY,
      Math.sin(angleB) * innerB,
      1,
      0.56 + signalStrength * 0.24,
      0.08,
      signalStrength * segmentWave * 0.62,
    );
  }
  return vertex;
}

function writeOrbitingRunes(
  geometry: UnlitColorBufferGeometry,
  elapsed: number,
  signalStrength: number,
  firstVertex: number,
): number {
  const layout = TREASURE_CHEST_BEACON_LAYOUT;
  const rotation = elapsed * layout.runeRotationSpeed;
  let vertex = firstVertex;
  for (let rune = 0; rune < layout.runeCount; rune++) {
    const angle = rotation + rune / layout.runeCount * TAU;
    const halfAngle = layout.runeHalfAngle * (rune % 2 === 0 ? 1 : 0.78);
    const inner = layout.runeInnerRadius * (1 + (rune % 3 - 1) * 0.035);
    const outer = layout.runeOuterRadius * (1 + (rune % 2) * 0.025);
    const alpha = signalStrength * (
      0.48 + Math.sin(elapsed * 2.1 + rune * 1.31) * 0.18
    );
    vertex = writeQuad(
      geometry,
      vertex,
      Math.cos(angle - halfAngle) * inner,
      layout.groundY + 0.012,
      Math.sin(angle - halfAngle) * inner,
      Math.cos(angle - halfAngle * 0.5) * outer,
      layout.groundY + 0.016,
      Math.sin(angle - halfAngle * 0.5) * outer,
      Math.cos(angle + halfAngle * 0.5) * outer,
      layout.groundY + 0.016,
      Math.sin(angle + halfAngle * 0.5) * outer,
      Math.cos(angle + halfAngle) * inner,
      layout.groundY + 0.012,
      Math.sin(angle + halfAngle) * inner,
      1,
      0.78,
      0.22,
      alpha,
    );
  }
  return vertex;
}

function writeWisps(
  geometry: UnlitColorBufferGeometry,
  elapsed: number,
  signalStrength: number,
  firstVertex: number,
): number {
  const layout = TREASURE_CHEST_BEACON_LAYOUT;
  const rotation = elapsed * layout.wispRotationSpeed;
  let vertex = firstVertex;
  for (let wisp = 0; wisp < layout.wispCount; wisp++) {
    const angle = rotation + wisp / layout.wispCount * TAU + (wisp % 2) * 0.11;
    const radius = layout.wispOrbitRadius * (1 + (wisp % 3 - 1) * 0.08);
    const centerX = Math.cos(angle) * radius;
    const centerZ = Math.sin(angle) * radius;
    const wave = 0.5 + Math.sin(elapsed * 1.9 + wisp * 1.47) * 0.5;
    const bottomY = layout.wispBaseHeight + wave * 0.18;
    const topY = bottomY + layout.wispHeight * (0.78 + wave * 0.34);
    const middleY = bottomY + (topY - bottomY) * 0.48;
    const halfWidth = layout.wispHalfWidth * (0.8 + wave * 0.45);
    const tangentX = -Math.sin(angle) * halfWidth;
    const tangentZ = Math.cos(angle) * halfWidth;
    const radialX = Math.cos(angle) * halfWidth;
    const radialZ = Math.sin(angle) * halfWidth;
    const alpha = signalStrength * (0.38 + wave * 0.42);

    vertex = writeDiamond(
      geometry,
      vertex,
      centerX,
      centerZ,
      bottomY,
      middleY,
      topY,
      tangentX,
      tangentZ,
      1,
      0.7 + wave * 0.2,
      0.16,
      alpha,
    );
    vertex = writeDiamond(
      geometry,
      vertex,
      centerX,
      centerZ,
      bottomY,
      middleY,
      topY,
      radialX,
      radialZ,
      1,
      0.7 + wave * 0.2,
      0.16,
      alpha,
    );
  }
  return vertex;
}

function writeDiamond(
  geometry: UnlitColorBufferGeometry,
  firstVertex: number,
  centerX: number,
  centerZ: number,
  bottomY: number,
  middleY: number,
  topY: number,
  offsetX: number,
  offsetZ: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): number {
  let vertex = writeTriangle(
    geometry,
    firstVertex,
    centerX,
    bottomY,
    centerZ,
    centerX - offsetX,
    middleY,
    centerZ - offsetZ,
    centerX,
    topY,
    centerZ,
    red,
    green,
    blue,
    alpha,
  );
  vertex = writeTriangle(
    geometry,
    vertex,
    centerX,
    bottomY,
    centerZ,
    centerX,
    topY,
    centerZ,
    centerX + offsetX,
    middleY,
    centerZ + offsetZ,
    red,
    green,
    blue,
    alpha,
  );
  return vertex;
}

function writeQuad(
  geometry: UnlitColorBufferGeometry,
  firstVertex: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  dx: number,
  dy: number,
  dz: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): number {
  let vertex = writeTriangle(
    geometry,
    firstVertex,
    ax,
    ay,
    az,
    bx,
    by,
    bz,
    cx,
    cy,
    cz,
    red,
    green,
    blue,
    alpha,
  );
  vertex = writeTriangle(
    geometry,
    vertex,
    ax,
    ay,
    az,
    cx,
    cy,
    cz,
    dx,
    dy,
    dz,
    red,
    green,
    blue,
    alpha,
  );
  return vertex;
}

function writeTriangle(
  geometry: UnlitColorBufferGeometry,
  firstVertex: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): number {
  writeVertex(geometry, firstVertex, ax, ay, az, red, green, blue, alpha);
  writeVertex(geometry, firstVertex + 1, bx, by, bz, red, green, blue, alpha);
  writeVertex(geometry, firstVertex + 2, cx, cy, cz, red, green, blue, alpha);
  return firstVertex + 3;
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
  const positionOffset = vertex * 3;
  geometry.positions[positionOffset] = x;
  geometry.positions[positionOffset + 1] = y;
  geometry.positions[positionOffset + 2] = z;
  const colorOffset = vertex * 4;
  geometry.colors[colorOffset] = red;
  geometry.colors[colorOffset + 1] = green;
  geometry.colors[colorOffset + 2] = blue;
  geometry.colors[colorOffset + 3] = Math.max(0, Math.min(1, alpha));
}

function requireVariation(index: number): number {
  const variation = TREASURE_CHEST_BEACON_LAYOUT.ringVariation[index];
  if (variation === undefined) {
    throw new Error('宝箱信标轮廓扰动索引越界。');
  }
  return variation;
}
