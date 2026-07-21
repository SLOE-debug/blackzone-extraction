import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';
import { type EquipmentRarityColor } from '../model/equipment-rarity-palette';
import {
  DROPPED_EQUIPMENT_ACCENT_LAYOUT,
  type DroppedEquipmentBeamRingOffset,
} from '../model/dropped-equipment-accent-layout';

const TAU = Math.PI * 2;
const VERTICES_PER_QUAD = 6;
const layout = DROPPED_EQUIPMENT_ACCENT_LAYOUT;

/** 单件掉落装备毛笔形渐隐光管使用的固定拓扑。 */
export const DROPPED_EQUIPMENT_BEAM_TOPOLOGY = Object.freeze({
  verticesPerBeam: (layout.beamRingHeights.length - 1)
    * layout.beamSegments
    * VERTICES_PER_QUAD,
});

/** 为一批掉落装备创建一一对应的毛笔形光管固定拓扑。 */
export function createDroppedEquipmentBeamGeometry(
  itemCount: number,
): UnlitColorBufferGeometry {
  if (!Number.isInteger(itemCount) || itemCount <= 0) {
    throw new Error('掉落装备光管数量必须是正整数。');
  }
  const vertexCount = DROPPED_EQUIPMENT_BEAM_TOPOLOGY.verticesPerBeam * itemCount;
  const geometry = createUnlitColorGeometry(
    vertexCount,
    vertexCount,
    GeometryIndexFormat.Uint32,
  );
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    geometry.index[vertex] = vertex;
  }
  geometry.commitCounts(vertexCount, vertexCount);
  return geometry;
}

/** 原地写入一件掉落装备的低段数毛笔形光管，并让轮廓和透明度逐圈收束。 */
export function writeDroppedEquipmentBeam(
  geometry: UnlitColorBufferGeometry,
  slot: number,
  x: number,
  y: number,
  z: number,
  color: Readonly<EquipmentRarityColor>,
  visible: boolean,
): void {
  const verticesPerBeam = DROPPED_EQUIPMENT_BEAM_TOPOLOGY.verticesPerBeam;
  const capacity = geometry.vertexCount / verticesPerBeam;
  if (!Number.isInteger(slot) || slot < 0 || slot >= capacity) {
    throw new Error('掉落装备光管槽位越界。');
  }
  const baseVertex = slot * verticesPerBeam;
  if (!visible) {
    collapseBeam(geometry, baseVertex, verticesPerBeam, x, y, z);
    return;
  }
  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const baseY = y + layout.beamBaseOffsetY;
  let vertex = baseVertex;
  for (let ring = 0; ring < layout.beamRingHeights.length - 1; ring++) {
    const nextRing = ring + 1;
    const lowerHeight = requireNumber(layout.beamRingHeights, ring, '光管高度');
    const upperHeight = requireNumber(layout.beamRingHeights, nextRing, '光管高度');
    const lowerRadius = requireNumber(layout.beamRingRadii, ring, '光管半径');
    const upperRadius = requireNumber(layout.beamRingRadii, nextRing, '光管半径');
    const lowerAlpha = requireNumber(layout.beamRingAlphas, ring, '光管透明度');
    const upperAlpha = requireNumber(layout.beamRingAlphas, nextRing, '光管透明度');
    const lowerOffset = requireRingOffset(layout.beamRingOffsets, ring);
    const upperOffset = requireRingOffset(layout.beamRingOffsets, nextRing);
    for (let segment = 0; segment < layout.beamSegments; segment++) {
      const nextSegment = (segment + 1) % layout.beamSegments;
      const lowerA = ringPoint(
        x + lowerOffset.x,
        baseY + lowerHeight,
        z + lowerOffset.z,
        lowerRadius,
        segment,
        ring,
      );
      const lowerB = ringPoint(
        x + lowerOffset.x,
        baseY + lowerHeight,
        z + lowerOffset.z,
        lowerRadius,
        nextSegment,
        ring,
      );
      const upperA = ringPoint(
        x + upperOffset.x,
        baseY + upperHeight,
        z + upperOffset.z,
        upperRadius,
        segment,
        nextRing,
      );
      const upperB = ringPoint(
        x + upperOffset.x,
        baseY + upperHeight,
        z + upperOffset.z,
        upperRadius,
        nextSegment,
        nextRing,
      );
      vertex = writeQuad(
        geometry,
        vertex,
        lowerA,
        lowerB,
        upperB,
        upperA,
        red,
        green,
        blue,
        lowerAlpha,
        upperAlpha,
      );
    }
  }
  if (vertex !== baseVertex + verticesPerBeam) {
    throw new Error('掉落装备光管没有完整写入固定拓扑。');
  }
}

interface BeamPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function ringPoint(
  centerX: number,
  y: number,
  centerZ: number,
  radius: number,
  segment: number,
  ring: number,
): BeamPoint {
  const twist = requireNumber(layout.beamRingTwists, ring, '光管扭转角');
  const scaleIndex = (segment + ring * 2) % layout.beamSegmentRadiusScales.length;
  const directionalScale = requireNumber(
    layout.beamSegmentRadiusScales,
    scaleIndex,
    '光管方向半径',
  );
  const angle = segment / layout.beamSegments * TAU + twist + 0.09;
  const variation = directionalScale
    * (1 + ((segment * 3 + ring * 5) % 3 - 1) * 0.025);
  return {
    x: centerX + Math.cos(angle) * radius * variation,
    y,
    z: centerZ + Math.sin(angle) * radius * variation,
  };
}

function requireRingOffset(
  values: readonly Readonly<DroppedEquipmentBeamRingOffset>[],
  index: number,
): Readonly<DroppedEquipmentBeamRingOffset> {
  const value = values[index];
  if (value === undefined) {
    throw new Error('光管偏心轮廓索引越界。');
  }
  return value;
}

function writeQuad(
  geometry: UnlitColorBufferGeometry,
  firstVertex: number,
  lowerA: Readonly<BeamPoint>,
  lowerB: Readonly<BeamPoint>,
  upperB: Readonly<BeamPoint>,
  upperA: Readonly<BeamPoint>,
  red: number,
  green: number,
  blue: number,
  lowerAlpha: number,
  upperAlpha: number,
): number {
  writeVertex(geometry, firstVertex, lowerA, red, green, blue, lowerAlpha);
  writeVertex(geometry, firstVertex + 1, lowerB, red, green, blue, lowerAlpha);
  writeVertex(geometry, firstVertex + 2, upperB, red, green, blue, upperAlpha);
  writeVertex(geometry, firstVertex + 3, lowerA, red, green, blue, lowerAlpha);
  writeVertex(geometry, firstVertex + 4, upperB, red, green, blue, upperAlpha);
  writeVertex(geometry, firstVertex + 5, upperA, red, green, blue, upperAlpha);
  return firstVertex + VERTICES_PER_QUAD;
}

function writeVertex(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  point: Readonly<BeamPoint>,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): void {
  const positionOffset = vertex * 3;
  geometry.positions[positionOffset] = point.x;
  geometry.positions[positionOffset + 1] = point.y;
  geometry.positions[positionOffset + 2] = point.z;
  const colorOffset = vertex * 4;
  geometry.colors[colorOffset] = red;
  geometry.colors[colorOffset + 1] = green;
  geometry.colors[colorOffset + 2] = blue;
  geometry.colors[colorOffset + 3] = alpha;
}

function collapseBeam(
  geometry: UnlitColorBufferGeometry,
  firstVertex: number,
  vertexCount: number,
  x: number,
  y: number,
  z: number,
): void {
  const endVertex = firstVertex + vertexCount;
  for (let vertex = firstVertex; vertex < endVertex; vertex++) {
    const positionOffset = vertex * 3;
    geometry.positions[positionOffset] = x;
    geometry.positions[positionOffset + 1] = y;
    geometry.positions[positionOffset + 2] = z;
    geometry.colors[vertex * 4 + 3] = 0;
  }
}

function requireNumber(
  values: readonly number[],
  index: number,
  label: string,
): number {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`${label}索引越界。`);
  }
  return value;
}
