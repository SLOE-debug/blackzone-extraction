import { BATTLEFIELD_ENVIRONMENT_MESH_PLANS } from '../geometry/battlefield-environment-mesh-plans';
import { type BattlefieldEnvironmentMeshPlan } from '../geometry/battlefield-environment-mesh-plan';
import { BATTLEFIELD_ENVIRONMENT_PROTOTYPES } from '../model/battlefield-environment-prototype';
import {
  type BattlefieldEnvironmentArchetypeState,
  BattlefieldEnvironmentWorldState,
} from '../model/battlefield-environment-state';

const FACET_VARIANT_DENOMINATOR = 6;
const HIDDEN_Y = -1000;

/** 统一环境大网格中一个原型区段可写的顶点流。 */
export interface BattlefieldEnvironmentSectionStreams {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
}

/** 可复用的世界环境包围盒写入目标。 */
export interface MutableBattlefieldEnvironmentBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/** 将一个原型的全部固定槽位写入统一环境大网格区段。 */
export function evaluateBattlefieldEnvironmentSection(
  state: BattlefieldEnvironmentArchetypeState,
  plan: BattlefieldEnvironmentMeshPlan,
  streams: BattlefieldEnvironmentSectionStreams,
): void {
  validateStreamCapacity(streams, plan.vertexCount * state.count);
  const { identity, transform, appearance } = state.data;
  for (let entityIndex = 0; entityIndex < state.count; entityIndex++) {
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
  target: MutableBattlefieldEnvironmentBounds,
): void {
  target.minX = Number.POSITIVE_INFINITY;
  target.minY = Number.POSITIVE_INFINITY;
  target.minZ = Number.POSITIVE_INFINITY;
  target.maxX = Number.NEGATIVE_INFINITY;
  target.maxY = Number.NEGATIVE_INFINITY;
  target.maxZ = Number.NEGATIVE_INFINITY;

  for (const prototype of BATTLEFIELD_ENVIRONMENT_PROTOTYPES) {
    expandBounds(world.get(prototype), BATTLEFIELD_ENVIRONMENT_MESH_PLANS[prototype], target);
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
