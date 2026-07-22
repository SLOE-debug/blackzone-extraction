import {
  type MutableGeometryBounds,
  type UnlitColorBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';
import { type BattlefieldEnvironmentArchetypeState } from '../model/battlefield-environment-state';
import { type BattlefieldEnvironmentMeshPlan } from './battlefield-environment-mesh-plan';

const FACET_VARIANT_DENOMINATOR = 6;

/** 把一个环境实体的世界空间顶点和颜色写入统一目标几何。 */
export function writeBattlefieldEnvironmentEntity(
  state: BattlefieldEnvironmentArchetypeState,
  plan: BattlefieldEnvironmentMeshPlan,
  entityIndex: number,
  target: UnlitColorBufferGeometry,
  targetVertexOffset: number,
  bounds?: MutableGeometryBounds,
): void {
  const { transform, appearance } = state.data;
  const x = transform.x[entityIndex] ?? 0;
  const y = transform.y[entityIndex] ?? 0;
  const z = transform.z[entityIndex] ?? 0;
  const scale = transform.scale[entityIndex] ?? 0;
  const heading = transform.heading[entityIndex] ?? 0;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const tintRed = appearance.tintRed[entityIndex] ?? 1;
  const tintGreen = appearance.tintGreen[entityIndex] ?? 1;
  const tintBlue = appearance.tintBlue[entityIndex] ?? 1;
  for (let vertex = 0; vertex < plan.vertexCount; vertex++) {
    const localPositionOffset = vertex * 3;
    const targetPositionOffset = (targetVertexOffset + vertex) * 3;
    const localX = (plan.localPositions[localPositionOffset] ?? 0) * scale;
    const localY = (plan.localPositions[localPositionOffset + 1] ?? 0) * scale;
    const localZ = (plan.localPositions[localPositionOffset + 2] ?? 0) * scale;
    const worldX = x + localX * cosine + localZ * sine;
    const worldY = y + localY;
    const worldZ = z - localX * sine + localZ * cosine;
    target.positions[targetPositionOffset] = worldX;
    target.positions[targetPositionOffset + 1] = worldY;
    target.positions[targetPositionOffset + 2] = worldZ;
    if (bounds !== undefined) {
      includeBounds(bounds, worldX, worldY, worldZ);
    }

    const localColorOffset = vertex * 4;
    const targetColorOffset = (targetVertexOffset + vertex) * 4;
    const variant = (plan.facetVariants[vertex] ?? 0) / FACET_VARIANT_DENOMINATOR;
    const shade = 0.86 + variant * 0.18;
    target.colors[targetColorOffset] = Math.min(
      1,
      (plan.localColors[localColorOffset] ?? 0) * tintRed * shade,
    );
    target.colors[targetColorOffset + 1] = Math.min(
      1,
      (plan.localColors[localColorOffset + 1] ?? 0) * tintGreen * shade,
    );
    target.colors[targetColorOffset + 2] = Math.min(
      1,
      (plan.localColors[localColorOffset + 2] ?? 0) * tintBlue * shade,
    );
    target.colors[targetColorOffset + 3] = plan.localColors[localColorOffset + 3] ?? 1;
  }
}

/** 把局部固定索引重定位到统一环境网格的连续顶点区间。 */
export function copyBattlefieldEnvironmentEntityIndices(
  plan: BattlefieldEnvironmentMeshPlan,
  target: UnlitColorBufferGeometry,
  targetVertexOffset: number,
  targetIndexOffset: number,
): void {
  for (let index = 0; index < plan.indexCount; index++) {
    target.index[targetIndexOffset + index] = (plan.indices[index] ?? 0) + targetVertexOffset;
  }
}

function includeBounds(
  bounds: MutableGeometryBounds,
  x: number,
  y: number,
  z: number,
): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.maxZ = Math.max(bounds.maxZ, z);
}
