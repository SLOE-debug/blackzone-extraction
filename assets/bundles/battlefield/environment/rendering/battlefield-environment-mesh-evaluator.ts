import { type VertexStreams } from '../../../../core/mesh/vertex-streams';
import { type UnlitColorVertexSemantic } from '../../../../core/mesh/vertex-layout';
import { type PreparedBattlefieldEnvironmentCatalog } from '../geometry/battlefield-environment-prepared-catalog';
import { type BattlefieldEnvironmentMeshPlan } from '../geometry/battlefield-environment-mesh-plan';
import {
  type BattlefieldEnvironmentArchetypeState,
  BattlefieldEnvironmentWorldState,
} from '../model/battlefield-environment-state';

const FACET_VARIANT_DENOMINATOR = 6;
const HIDDEN_Y = -1000;

/** 统一环境大网格中一个原型区段可写的精确无光顶点流。 */
export type BattlefieldEnvironmentSectionStreams =
  VertexStreams<UnlitColorVertexSemantic>;

/** 可复用的世界环境包围盒写入目标。 */
export interface MutableBattlefieldEnvironmentBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/** 将一个原型的连续槽位范围写入统一环境大网格区段。 */
export function evaluateBattlefieldEnvironmentSectionRange(
  state: BattlefieldEnvironmentArchetypeState,
  plan: BattlefieldEnvironmentMeshPlan,
  streams: BattlefieldEnvironmentSectionStreams,
  firstEntity: number,
  entityCount: number,
): void {
  validateStreamCapacity(streams, plan.vertexCount * state.count);
  if (!Number.isInteger(firstEntity) || firstEntity < 0
    || !Number.isInteger(entityCount) || entityCount <= 0
    || firstEntity + entityCount > state.count) {
    throw new Error('环境批次实体求值范围越界。');
  }
  const { identity, transform, appearance } = state.data;
  const endEntity = firstEntity + entityCount;
  for (let entityIndex = firstEntity; entityIndex < endEntity; entityIndex++) {
    const active = entityIndex < state.enabledCount
      && (identity.active[entityIndex] ?? 0) !== 0;
    const x = active ? transform.x[entityIndex] ?? 0 : 0;
    const y = active ? transform.y[entityIndex] ?? 0 : HIDDEN_Y;
    const z = active ? transform.z[entityIndex] ?? 0 : 0;
    const scale = active ? transform.scale[entityIndex] ?? 0 : 0;
    const heading = transform.heading[entityIndex] ?? 0;
    const cosine = Math.cos(heading);
    const sine = Math.sin(heading);
    const tintRed = appearance.tintRed[entityIndex] ?? 1;
    const tintGreen = appearance.tintGreen[entityIndex] ?? 1;
    const tintBlue = appearance.tintBlue[entityIndex] ?? 1;
    const vertexOffset = entityIndex * plan.vertexCount;
    for (let vertex = 0; vertex < plan.vertexCount; vertex++) {
      const localPositionOffset = vertex * 3;
      const targetPositionOffset = (vertexOffset + vertex) * 3;
      const localX = (plan.localPositions[localPositionOffset] ?? 0) * scale;
      const localY = (plan.localPositions[localPositionOffset + 1] ?? 0) * scale;
      const localZ = (plan.localPositions[localPositionOffset + 2] ?? 0) * scale;
      streams.positions[targetPositionOffset] = x + localX * cosine + localZ * sine;
      streams.positions[targetPositionOffset + 1] = y + localY;
      streams.positions[targetPositionOffset + 2] = z - localX * sine + localZ * cosine;

      const localColorOffset = vertex * 4;
      const targetColorOffset = (vertexOffset + vertex) * 4;
      const variant = (plan.facetVariants[vertex] ?? 0) / FACET_VARIANT_DENOMINATOR;
      const shade = 0.86 + variant * 0.18;
      streams.colors[targetColorOffset] = active
        ? Math.min(1, (plan.localColors[localColorOffset] ?? 0) * tintRed * shade)
        : 0;
      streams.colors[targetColorOffset + 1] = active
        ? Math.min(1, (plan.localColors[localColorOffset + 1] ?? 0) * tintGreen * shade)
        : 0;
      streams.colors[targetColorOffset + 2] = active
        ? Math.min(1, (plan.localColors[localColorOffset + 2] ?? 0) * tintBlue * shade)
        : 0;
      streams.colors[targetColorOffset + 3] = active
        ? plan.localColors[localColorOffset + 3] ?? 1
        : 0;
    }
  }
}

/** 聚合全部活动原型并原地写入统一大网格包围盒。 */
export function writeBattlefieldEnvironmentWorldBounds(
  world: BattlefieldEnvironmentWorldState,
  preparedCatalog: PreparedBattlefieldEnvironmentCatalog,
  target: MutableBattlefieldEnvironmentBounds,
): void {
  target.minX = Number.POSITIVE_INFINITY;
  target.minY = Number.POSITIVE_INFINITY;
  target.minZ = Number.POSITIVE_INFINITY;
  target.maxX = Number.NEGATIVE_INFINITY;
  target.maxY = Number.NEGATIVE_INFINITY;
  target.maxZ = Number.NEGATIVE_INFINITY;

  for (const prepared of preparedCatalog) {
    expandBounds(
      world.get(prepared.definition.prototype),
      prepared.plan,
      target,
    );
  }
  if (!Number.isFinite(target.minX)) {
    target.minX = -1;
    target.minY = HIDDEN_Y - 1;
    target.minZ = -1;
    target.maxX = 1;
    target.maxY = HIDDEN_Y + 1;
    target.maxZ = 1;
  }
}

function expandBounds(
  state: BattlefieldEnvironmentArchetypeState,
  plan: BattlefieldEnvironmentMeshPlan,
  target: MutableBattlefieldEnvironmentBounds,
): void {
  const maximumLocalX = Math.max(Math.abs(plan.bounds.minX), Math.abs(plan.bounds.maxX));
  const maximumLocalZ = Math.max(Math.abs(plan.bounds.minZ), Math.abs(plan.bounds.maxZ));
  const horizontalRadius = Math.hypot(maximumLocalX, maximumLocalZ);
  const { identity, transform } = state.data;
  for (let index = 0; index < state.enabledCount; index++) {
    if ((identity.active[index] ?? 0) === 0) {
      continue;
    }
    const x = transform.x[index] ?? 0;
    const y = transform.y[index] ?? 0;
    const z = transform.z[index] ?? 0;
    const scale = transform.scale[index] ?? 0;
    const radius = horizontalRadius * scale;
    target.minX = Math.min(target.minX, x - radius);
    target.minY = Math.min(target.minY, y + plan.bounds.minY * scale);
    target.minZ = Math.min(target.minZ, z - radius);
    target.maxX = Math.max(target.maxX, x + radius);
    target.maxY = Math.max(target.maxY, y + plan.bounds.maxY * scale);
    target.maxZ = Math.max(target.maxZ, z + radius);
  }
}

function validateStreamCapacity(
  streams: BattlefieldEnvironmentSectionStreams,
  vertexCount: number,
): void {
  if (streams.positions.length < vertexCount * 3
    || streams.colors.length < vertexCount * 4) {
    throw new Error('环境批次顶点流容量不足。');
  }
}
