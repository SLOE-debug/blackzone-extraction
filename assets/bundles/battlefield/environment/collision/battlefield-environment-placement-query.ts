import {
  type BattlefieldEnvironmentPrototype,
} from '../catalog/battlefield-environment-catalog';
import {
  type PreparedBattlefieldEnvironmentCatalog,
} from '../geometry/battlefield-environment-prepared-catalog';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';

/** 使用活动环境 SoA 与程序网格真实水平边界执行静态放置避让查询。 */
export class BattlefieldEnvironmentPlacementQuery {
  private readonly horizontalRadiusByPrototype: ReadonlyMap<
    BattlefieldEnvironmentPrototype,
    number
  >;

  constructor(
    private readonly world: BattlefieldEnvironmentWorldState,
    preparedCatalog: PreparedBattlefieldEnvironmentCatalog,
  ) {
    this.horizontalRadiusByPrototype = new Map(preparedCatalog.map((prepared) => {
      const bounds = prepared.plan.bounds;
      const maximumX = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX));
      const maximumZ = Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ));
      return [prepared.definition.prototype, Math.hypot(maximumX, maximumZ)] as const;
    }));
  }

  /** 判断指定圆形占地区域是否避开选定环境原型的全部活动实体。 */
  public isAreaClearOf(
    prototypes: readonly BattlefieldEnvironmentPrototype[],
    x: number,
    z: number,
    clearanceRadius: number,
  ): boolean {
    if (!Number.isFinite(x)
      || !Number.isFinite(z)
      || !Number.isFinite(clearanceRadius)
      || clearanceRadius < 0) {
      throw new Error('环境放置查询必须使用有限坐标和非负避让半径。');
    }
    for (const prototype of prototypes) {
      const state = this.world.get(prototype);
      const baseRadius = this.horizontalRadiusByPrototype.get(prototype);
      if (baseRadius === undefined) {
        throw new Error(`环境放置查询缺少原型边界：${prototype}。`);
      }
      const { identity, transform } = state.data;
      for (let index = 0; index < state.enabledCount; index++) {
        if ((identity.active[index] ?? 0) === 0) {
          continue;
        }
        const combinedRadius = clearanceRadius
          + baseRadius * (transform.scale[index] ?? 0);
        const deltaX = x - (transform.x[index] ?? 0);
        const deltaZ = z - (transform.z[index] ?? 0);
        if (deltaX * deltaX + deltaZ * deltaZ < combinedRadius * combinedRadius) {
          return false;
        }
      }
    }
    return true;
  }
}
