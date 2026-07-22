import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import {
  CURVE_CRAWLER_LEG_COUNT,
  CurveCrawlerFragmentIndex,
} from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  CurveCrawlerMeshSemantic,
  type CurveCrawlerMeshPlan,
} from './curve-crawler-mesh-plan';

const GPU_METADATA_COMPONENT_COUNT = 4;
const GPU_SLOT_UV_COMPONENT_COUNT = 2;

/** GPU 顶点流中供 Shader 解释的变形元数据。 */
export interface CurveCrawlerGpuDeformationStreams {
  /** x 为稳定 GPU Slot，y 为 CurveCrawlerMeshSemantic。 */
  readonly slotAndSemantic: Float32Array;
  /** x 为部件索引，y 为腿长权重，z 为死亡碎块索引，w 为出生碎片索引。 */
  readonly deformation: Float32Array;
  /** xyz 为当前部件局部枢轴，w 保留。 */
  readonly pivot: Float32Array;
}

/** 为已经生成 Bind Pose 的实体槽位写入 GPU 变形语义。 */
export function writeCurveCrawlerGpuDeformationLayout(
  plan: CurveCrawlerMeshPlan,
  state: CurveCrawlerState,
  entityIndex: number,
  bindPose: VertexStreams,
  gpuSlot: number,
  target: CurveCrawlerGpuDeformationStreams,
): void {
  assertCapacity(plan, bindPose, gpuSlot, target);
  const bodyLength = state.data.morphology.bodyLength[entityIndex] ?? 0;
  const bodyWidth = state.data.morphology.bodyWidth[entityIndex] ?? 0;
  const componentPivots = createComponentPivots(plan, bindPose, gpuSlot, bodyLength, bodyWidth);
  const firstVertex = gpuSlot * plan.vertexCount;

  for (let localVertex = 0; localVertex < plan.vertexCount; localVertex++) {
    const semantic = plan.semanticIds[localVertex] as CurveCrawlerMeshSemantic;
    const descriptor = resolveVertexDescriptor(plan, localVertex, semantic);
    const vertex = firstVertex + localVertex;
    const uvOffset = vertex * GPU_SLOT_UV_COMPONENT_COUNT;
    target.slotAndSemantic[uvOffset] = gpuSlot;
    target.slotAndSemantic[uvOffset + 1] = semantic;
    const metadataOffset = vertex * GPU_METADATA_COMPONENT_COUNT;
    target.deformation[metadataOffset] = descriptor.partIndex;
    target.deformation[metadataOffset + 1] = descriptor.weight;
    target.deformation[metadataOffset + 2] = descriptor.fragmentIndex;
    target.deformation[metadataOffset + 3] = descriptor.shardIndex;
    const pivotOffset = descriptor.pivotIndex * 3;
    target.pivot[metadataOffset] = componentPivots[pivotOffset] ?? 0;
    target.pivot[metadataOffset + 1] = componentPivots[pivotOffset + 1] ?? 0;
    target.pivot[metadataOffset + 2] = componentPivots[pivotOffset + 2] ?? 0;
    target.pivot[metadataOffset + 3] = 0;
  }
}

interface CurveCrawlerGpuVertexDescriptor {
  readonly partIndex: number;
  readonly weight: number;
  readonly fragmentIndex: number;
  readonly shardIndex: number;
  readonly pivotIndex: number;
}

const PIVOT_LEG_FIRST = 0;
const PIVOT_ABDOMEN = PIVOT_LEG_FIRST + CURVE_CRAWLER_LEG_COUNT;
const PIVOT_THORAX = PIVOT_ABDOMEN + 1;
const PIVOT_LEFT_EYE = PIVOT_THORAX + 1;
const PIVOT_RIGHT_EYE = PIVOT_LEFT_EYE + 1;
const PIVOT_ORIGIN = PIVOT_RIGHT_EYE + 1;
const PIVOT_EGG = PIVOT_ORIGIN + 1;
const PIVOT_SHARD_FIRST = PIVOT_EGG + 1;

function createComponentPivots(
  plan: CurveCrawlerMeshPlan,
  streams: VertexStreams,
  gpuSlot: number,
  bodyLength: number,
  bodyWidth: number,
): Float32Array {
  const pivotCount = PIVOT_SHARD_FIRST + plan.emergence.shardVertexOffsets.length;
  const pivots = new Float32Array(pivotCount * 3);
  for (let leg = 0; leg < CURVE_CRAWLER_LEG_COUNT; leg++) {
    const side = leg < CURVE_CRAWLER_LEG_COUNT / 2 ? 1 : -1;
    const pair = leg % (CURVE_CRAWLER_LEG_COUNT / 2);
    writePivot(
      pivots,
      PIVOT_LEG_FIRST + leg,
      bodyLength * (0.42 - pair * 0.28),
      side * bodyWidth * 0.37,
      bodyWidth * 0.28,
    );
  }
  const entityVertexOffset = gpuSlot * plan.vertexCount;
  writeCentroidPivot(pivots, PIVOT_ABDOMEN, streams.positions,
    entityVertexOffset + plan.body.abdomenVertexOffset, plan.bodyEllipsoid.vertexCount);
  writeCentroidPivot(pivots, PIVOT_THORAX, streams.positions,
    entityVertexOffset + plan.body.thoraxVertexOffset, plan.bodyEllipsoid.vertexCount);
  writeCentroidPivot(pivots, PIVOT_LEFT_EYE, streams.positions,
    entityVertexOffset + plan.eyes.vertexOffset + plan.eyes.leftVertexOffset,
    plan.eyeEllipsoid.vertexCount);
  writeCentroidPivot(pivots, PIVOT_RIGHT_EYE, streams.positions,
    entityVertexOffset + plan.eyes.vertexOffset + plan.eyes.rightVertexOffset,
    plan.eyeEllipsoid.vertexCount);
  writeCentroidPivot(pivots, PIVOT_EGG, streams.positions,
    entityVertexOffset + plan.emergence.vertexOffset + plan.emergence.eggVertexOffset,
    plan.emergence.eggVertexCount);
  for (let shard = 0; shard < plan.emergence.shardVertexOffsets.length; shard++) {
    const start = plan.emergence.shardVertexOffsets[shard] ?? 0;
    const end = shard + 1 < plan.emergence.shardVertexOffsets.length
      ? plan.emergence.shardVertexOffsets[shard + 1] ?? start
      : plan.emergence.vertexCount;
    writeCentroidPivot(
      pivots,
      PIVOT_SHARD_FIRST + shard,
      streams.positions,
      entityVertexOffset + plan.emergence.vertexOffset + start,
      end - start,
    );
  }
  return pivots;
}

function resolveVertexDescriptor(
  plan: CurveCrawlerMeshPlan,
  localVertex: number,
  semantic: CurveCrawlerMeshSemantic,
): CurveCrawlerGpuVertexDescriptor {
  switch (semantic) {
    case CurveCrawlerMeshSemantic.Leg: {
      const leg = findPart(plan.body.legVertexOffsets, localVertex, plan.legTube.vertexCount);
      const vertexInLeg = localVertex - (plan.body.legVertexOffsets[leg] ?? 0);
      const logicalSample = plan.legTube.sampleIds[vertexInLeg] ?? 0;
      const longitudinalSample = Math.floor(logicalSample / plan.legTube.radialCount);
      return descriptor(
        leg,
        longitudinalSample / plan.legTube.segmentCount,
        leg,
        -1,
        PIVOT_LEG_FIRST + leg,
      );
    }
    case CurveCrawlerMeshSemantic.Foot: {
      const leg = findPart(plan.body.footVertexOffsets, localVertex, plan.footEllipsoid.vertexCount);
      return descriptor(leg, 1, leg, -1, PIVOT_LEG_FIRST + leg);
    }
    case CurveCrawlerMeshSemantic.Abdomen:
      return descriptor(0, 1, CurveCrawlerFragmentIndex.Abdomen, -1, PIVOT_ABDOMEN);
    case CurveCrawlerMeshSemantic.Thorax:
      return descriptor(0, 1, CurveCrawlerFragmentIndex.Thorax, -1, PIVOT_THORAX);
    case CurveCrawlerMeshSemantic.Eye: {
      const firstEyeVertex = localVertex - plan.eyes.vertexOffset;
      const right = firstEyeVertex >= plan.eyes.rightVertexOffset;
      return descriptor(
        right ? 1 : 0,
        1,
        right ? CurveCrawlerFragmentIndex.RightEye : CurveCrawlerFragmentIndex.LeftEye,
        -1,
        right ? PIVOT_RIGHT_EYE : PIVOT_LEFT_EYE,
      );
    }
    case CurveCrawlerMeshSemantic.Liquid:
    case CurveCrawlerMeshSemantic.EmergenceCrack:
      return descriptor(0, 1, -1, -1, PIVOT_ORIGIN);
    case CurveCrawlerMeshSemantic.EmergenceEgg:
      return descriptor(0, 1, -1, -1, PIVOT_EGG);
    case CurveCrawlerMeshSemantic.EmergenceShard: {
      const emergenceVertex = localVertex - plan.emergence.vertexOffset;
      const shard = findVariablePart(plan.emergence.shardVertexOffsets, emergenceVertex);
      return descriptor(shard, 1, -1, shard, PIVOT_SHARD_FIRST + shard);
    }
    default:
      throw new Error(`Curve Crawler GPU 变形包含未知顶点语义：${String(semantic)}。`);
  }
}

function descriptor(
  partIndex: number,
  weight: number,
  fragmentIndex: number,
  shardIndex: number,
  pivotIndex: number,
): CurveCrawlerGpuVertexDescriptor {
  return { partIndex, weight, fragmentIndex, shardIndex, pivotIndex };
}

function findPart(offsets: Uint16Array, vertex: number, vertexCount: number): number {
  for (let part = 0; part < offsets.length; part++) {
    const start = offsets[part] ?? 0;
    if (vertex >= start && vertex < start + vertexCount) {
      return part;
    }
  }
  throw new Error('Curve Crawler GPU 顶点没有匹配的固定部件。');
}

function findVariablePart(offsets: Uint16Array, vertex: number): number {
  for (let part = offsets.length - 1; part >= 0; part--) {
    if (vertex >= (offsets[part] ?? 0)) {
      return part;
    }
  }
  throw new Error('Curve Crawler GPU 顶点没有匹配的变长部件。');
}

function writePivot(
  target: Float32Array,
  pivot: number,
  x: number,
  y: number,
  z: number,
): void {
  const offset = pivot * 3;
  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
}

function writeCentroidPivot(
  target: Float32Array,
  pivot: number,
  positions: Float32Array,
  firstVertex: number,
  vertexCount: number,
): void {
  if (vertexCount <= 0) {
    throw new Error('Curve Crawler GPU 部件必须包含顶点。');
  }
  let x = 0;
  let y = 0;
  let z = 0;
  for (let vertex = firstVertex; vertex < firstVertex + vertexCount; vertex++) {
    const offset = vertex * 3;
    x += positions[offset] ?? 0;
    y += positions[offset + 1] ?? 0;
    z += positions[offset + 2] ?? 0;
  }
  writePivot(target, pivot, x / vertexCount, y / vertexCount, z / vertexCount);
}

function assertCapacity(
  plan: CurveCrawlerMeshPlan,
  bindPose: VertexStreams,
  gpuSlot: number,
  target: CurveCrawlerGpuDeformationStreams,
): void {
  const vertexCount = (gpuSlot + 1) * plan.vertexCount;
  if (!Number.isInteger(gpuSlot) || gpuSlot < 0
    || bindPose.positions.length < vertexCount * 3
    || target.slotAndSemantic.length < vertexCount * GPU_SLOT_UV_COMPONENT_COUNT
    || target.deformation.length < vertexCount * GPU_METADATA_COMPONENT_COUNT
    || target.pivot.length < vertexCount * GPU_METADATA_COMPONENT_COUNT) {
    throw new Error('Curve Crawler GPU 变形元数据目标容量不足。');
  }
}
