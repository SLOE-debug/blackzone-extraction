import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../../core/geometry/faceted/facet-orientation';
import {
  prebakedFacetMaterial,
  PrebakedFacetRole,
  type PrebakedFacetedMeshSink,
} from '../../../../../core/geometry/faceted/prebaked-facet-color';
import {
  SLEDGEHAMMER_HEAD_OUTLINE,
  SLEDGEHAMMER_HEAD_RINGS,
  type SledgehammerHeadOutlinePoint,
  type SledgehammerHeadRing,
} from './sledgehammer-layout';
import { SLEDGEHAMMER_PALETTE } from './sledgehammer-palette';

const HEAD_CENTER_Y = -3.08;

/** 向目标几何写入多层破岩锤头、端部切面和铜色导力嵌片。 */
export function appendSledgehammerHead(sink: PrebakedFacetedMeshSink): void {
  appendHeadBands(sink);
  appendHeadCaps(sink);
  appendHeadInlays(sink);
}

function appendHeadBands(sink: PrebakedFacetedMeshSink): void {
  for (let ringIndex = 0; ringIndex < SLEDGEHAMMER_HEAD_RINGS.length - 1; ringIndex++) {
    for (let side = 0; side < SLEDGEHAMMER_HEAD_OUTLINE.length; side++) {
      const next = (side + 1) % SLEDGEHAMMER_HEAD_OUTLINE.length;
      const a = headPoint(ringIndex, side);
      const b = headPoint(ringIndex + 1, side);
      const c = headPoint(ringIndex + 1, next);
      const d = headPoint(ringIndex, next);
      const outline = requireValue(SLEDGEHAMMER_HEAD_OUTLINE, side, '锤头轮廓');
      const shoulderBand = ringIndex === 0 || ringIndex === SLEDGEHAMMER_HEAD_RINGS.length - 2;
      const centralBand = ringIndex === 2;
      const role = centralBand
        ? PrebakedFacetRole.Cavity
        : outline.y < -0.72
          ? PrebakedFacetRole.Underside
          : PrebakedFacetRole.Exterior;
      const baseColor = centralBand
        ? SLEDGEHAMMER_PALETTE.cavity
        : shoulderBand
          ? SLEDGEHAMMER_PALETTE.ironDark
          : (ringIndex + side) % 3 === 0
            ? SLEDGEHAMMER_PALETTE.ironLight
            : SLEDGEHAMMER_PALETTE.iron;
      emitOrientedFlatQuad(
        sink,
        prebakedFacetMaterial(
          baseColor,
          role,
          ringIndex * SLEDGEHAMMER_HEAD_OUTLINE.length + side,
        ),
        a, b, c, d,
        0, outline.y, outline.z,
      );
    }
  }
}

function appendHeadCaps(sink: PrebakedFacetedMeshSink): void {
  appendHeadCap(sink, 0, -1);
  appendHeadCap(sink, SLEDGEHAMMER_HEAD_RINGS.length - 1, 1);
}

function appendHeadCap(
  sink: PrebakedFacetedMeshSink,
  ringIndex: number,
  outwardX: -1 | 1,
): void {
  const ring = requireValue(SLEDGEHAMMER_HEAD_RINGS, ringIndex, '锤头截面');
  const center = point(ring.x, HEAD_CENTER_Y + ring.shiftY, ring.shiftZ);
  for (let side = 0; side < SLEDGEHAMMER_HEAD_OUTLINE.length; side++) {
    const next = (side + 1) % SLEDGEHAMMER_HEAD_OUTLINE.length;
    emitOrientedFlatTriangle(
      sink,
      prebakedFacetMaterial(
        side % 3 === 0 ? SLEDGEHAMMER_PALETTE.ironLight : SLEDGEHAMMER_PALETTE.iron,
        PrebakedFacetRole.Exterior,
        side + ringIndex,
      ),
      center,
      headPoint(ringIndex, side),
      headPoint(ringIndex, next),
      outwardX, 0, 0,
    );
  }
}

/** 锤头正面两侧使用不镜像的实体铜片标记能量传递方向。 */
function appendHeadInlays(sink: PrebakedFacetedMeshSink): void {
  const frontZ = 0.695;
  emitOrientedFlatTriangle(
    sink,
    prebakedFacetMaterial(SLEDGEHAMMER_PALETTE.copper, PrebakedFacetRole.Accent, 1),
    point(-0.82, HEAD_CENTER_Y + 0.42, frontZ),
    point(-0.24, HEAD_CENTER_Y + 0.58, frontZ + 0.004),
    point(-0.48, HEAD_CENTER_Y - 0.08, frontZ + 0.008),
    0, 0, 1,
  );
  emitOrientedFlatTriangle(
    sink,
    prebakedFacetMaterial(SLEDGEHAMMER_PALETTE.copper, PrebakedFacetRole.Accent, 4),
    point(0.18, HEAD_CENTER_Y + 0.55, frontZ - 0.012),
    point(0.78, HEAD_CENTER_Y + 0.3, frontZ - 0.008),
    point(0.44, HEAD_CENTER_Y - 0.2, frontZ),
    0, 0, 1,
  );
}

function headPoint(ringIndex: number, side: number): Readonly<FacetedPoint> {
  const ring = requireValue(SLEDGEHAMMER_HEAD_RINGS, ringIndex, '锤头截面');
  const source = requireValue(SLEDGEHAMMER_HEAD_OUTLINE, side, '锤头轮廓');
  const cosine = Math.cos(ring.twist);
  const sine = Math.sin(ring.twist);
  const localY = source.y * ring.scaleY;
  const localZ = source.z * ring.scaleZ;
  return point(
    ring.x,
    HEAD_CENTER_Y + ring.shiftY + localY * cosine - localZ * sine,
    ring.shiftZ + localY * sine + localZ * cosine,
  );
}

function point(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}

function requireValue<T>(values: readonly T[], index: number, label: string): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`大锤${label}索引越界。`);
  }
  return value;
}
