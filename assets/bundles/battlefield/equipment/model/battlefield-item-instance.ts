import { EquipmentId } from '../catalog/equipment-id';

/** 在地面、物品栏和手持状态间保持不变的装备身份。 */
export interface BattlefieldItemInstance {
  readonly equipmentId: EquipmentId;
  readonly itemInstanceSeed: number;
}

/** 校验装备永久实例种子，避免世界运行时身份混入物品所有权。 */
export function validateBattlefieldItemInstanceSeed(itemInstanceSeed: number): void {
  if (!Number.isSafeInteger(itemInstanceSeed)
    || itemInstanceSeed <= 0
    || itemInstanceSeed > 0xffffffff) {
    throw new Error('装备实例种子必须是正 Uint32 安全整数。');
  }
}

/** 为单次战场会话分配不会与世界运行时 ID 混用的永久物品种子。 */
export class BattlefieldItemInstanceSeedSequence {
  private nextItemInstanceSeed = 1;

  public allocate(): number {
    const seed = this.nextItemInstanceSeed;
    validateBattlefieldItemInstanceSeed(seed);
    this.nextItemInstanceSeed = seed >= 0xffffffff ? 1 : seed + 1;
    return seed;
  }
}
