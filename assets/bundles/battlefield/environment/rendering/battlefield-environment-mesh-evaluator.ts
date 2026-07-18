import { type EntityRange } from '../../../../core/entities/entity-range';
import { type GeometryBounds } from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { type MeshEvaluator } from '../../../../core/mesh/mesh-evaluator';
import { type VertexStreams } from '../../../../core/mesh/vertex-streams';
import { type BattlefieldEnvironmentMeshPlan } from '../geometry/battlefield-environment-mesh-plan';
import { type BattlefieldEnvironmentArchetypeState } from '../model/battlefield-environment-state';

const FACET_VARIANT_DENOMINATOR = 6;
const HIDDEN_Y = -1000;

/** 将固定环境原型计划批量变换到当前无限窗口中的实体槽位。 */
export class BattlefieldEnvironmentMeshEvaluator implements MeshEvaluator<
  BattlefieldEnvironmentArchetypeState,
  BattlefieldEnvironmentMeshPlan
> {
  /** 根据请求原地更新位置、法线和顶点色。 */
  public evaluate(
    state: BattlefieldEnvironmentArchetypeState,
    plan: BattlefieldEnvironmentMeshPlan,
    streams: VertexStreams,
    range: EntityRange,
    requested: MeshDirty,
  ): MeshDirty {
    validateStreamCapacity(streams, plan.vertexCount * range.count);
    let changed = MeshDirty.None;
    const requestedPose = requested & MeshDirty.Pose;
    if (requestedPose !== MeshDirty.None && requestedPose !== MeshDirty.Pose) {
      throw new Error('环境固定拓扑必须同时更新 Position 和 Normal 流。');
    }
    if (requestedPose === MeshDirty.Pose) {
      this.evaluateGeometry(state, plan, streams, range);
      changed |= MeshDirty.Pose;
    }
    if ((requested & MeshDirty.Color) !== 0) {
      this.evaluateColors(state, plan, streams.colors, range);
      changed |= MeshDirty.Color;
    }
    if ((requested & MeshDirty.Bounds) !== 0) {
      changed |= MeshDirty.Bounds;
    }
    return changed;
  }

  private evaluateGeometry(
    state: BattlefieldEnvironmentArchetypeState,
    plan: BattlefieldEnvironmentMeshPlan,
    streams: VertexStreams,
    range: EntityRange,
  ): void {
    const { identity, transform } = state.data;
    for (let localEntity = 0; localEntity < range.count; localEntity++) {
      const entityIndex = range.start + localEntity;
      const active = (identity.active[entityIndex] ?? 0) !== 0;
      const x = active ? transform.x[entityIndex] ?? 0 : 0;
      const y = active ? transform.y[entityIndex] ?? 0 : HIDDEN_Y;
      const z = active ? transform.z[entityIndex] ?? 0 : 0;
      const scale = active ? transform.scale[entityIndex] ?? 0 : 0;
      const heading = transform.heading[entityIndex] ?? 0;
      const cosine = Math.cos(heading);
      const sine = Math.sin(heading);
      const vertexOffset = localEntity * plan.vertexCount;
      for (let vertex = 0; vertex < plan.vertexCount; vertex++) {
        const localOffset = vertex * 3;
        const targetOffset = (vertexOffset + vertex) * 3;
        const localX = (plan.localPositions[localOffset] ?? 0) * scale;
        const localY = (plan.localPositions[localOffset + 1] ?? 0) * scale;
        const localZ = (plan.localPositions[localOffset + 2] ?? 0) * scale;
        streams.positions[targetOffset] = x + localX * cosine + localZ * sine;
        streams.positions[targetOffset + 1] = y + localY;
        streams.positions[targetOffset + 2] = z - localX * sine + localZ * cosine;
        const localNormalX = plan.localNormals[localOffset] ?? 0;
        const localNormalY = plan.localNormals[localOffset + 1] ?? 1;
        const localNormalZ = plan.localNormals[localOffset + 2] ?? 0;
        streams.normals[targetOffset] = localNormalX * cosine + localNormalZ * sine;
        streams.normals[targetOffset + 1] = localNormalY;
        streams.normals[targetOffset + 2] = -localNormalX * sine + localNormalZ * cosine;
      }
    }
  }

  private evaluateColors(
    state: BattlefieldEnvironmentArchetypeState,
    plan: BattlefieldEnvironmentMeshPlan,
    colors: Float32Array,
    range: EntityRange,
  ): void {
    const { identity, appearance } = state.data;
    for (let localEntity = 0; localEntity < range.count; localEntity++) {
      const entityIndex = range.start + localEntity;
      const active = (identity.active[entityIndex] ?? 0) !== 0;
      const tintRed = appearance.tintRed[entityIndex] ?? 1;
      const tintGreen = appearance.tintGreen[entityIndex] ?? 1;
      const tintBlue = appearance.tintBlue[entityIndex] ?? 1;
      const vertexOffset = localEntity * plan.vertexCount;
      for (let vertex = 0; vertex < plan.vertexCount; vertex++) {
        const localColorOffset = vertex * 4;
        const targetOffset = (vertexOffset + vertex) * 4;
        const variant = (plan.facetVariants[vertex] ?? 0) / FACET_VARIANT_DENOMINATOR;
        const shade = 0.86 + variant * 0.18;
        colors[targetOffset] = active
          ? Math.min(1, (plan.localColors[localColorOffset] ?? 0) * tintRed * shade)
          : 0;
        colors[targetOffset + 1] = active
          ? Math.min(1, (plan.localColors[localColorOffset + 1] ?? 0) * tintGreen * shade)
          : 0;
        colors[targetOffset + 2] = active
          ? Math.min(1, (plan.localColors[localColorOffset + 2] ?? 0) * tintBlue * shade)
          : 0;
        colors[targetOffset + 3] = active ? plan.localColors[localColorOffset + 3] ?? 1 : 0;
      }
    }
  }
}

/** 根据活动槽位和旋转保守半径计算批次包围盒。 */
export function computeBattlefieldEnvironmentBounds(
  state: BattlefieldEnvironmentArchetypeState,
  plan: BattlefieldEnvironmentMeshPlan,
): GeometryBounds {
  const maximumLocalX = Math.max(Math.abs(plan.bounds.minX), Math.abs(plan.bounds.maxX));
  const maximumLocalZ = Math.max(Math.abs(plan.bounds.minZ), Math.abs(plan.bounds.maxZ));
  const horizontalRadius = Math.hypot(maximumLocalX, maximumLocalZ);
  const { identity, transform } = state.data;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < state.enabledCount; index++) {
    if ((identity.active[index] ?? 0) === 0) {
      continue;
    }
    const x = transform.x[index] ?? 0;
    const y = transform.y[index] ?? 0;
    const z = transform.z[index] ?? 0;
    const scale = transform.scale[index] ?? 0;
    const radius = horizontalRadius * scale;
    minX = Math.min(minX, x - radius);
    minY = Math.min(minY, y + plan.bounds.minY * scale);
    minZ = Math.min(minZ, z - radius);
    maxX = Math.max(maxX, x + radius);
    maxY = Math.max(maxY, y + plan.bounds.maxY * scale);
    maxZ = Math.max(maxZ, z + radius);
  }
  if (!Number.isFinite(minX)) {
    return Object.freeze({ minX: -1, minY: HIDDEN_Y - 1, minZ: -1, maxX: 1, maxY: HIDDEN_Y + 1, maxZ: 1 });
  }
  return Object.freeze({ minX, minY, minZ, maxX, maxY, maxZ });
}

function validateStreamCapacity(streams: VertexStreams, vertexCount: number): void {
  if (streams.positions.length < vertexCount * 3
    || streams.normals.length < vertexCount * 3
    || streams.colors.length < vertexCount * 4) {
    throw new Error('环境批次顶点流容量不足。');
  }
}
