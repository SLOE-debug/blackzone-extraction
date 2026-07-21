import { AmmunitionType } from '../../../../core/equipment/equipment';

/** 玩家在武器弹仓之外持有的有限备用弹药库存。 */
export class WeaponAmmunitionReserve {
  private readonly rounds: Record<AmmunitionType, number> = {
    [AmmunitionType.HandgunRound]: 0,
    [AmmunitionType.ShotgunShell]: 0,
  };

  /** 查询一种口径当前尚未装入武器的弹药数量。 */
  public get(ammunitionType: AmmunitionType): number {
    return this.rounds[ammunitionType];
  }

  /** 把世界弹药拾取物提供的完整数量加入对应库存。 */
  public add(ammunitionType: AmmunitionType, rounds: number): void {
    validateRoundCount(rounds, '拾取弹药数量');
    const next = this.rounds[ammunitionType] + rounds;
    if (!Number.isSafeInteger(next)) {
      throw new Error('玩家备用弹药数量超过安全整数范围。');
    }
    this.rounds[ammunitionType] = next;
  }

  /** 从对应口径中取出不超过请求数量的弹药并返回实际取出量。 */
  public take(ammunitionType: AmmunitionType, requestedRounds: number): number {
    validateRoundCount(requestedRounds, '装填请求数量');
    const available = this.rounds[ammunitionType];
    const taken = Math.min(available, requestedRounds);
    this.rounds[ammunitionType] = available - taken;
    return taken;
  }
}

function validateRoundCount(rounds: number, label: string): void {
  if (!Number.isSafeInteger(rounds) || rounds <= 0) {
    throw new Error(`${label}必须是正安全整数。`);
  }
}
