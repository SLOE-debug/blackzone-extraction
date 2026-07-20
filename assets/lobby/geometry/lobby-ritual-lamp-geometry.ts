import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import {
  emitSampledRadialTopology,
  sampleRadialTopology,
} from '../../core/geometry/radial/radial-emitter';
import { type RadialRingSource } from '../../core/geometry/radial/radial-ring-source';
import {
  compileRadialTopologyPlan,
  RadialDegeneratePolicy,
  RadialSegmentOperationKind,
  RadialTopologyPassKind,
  RadialTriangleOrder,
  RadialWinding,
} from '../../core/geometry/radial/radial-topology-plan';
import {
  createRadialWorkspace,
  type RadialPositionArray,
} from '../../core/geometry/radial/radial-workspace';
import {
  LOBBY_RITUAL_LAMP_POSITIONS,
  LOBBY_RITUAL_LAMP_SEGMENTS,
  type LobbyRitualLampPosition,
} from './lobby-ritual-lamp-layout';

const HOUSING_LEVELS = Object.freeze([
  Object.freeze({ y: 0.02, radius: 0.2 }),
  Object.freeze({ y: 0.13, radius: 0.24 }),
  Object.freeze({ y: 0.24, radius: 0.14 }),
]);

const RITUAL_HOUSING_PLAN = compileRadialTopologyPlan({
  ringCount: HOUSING_LEVELS.length,
  segmentCount: LOBBY_RITUAL_LAMP_SEGMENTS,
  centerCount: 1,
  degeneratePolicy: RadialDegeneratePolicy.PreserveFixedTopology,
  passes: Object.freeze([
    Object.freeze({
      kind: RadialTopologyPassKind.SideBands,
      firstRing: 0,
      lastRing: HOUSING_LEVELS.length - 1,
      winding: RadialWinding.Forward,
      triangleOrder: RadialTriangleOrder.SecondaryFirst,
    }),
    Object.freeze({
      kind: RadialTopologyPassKind.Fan,
      ring: HOUSING_LEVELS.length - 1,
      center: 0,
      winding: RadialWinding.Reverse,
    }),
  ]),
});
const RITUAL_HOUSING_WORKSPACE = createRadialWorkspace(RITUAL_HOUSING_PLAN);

const RITUAL_GLOW_PLAN = compileRadialTopologyPlan({
  ringCount: 1,
  segmentCount: LOBBY_RITUAL_LAMP_SEGMENTS,
  centerCount: 2,
  degeneratePolicy: RadialDegeneratePolicy.PreserveFixedTopology,
  passes: Object.freeze([Object.freeze({
    kind: RadialTopologyPassKind.SegmentSequence,
    operations: Object.freeze([
      Object.freeze({
        kind: RadialSegmentOperationKind.Fan,
        ring: 0,
        center: 0,
        winding: RadialWinding.Reverse,
      }),
      Object.freeze({
        kind: RadialSegmentOperationKind.Fan,
        ring: 0,
        center: 1,
        winding: RadialWinding.Forward,
      }),
    ]),
  })]),
});
const RITUAL_GLOW_WORKSPACE = createRadialWorkspace(RITUAL_GLOW_PLAN);

/** 写入围绕祭台的小型六边形灯座。 */
export function writeLobbyRitualLampHousings(writer: TriangleMeshWriter): void {
  for (const position of LOBBY_RITUAL_LAMP_POSITIONS) {
    sampleRadialTopology(
      RITUAL_HOUSING_PLAN,
      RITUAL_HOUSING_SOURCE,
      position,
      RITUAL_HOUSING_WORKSPACE,
    );
    emitSampledRadialTopology(
      RITUAL_HOUSING_PLAN,
      RITUAL_HOUSING_WORKSPACE,
      writer,
      undefined,
    );
  }
}

/** 写入不参与实时照明的暗红晶体发光面。 */
export function writeLobbyRitualLampGlow(writer: TriangleMeshWriter): void {
  for (const position of LOBBY_RITUAL_LAMP_POSITIONS) {
    sampleRadialTopology(
      RITUAL_GLOW_PLAN,
      RITUAL_GLOW_SOURCE,
      position,
      RITUAL_GLOW_WORKSPACE,
    );
    emitSampledRadialTopology(
      RITUAL_GLOW_PLAN,
      RITUAL_GLOW_WORKSPACE,
      writer,
      undefined,
    );
  }
}

/** 祭台灯座的三圈轮廓与顶面中心。 */
const RITUAL_HOUSING_SOURCE: RadialRingSource<LobbyRitualLampPosition> = Object.freeze({
  sampleRing(position, ringIndex, segment, output, outputOffset): void {
    const level = getHousingLevel(ringIndex);
    const angle = segment / LOBBY_RITUAL_LAMP_SEGMENTS * Math.PI * 2;
    writePosition(
      output,
      outputOffset,
      position.x + Math.cos(angle) * level.radius,
      level.y,
      position.z + Math.sin(angle) * level.radius,
    );
  },
  sampleCenter(position, _centerIndex, output, outputOffset): void {
    const topLevel = getHousingLevel(HOUSING_LEVELS.length - 1);
    writePosition(output, outputOffset, position.x, topLevel.y, position.z);
  },
});

/** 祭台晶体中圈及上下两个尖端。 */
const RITUAL_GLOW_SOURCE: RadialRingSource<LobbyRitualLampPosition> = Object.freeze({
  sampleRing(position, _ringIndex, segment, output, outputOffset): void {
    const angle = segment / LOBBY_RITUAL_LAMP_SEGMENTS * Math.PI * 2;
    writePosition(
      output,
      outputOffset,
      position.x + Math.cos(angle) * 0.13,
      0.42,
      position.z + Math.sin(angle) * 0.13,
    );
  },
  sampleCenter(position, centerIndex, output, outputOffset): void {
    writePosition(
      output,
      outputOffset,
      position.x,
      centerIndex === 0 ? 0.22 : 0.62,
      position.z,
    );
  },
});

/** 获取由固定清单保证存在的灯座圈层。 */
function getHousingLevel(levelIndex: number): Readonly<{ y: number; radius: number }> {
  const level = HOUSING_LEVELS[levelIndex];
  if (level === undefined) {
    throw new Error('祭台灯座圈层索引越界。');
  }
  return level;
}

/** 原地写入祭台灯的双精度 Radial 采样点。 */
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
