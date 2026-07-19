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
import { LOBBY_LAYOUT } from '../model/lobby-layout';
import {
  getLobbyGeometryJitter,
} from './lobby-triangle-geometry';

const CABLE_SEGMENTS = 6;
const LAMP_SEGMENTS = 16;

const CABLE_LEVELS = Object.freeze([
  Object.freeze({ y: LOBBY_LAYOUT.cableTopY, x: 0, z: 0 }),
  Object.freeze({
    y: (LOBBY_LAYOUT.cableTopY + LOBBY_LAYOUT.lampTopY) * 0.5,
    x: 0.018,
    z: -0.012,
  }),
  Object.freeze({ y: LOBBY_LAYOUT.lampTopY, x: 0, z: 0 }),
]);

const CABLE_PLAN = compileRadialTopologyPlan({
  ringCount: CABLE_LEVELS.length,
  segmentCount: CABLE_SEGMENTS,
  centerCount: 0,
  degeneratePolicy: RadialDegeneratePolicy.PreserveFixedTopology,
  passes: Object.freeze([Object.freeze({
    kind: RadialTopologyPassKind.SideBands,
    firstRing: 0,
    lastRing: CABLE_LEVELS.length - 1,
    winding: RadialWinding.Reverse,
    triangleOrder: RadialTriangleOrder.PrimaryFirst,
  })]),
});
const CABLE_WORKSPACE = createRadialWorkspace(CABLE_PLAN);

const LAMP_HOUSING_PLAN = compileRadialTopologyPlan({
  ringCount: 2,
  segmentCount: LAMP_SEGMENTS,
  centerCount: 2,
  degeneratePolicy: RadialDegeneratePolicy.PreserveFixedTopology,
  passes: Object.freeze([Object.freeze({
    kind: RadialTopologyPassKind.SegmentSequence,
    operations: Object.freeze([
      Object.freeze({
        kind: RadialSegmentOperationKind.SideBand,
        firstRing: 0,
        secondRing: 1,
        winding: RadialWinding.Forward,
        triangleOrder: RadialTriangleOrder.PrimaryFirst,
      }),
      Object.freeze({
        kind: RadialSegmentOperationKind.Fan,
        ring: 1,
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
const LAMP_HOUSING_WORKSPACE = createRadialWorkspace(LAMP_HOUSING_PLAN);

const LAMP_GLOW_PLAN = compileRadialTopologyPlan({
  ringCount: 1,
  segmentCount: LAMP_SEGMENTS,
  centerCount: 1,
  degeneratePolicy: RadialDegeneratePolicy.PreserveFixedTopology,
  passes: Object.freeze([Object.freeze({
    kind: RadialTopologyPassKind.Fan,
    ring: 0,
    center: 0,
    winding: RadialWinding.Forward,
  })]),
});
const LAMP_GLOW_WORKSPACE = createRadialWorkspace(LAMP_GLOW_PLAN);

/** 写入从天花板垂落到灯具的低面数电线。 */
export function writeLobbyLampCable(writer: TriangleMeshWriter): void {
  sampleRadialTopology(CABLE_PLAN, CABLE_SOURCE, undefined, CABLE_WORKSPACE);
  emitSampledRadialTopology(CABLE_PLAN, CABLE_WORKSPACE, writer, undefined);
}

/** 写入由上下两圈切面组成的低面数吸顶灯外壳。 */
export function writeLobbyLampHousing(writer: TriangleMeshWriter): void {
  sampleRadialTopology(
    LAMP_HOUSING_PLAN,
    LAMP_HOUSING_SOURCE,
    undefined,
    LAMP_HOUSING_WORKSPACE,
  );
  emitSampledRadialTopology(
    LAMP_HOUSING_PLAN,
    LAMP_HOUSING_WORKSPACE,
    writer,
    undefined,
  );
}

/** 写入朝下的象牙金日光分面发光圆盘。 */
export function writeLobbyLampGlow(writer: TriangleMeshWriter): void {
  sampleRadialTopology(LAMP_GLOW_PLAN, LAMP_GLOW_SOURCE, undefined, LAMP_GLOW_WORKSPACE);
  emitSampledRadialTopology(LAMP_GLOW_PLAN, LAMP_GLOW_WORKSPACE, writer, undefined);
}

/** 大厅吊线的领域 Ring Source。 */
const CABLE_SOURCE: RadialRingSource<undefined> = Object.freeze({
  sampleRing(_context, ringIndex, segment, output, outputOffset): void {
    const level = CABLE_LEVELS[ringIndex];
    if (level === undefined) {
      throw new Error('大厅电线高度索引无效。');
    }
    const angle = segment / CABLE_SEGMENTS * Math.PI * 2;
    writePosition(
      output,
      outputOffset,
      level.x + Math.cos(angle) * 0.045,
      level.y,
      LOBBY_LAYOUT.focusZ + level.z + Math.sin(angle) * 0.045,
    );
  },
  sampleCenter(): void {
    throw new Error('大厅电线 Radial Plan 不包含 Fan 中心。');
  },
});

/** 大厅顶灯外壳的上下不规则轮廓与端盖中心。 */
const LAMP_HOUSING_SOURCE: RadialRingSource<undefined> = Object.freeze({
  sampleRing(_context, ringIndex, segment, output, outputOffset): void {
    const top = ringIndex === 1;
    const angle = segment / LAMP_SEGMENTS * Math.PI * 2;
    const radius = (top ? 0.82 : 0.67)
      + getLobbyGeometryJitter(segment, top ? 0 : 1, 101, 0.035);
    writePosition(
      output,
      outputOffset,
      Math.cos(angle) * radius,
      top ? LOBBY_LAYOUT.lampTopY : LOBBY_LAYOUT.lampBottomY,
      LOBBY_LAYOUT.focusZ + Math.sin(angle) * radius,
    );
  },
  sampleCenter(_context, centerIndex, output, outputOffset): void {
    writePosition(
      output,
      outputOffset,
      0,
      centerIndex === 0 ? LOBBY_LAYOUT.lampTopY : LOBBY_LAYOUT.lampBottomY,
      LOBBY_LAYOUT.focusZ,
    );
  },
});

/** 大厅顶灯朝下发光圆盘的轮廓与中心。 */
const LAMP_GLOW_SOURCE: RadialRingSource<undefined> = Object.freeze({
  sampleRing(_context, _ringIndex, segment, output, outputOffset): void {
    const angle = segment / LAMP_SEGMENTS * Math.PI * 2;
    const radius = 0.57 + getLobbyGeometryJitter(segment, 0, 107, 0.018);
    writePosition(
      output,
      outputOffset,
      Math.cos(angle) * radius,
      LOBBY_LAYOUT.lampGlowY,
      LOBBY_LAYOUT.focusZ + Math.sin(angle) * radius,
    );
  },
  sampleCenter(_context, _centerIndex, output, outputOffset): void {
    writePosition(output, outputOffset, 0, LOBBY_LAYOUT.lampGlowY, LOBBY_LAYOUT.focusZ);
  },
});

/** 原地写入一个双精度 Radial 采样点。 */
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
