import { type GeometryBounds } from '../../../../core/geometry/buffer-geometry';
import { type MeshPlan } from '../../../../core/mesh/mesh-plan';

/** 编译后环境原型的固定局部网格数据。 */
export interface BattlefieldEnvironmentMeshPlan extends MeshPlan {
  readonly localPositions: Float32Array;
  readonly localNormals: Float32Array;
  readonly localColors: Float32Array;
  readonly facetVariants: Uint8Array;
  readonly bounds: GeometryBounds;
}
