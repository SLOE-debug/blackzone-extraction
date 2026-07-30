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
  SLEDGEHAMMER_COLLAR_RINGS,
  SLEDGEHAMMER_HANDLE_RINGS,
  SLEDGEHAMMER_HANDLE_SEGMENTS,
  type SledgehammerHandleRing,
} from './sledgehammer-layout';
import { SLEDGEHAMMER_PALETTE } from './sledgehammer-palette';

/** 向目标几何写入错心木柄、握持色带与锤头连接护环。 */
export function appendSledgehammerHandle(sink: PrebakedFacetedMeshSink): void {
  appendRingBands(sink, SLEDGEHAMMER_HANDLE_RINGS, false);
  appendHandleCaps(sink);
  appendGripInlays(sink);
  appendRingBands(sink, SLEDGEHAMMER_COLLAR_RINGS, true);
}

function appendRingBands(
  sink: PrebakedFacetedMeshSink,
  rings: readonly SledgehammerHandleRing[],
  collar: boolean,
): void {
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex++) {
    for (let segment = 0; segment < SLEDGEHAMMER_HANDLE_SEGMENTS; segment++) {
      const next = (segment + 1) % SLEDGEHAMMER_HANDLE_SEGMENTS;
      const a = handlePoint(rings, ringIndex, segment);
      const b = handlePoint(rings, ringIndex, next);
      const c = handlePoint(rings, ringIndex + 1, next);
      const d = handlePoint(rings, ringIndex + 1, segment);
      const angle = (segment + 0.5) / SLEDGEHAMMER_HANDLE_SEGMENTS * Math.PI * 2;
      const cavity = collar && ringIndex === 0;
      const baseColor = collar
        ? ringIndex % 2 === 0 ? SLEDGEHAMMER_PALETTE.ironDark : SLEDGEHAMMER_PALETTE.iron
        : segment % 3 === 0 ? SLEDGEHAMMER_PALETTE.woodLight
          : segment % 2 === 0 ? SLEDGEHAMMER_PALETTE.wood
            : SLEDGEHAMMER_PALETTE.woodDark;
      emitOrientedFlatQuad(
        sink,
        prebakedFacetMaterial(
          cavity ? SLEDGEHAMMER_PALETTE.cavity : baseColor,
          cavity ? PrebakedFacetRole.Cavity : PrebakedFacetRole.Exterior,
          ringIndex * SLEDGEHAMMER_HANDLE_SEGMENTS + segment,
        ),
        a, b, c, d,
        Math.cos(angle), 0, Math.sin(angle),
      );
    }
  }
}

function appendHandleCaps(sink: PrebakedFacetedMeshSink): void {
  const topCenter = point(0, SLEDGEHAMMER_HANDLE_RINGS[0]?.y ?? 0.2, 0);
  const lastRing = SLEDGEHAMMER_HANDLE_RINGS.length - 1;
  const bottomCenter = point(0, SLEDGEHAMMER_HANDLE_RINGS[lastRing]?.y ?? -2.62, 0);
  for (let segment = 0; segment < SLEDGEHAMMER_HANDLE_SEGMENTS; segment++) {
    const next = (segment + 1) % SLEDGEHAMMER_HANDLE_SEGMENTS;
    emitOrientedFlatTriangle(
      sink,
      prebakedFacetMaterial(
        SLEDGEHAMMER_PALETTE.woodLight,
        PrebakedFacetRole.Exterior,
        segment,
      ),
      topCenter,
      handlePoint(SLEDGEHAMMER_HANDLE_RINGS, 0, next),
      handlePoint(SLEDGEHAMMER_HANDLE_RINGS, 0, segment),
      0, 1, 0,
    );
    emitOrientedFlatTriangle(
      sink,
      prebakedFacetMaterial(
        SLEDGEHAMMER_PALETTE.cavity,
        PrebakedFacetRole.Cavity,
        segment + 2,
      ),
      bottomCenter,
      handlePoint(SLEDGEHAMMER_HANDLE_RINGS, lastRing, segment),
      handlePoint(SLEDGEHAMMER_HANDLE_RINGS, lastRing, next),
      0, -1, 0,
    );
  }
}

/** 用贴合七边木柄的铜色三角面形成不对称握持标记。 */
function appendGripInlays(sink: PrebakedFacetedMeshSink): void {
  const frontZ = 0.126;
  const strips = Object.freeze([
    Object.freeze({ top: -0.2, bottom: -0.34, offset: -0.035 }),
    Object.freeze({ top: -0.58, bottom: -0.72, offset: 0.028 }),
    Object.freeze({ top: -0.96, bottom: -1.1, offset: -0.018 }),
  ]);
  for (let index = 0; index < strips.length; index++) {
    const strip = strips[index];
    if (strip === undefined) {
      throw new Error('大锤握持嵌片布局缺失。');
    }
    emitOrientedFlatTriangle(
      sink,
      prebakedFacetMaterial(
        SLEDGEHAMMER_PALETTE.copper,
        PrebakedFacetRole.Accent,
        index,
      ),
      point(-0.105 + strip.offset, strip.top, frontZ),
      point(0.105 + strip.offset, strip.top - 0.03, frontZ + 0.002),
      point(0.025 + strip.offset, strip.bottom, frontZ + 0.004),
      0, 0, 1,
    );
  }
}

function handlePoint(
  rings: readonly SledgehammerHandleRing[],
  ringIndex: number,
  segment: number,
): Readonly<FacetedPoint> {
  const ring = requireValue(rings, ringIndex, '柄部截面');
  const angle = segment / SLEDGEHAMMER_HANDLE_SEGMENTS * Math.PI * 2 + ring.twist;
  const variation = 1 + (((segment * 5 + ringIndex * 3) % 5) - 2) * 0.022;
  return point(
    ring.centerX + Math.cos(angle) * ring.radiusX * variation,
    ring.y,
    ring.centerZ + Math.sin(angle) * ring.radiusZ * variation,
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
