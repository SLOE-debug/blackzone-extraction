import {
  compileBattlefieldEnvironmentMegaMeshLayout,
  type BattlefieldEnvironmentMegaMeshLayout,
} from '../geometry/battlefield-environment-mega-mesh-layout';
import {
  prepareBattlefieldEnvironmentCatalog,
  type PreparedBattlefieldEnvironmentCatalog,
} from '../geometry/battlefield-environment-prepared-catalog';

/** Environment Population 初始化后独占复用的不可变编译结果。 */
export interface PreparedBattlefieldEnvironment {
  readonly prototypes: PreparedBattlefieldEnvironmentCatalog;
  readonly megaMeshLayout: BattlefieldEnvironmentMegaMeshLayout;
}

/**
 * 显式编译环境局部原型和统一大网格拓扑。
 *
 * 调用方负责保存返回值；Chunk 更新只重写实例顶点流，不得重新执行 prepare。
 */
export function prepareBattlefieldEnvironment(): PreparedBattlefieldEnvironment {
  const prototypes = prepareBattlefieldEnvironmentCatalog();
  return Object.freeze({
    prototypes,
    megaMeshLayout: compileBattlefieldEnvironmentMegaMeshLayout(prototypes),
  });
}
