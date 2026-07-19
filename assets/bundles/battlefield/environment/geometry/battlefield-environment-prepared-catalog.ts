import {
  BATTLEFIELD_ENVIRONMENT_CATALOG,
  type BattlefieldEnvironmentPrototypeDefinition,
} from '../catalog/battlefield-environment-catalog';
import { type BattlefieldEnvironmentMeshPlan } from './battlefield-environment-mesh-plan';

/** 初始化期已经编译固定局部拓扑的环境原型定义。 */
export interface PreparedBattlefieldEnvironmentPrototype {
  readonly definition: BattlefieldEnvironmentPrototypeDefinition;
  readonly plan: BattlefieldEnvironmentMeshPlan;
}

/** Environment 显式 prepare 阶段持有的有序原型编译结果。 */
export type PreparedBattlefieldEnvironmentCatalog =
  readonly PreparedBattlefieldEnvironmentPrototype[];

/** 在 Feature 初始化阶段由唯一 Catalog 编译全部固定局部拓扑。 */
export function prepareBattlefieldEnvironmentCatalog(): PreparedBattlefieldEnvironmentCatalog {
  return Object.freeze(
    BATTLEFIELD_ENVIRONMENT_CATALOG.map((definition) => Object.freeze({
      definition,
      plan: definition.compilePlan(),
    })),
  );
}
