import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import {
  emitSampledRadialTopology,
  sampleRadialTopology,
} from '../../core/geometry/radial/radial-emitter';
import { type RadialRingSource } from '../../core/geometry/radial/radial-ring-source';
import {
  compileRadialTopologyPlan,
  RadialDegeneratePolicy,
  RadialTopologyPassKind,
  RadialTriangleOrder,
  RadialWinding,
} from '../../core/geometry/radial/radial-topology-plan';
import {
  createRadialWorkspace,
  type RadialPositionArray,
} from '../../core/geometry/radial/radial-workspace';
import { LOBBY_LAYOUT } from '../model/lobby-layout';
import {
  LOBBY_ALTAR_SEGMENTS,
  LOBBY_ALTAR_TIERS,
  type LobbyAltarRing,
  type LobbyAltarTier,
} from './lobby-altar-layout';
import {
  getLobbyGeometryJitter,
} from './lobby-triangle-geometry';

const ALTAR_RING_COUNT = getAltarTier(0).rings.length;
const ALTAR_PLAN = compileRadialTopologyPlan({
  ringCount: ALTAR_RING_COUNT,
  segmentCount: LOBBY_ALTAR_SEGMENTS,
  centerCount: 1,
  degeneratePolicy: RadialDegeneratePolicy.PreserveFixedTopology,
  passes: Object.freeze([
    Object.freeze({
      kind: RadialTopologyPassKind.SideBands,
      firstRing: 0,
      lastRing: ALTAR_RING_COUNT - 1,
      winding: RadialWinding.Forward,
      triangleOrder: RadialTriangleOrder.SecondaryFirst,
    }),
    Object.freeze({
      kind: RadialTopologyPassKind.Fan,
      ring: ALTAR_RING_COUNT - 1,
      center: 0,
      winding: RadialWinding.Reverse,
    }),
  ]),
});
const ALTAR_WORKSPACE = createRadialWorkspace(ALTAR_PLAN);

/** 写入两层带外凸肩部和不规则轮廓的低多边形祭台。 */
export function writeLobbyAltar(writer: TriangleMeshWriter): void {
  for (let tierIndex = 0; tierIndex < LOBBY_ALTAR_TIERS.length; tierIndex++) {
    sampleRadialTopology(ALTAR_PLAN, ALTAR_SOURCE, tierIndex, ALTAR_WORKSPACE);
    emitSampledRadialTopology(ALTAR_PLAN, ALTAR_WORKSPACE, writer, undefined);
  }
}

/** 祭台每层领域 Ring 清单与不规则轮廓采样。 */
const ALTAR_SOURCE: RadialRingSource<number> = Object.freeze({
  sampleRing(tierIndex, ringIndex, segment, output, outputOffset): void {
    const tier = getAltarTier(tierIndex);
    if (tier.rings.length !== ALTAR_RING_COUNT) {
      throw new Error('祭台各层必须使用相同的 Radial 环数量。');
    }
    const ring = getAltarRing(tier, ringIndex);
    const angle = segment / LOBBY_ALTAR_SEGMENTS * Math.PI * 2
      + getLobbyGeometryJitter(segment, tierIndex, 127, 0.035);
    const radius = getAltarRadius(ring, tierIndex, ringIndex, segment);
    writePosition(
      output,
      outputOffset,
      Math.cos(angle) * radius,
      ring.y,
      LOBBY_LAYOUT.focusZ + Math.sin(angle) * radius,
    );
  },
  sampleCenter(tierIndex, _centerIndex, output, outputOffset): void {
    const tier = getAltarTier(tierIndex);
    const topRing = getAltarRing(tier, tier.rings.length - 1);
    writePosition(output, outputOffset, 0, topRing.y, LOBBY_LAYOUT.focusZ);
  },
});

/** 根据固定半径清单和 seed 计算当前祭台 Segment 的领域半径。 */
function getAltarRadius(
  ring: Readonly<LobbyAltarRing>,
  tierIndex: number,
  ringIndex: number,
  segment: number,
): number {
  const radius = ring.radius + getLobbyGeometryJitter(
    segment,
    tierIndex,
    131 + ringIndex,
    ring.radiusJitter,
  );
  return radius;
}

/** 获取由固定层级清单保证存在的祭台层。 */
function getAltarTier(tierIndex: number): Readonly<LobbyAltarTier> {
  const tier = LOBBY_ALTAR_TIERS[tierIndex];
  if (tier === undefined) {
    throw new Error('祭台层级索引越界。');
  }
  return tier;
}

/** 获取由固定轮廓清单保证存在的祭台圈。 */
function getAltarRing(
  tier: Readonly<LobbyAltarTier>,
  ringIndex: number,
): Readonly<LobbyAltarRing> {
  const ring = tier.rings[ringIndex];
  if (ring === undefined) {
    throw new Error('祭台轮廓圈索引越界。');
  }
  return ring;
}

/** 原地写入祭台双精度 Radial 采样点。 */
function writePosition(
  output: RadialPositionArray,
  outputOffset: number,
  x: number,
  y: number,
  z: number,
): void {
  output[outputOffset] = x;
  output[outputOffset + 1] = y;
  output[outputOffset + 2] = z;
}
