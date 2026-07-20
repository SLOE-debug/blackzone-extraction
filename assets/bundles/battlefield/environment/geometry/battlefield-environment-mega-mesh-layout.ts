import { GeometryIndexFormat } from '../../../../core/geometry/buffer-geometry';
import {
  type ComposedRepeatedMeshPlan,
  composeRepeatedMeshPlans,
  type RepeatedMeshPlanSection,
} from '../../../../core/mesh/mesh-plan-composer';
import { type VertexLayoutMeshPlan } from '../../../../core/mesh/mesh-plan';
import {
  type UnlitColorVertexSemantic,
  UNLIT_COLOR_LAYOUT,
} from '../../../../core/mesh/vertex-layout';
import { type BattlefieldEnvironmentPrototype } from '../catalog/battlefield-environment-catalog';
import { type BattlefieldEnvironmentMeshPlan } from './battlefield-environment-mesh-plan';
import {
  type PreparedBattlefieldEnvironmentCatalog,
} from './battlefield-environment-prepared-catalog';

/** 一个环境原型在统一大网格中的连续固定区段。 */
export type BattlefieldEnvironmentMegaMeshSection = RepeatedMeshPlanSection<
  BattlefieldEnvironmentPrototype,
  BattlefieldEnvironmentMeshPlan
>;

/** 全部环境原型共享的一份 Uint32 固定拓扑布局。 */
export interface BattlefieldEnvironmentMegaMeshLayout extends ComposedRepeatedMeshPlan<
  BattlefieldEnvironmentPrototype,
  BattlefieldEnvironmentMeshPlan
>, VertexLayoutMeshPlan<UnlitColorVertexSemantic> {
  readonly indices: Uint32Array;
}

/** 战场环境无论包含多少原型，都只提交一个渲染批次。 */
export const BATTLEFIELD_ENVIRONMENT_MESH_BATCH_COUNT = 1;

/** 将 Feature 原型容量策略转换为核心层只理解的重复计划组合。 */
export function compileBattlefieldEnvironmentMegaMeshLayout(
  preparedCatalog: PreparedBattlefieldEnvironmentCatalog,
): BattlefieldEnvironmentMegaMeshLayout {
  const composed = composeRepeatedMeshPlans(
    preparedCatalog.map((prepared) => Object.freeze({
      id: prepared.definition.prototype,
      plan: prepared.plan,
      repeatCount: prepared.definition.capacity,
    })),
    GeometryIndexFormat.Uint32,
  );
  const indices = composed.indices;
  if (!(indices instanceof Uint32Array)) {
    throw new Error('战场环境大网格必须使用 Uint32 索引缓冲。');
  }
  return Object.freeze({
    sections: composed.sections,
    vertexCount: composed.vertexCount,
    indexCount: composed.indexCount,
    indices,
    vertexLayout: UNLIT_COLOR_LAYOUT,
  });
}
