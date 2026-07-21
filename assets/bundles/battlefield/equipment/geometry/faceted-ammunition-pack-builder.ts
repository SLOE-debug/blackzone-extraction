import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../core/geometry/faceted/facet-orientation';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../core/geometry/faceted/static-faceted-mesh-sink';

const TAU = Math.PI * 2;

/** 弹药盒水平截面的领域化控制点。 */
export interface AmmunitionPackOutlinePoint {
  readonly x: number;
  readonly z: number;
}

/** 弹药盒壳体各分面的稳定配色。 */
export interface AmmunitionPackColors {
  readonly top: Readonly<FacetedColor>;
  readonly bottom: Readonly<FacetedColor>;
  readonly side: Readonly<FacetedColor>;
  readonly accent: Readonly<FacetedColor>;
}

/** 把非均匀切角轮廓挤出为带独立硬边的低密度弹药盒壳体。 */
export function appendFacetedAmmunitionCase(
  sink: StaticFacetedMeshSink,
  outline: readonly Readonly<AmmunitionPackOutlinePoint>[],
  bottomY: number,
  topY: number,
  colors: Readonly<AmmunitionPackColors>,
  topOffsetX: number,
  topOffsetZ: number,
): void {
  if (outline.length < 5 || !Number.isFinite(bottomY) || topY <= bottomY) {
    throw new Error('弹药盒轮廓和高度配置无效。');
  }
  let centerX = 0;
  let centerZ = 0;
  for (const point of outline) {
    centerX += point.x;
    centerZ += point.z;
  }
  centerX /= outline.length;
  centerZ /= outline.length;
  const bottomCenter = point3(centerX, bottomY, centerZ);
  const topCenter = point3(centerX + topOffsetX, topY, centerZ + topOffsetZ);
  for (let index = 0; index < outline.length; index++) {
    const next = (index + 1) % outline.length;
    const currentPoint = requireOutlinePoint(outline, index);
    const nextPoint = requireOutlinePoint(outline, next);
    const bottomCurrent = point3(currentPoint.x, bottomY, currentPoint.z);
    const bottomNext = point3(nextPoint.x, bottomY, nextPoint.z);
    const topCurrent = point3(
      currentPoint.x + topOffsetX,
      topY,
      currentPoint.z + topOffsetZ,
    );
    const topNext = point3(
      nextPoint.x + topOffsetX,
      topY,
      nextPoint.z + topOffsetZ,
    );
    emitOrientedFlatTriangle(
      sink,
      index % 2 === 0 ? colors.top : colors.accent,
      topCenter,
      topCurrent,
      topNext,
      0,
      1,
      0,
    );
    emitOrientedFlatTriangle(
      sink,
      colors.bottom,
      bottomCenter,
      bottomNext,
      bottomCurrent,
      0,
      -1,
      0,
    );
    emitOrientedFlatQuad(
      sink,
      index % 3 === 0 ? colors.accent : colors.side,
      bottomCurrent,
      topCurrent,
      topNext,
      bottomNext,
      currentPoint.x + nextPoint.x - centerX * 2,
      0,
      currentPoint.z + nextPoint.z - centerZ * 2,
    );
  }
}

/** 写入低段数、变半径且顶端偏心的单枚可见弹药。 */
export function appendFacetedCartridge(
  sink: StaticFacetedMeshSink,
  centerX: number,
  bottomY: number,
  centerZ: number,
  radius: number,
  height: number,
  segmentCount: number,
  bodyColor: Readonly<FacetedColor>,
  capColor: Readonly<FacetedColor>,
  variationOffset: number,
): void {
  if (segmentCount < 5 || radius <= 0 || height <= 0) {
    throw new Error('弹药分段、半径和高度必须为有效正数。');
  }
  const topCenter = point3(
    centerX + radius * 0.08,
    bottomY + height,
    centerZ - radius * 0.05,
  );
  const bottomCenter = point3(centerX, bottomY, centerZ);
  for (let segment = 0; segment < segmentCount; segment++) {
    const next = (segment + 1) % segmentCount;
    const bottomCurrent = cartridgeRingPoint(
      centerX,
      bottomY,
      centerZ,
      radius,
      segment,
      segmentCount,
      variationOffset,
      0,
    );
    const bottomNext = cartridgeRingPoint(
      centerX,
      bottomY,
      centerZ,
      radius,
      next,
      segmentCount,
      variationOffset,
      0,
    );
    const topCurrent = cartridgeRingPoint(
      centerX,
      bottomY + height,
      centerZ,
      radius * 0.92,
      segment,
      segmentCount,
      variationOffset,
      1,
    );
    const topNext = cartridgeRingPoint(
      centerX,
      bottomY + height,
      centerZ,
      radius * 0.92,
      next,
      segmentCount,
      variationOffset,
      1,
    );
    emitOrientedFlatQuad(
      sink,
      segment % 2 === 0 ? bodyColor : capColor,
      bottomCurrent,
      topCurrent,
      topNext,
      bottomNext,
      Math.cos((segment + 0.5) / segmentCount * TAU),
      0,
      Math.sin((segment + 0.5) / segmentCount * TAU),
    );
    emitOrientedFlatTriangle(
      sink,
      capColor,
      topCenter,
      topCurrent,
      topNext,
      0,
      1,
      0,
    );
    emitOrientedFlatTriangle(
      sink,
      bodyColor,
      bottomCenter,
      bottomNext,
      bottomCurrent,
      0,
      -1,
      0,
    );
  }
}

function cartridgeRingPoint(
  centerX: number,
  y: number,
  centerZ: number,
  radius: number,
  segment: number,
  segmentCount: number,
  variationOffset: number,
  top: number,
): Readonly<FacetedPoint> {
  const angle = segment / segmentCount * TAU + variationOffset * 0.07;
  const variation = 1 + ((segment * 5 + variationOffset * 3) % 4 - 1.5) * 0.025;
  return point3(
    centerX + top * radius * 0.08 + Math.cos(angle) * radius * variation,
    y,
    centerZ - top * radius * 0.05 + Math.sin(angle) * radius * variation,
  );
}

function requireOutlinePoint(
  outline: readonly Readonly<AmmunitionPackOutlinePoint>[],
  index: number,
): Readonly<AmmunitionPackOutlinePoint> {
  const point = outline[index];
  if (point === undefined) {
    throw new Error('弹药盒轮廓索引越界。');
  }
  return point;
}

function point3(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}
