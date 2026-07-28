import { type ProjectileWeaponDefinition } from '../../../../../core/equipment/equipment';
import { BattlefieldArrowState } from '../model/battlefield-arrow-state';
import { type BattlefieldArrowPopulation } from './battlefield-arrow-population';

/** 把箭袋槽位初始化为具有蓄力倍率与穿透次数的去程箭。 */
export class BattlefieldArrowLaunchSystem {
  public launch<TId extends string>(
    arrows: BattlefieldArrowPopulation,
    index: number,
    definition: Readonly<ProjectileWeaponDefinition<TId>>,
    originX: number,
    originY: number,
    originZ: number,
    directionX: number,
    directionY: number,
    directionZ: number,
    chargeRatio: number,
    attackSequenceId: number,
  ): void {
    const length = Math.hypot(directionX, directionY, directionZ);
    if (length <= 0.000001 || !Number.isFinite(length)) {
      throw new Error('箭矢发射方向必须为有限非零向量。');
    }
    const charge = Math.max(0, Math.min(1, chargeRatio));
    const inverseLength = 1 / length;
    arrows.positionX[index] = originX;
    arrows.positionY[index] = originY;
    arrows.positionZ[index] = originZ;
    arrows.previousX[index] = originX;
    arrows.previousY[index] = originY;
    arrows.previousZ[index] = originZ;
    arrows.directionX[index] = directionX * inverseLength;
    arrows.directionY[index] = directionY * inverseLength;
    arrows.directionZ[index] = directionZ * inverseLength;
    arrows.damage[index] = definition.baseDamage * (
      1 + (definition.maximumChargeDamageScale - 1) * charge
    );
    arrows.speed[index] = definition.projectileSpeed * (
      1 + (definition.maximumChargeSpeedScale - 1) * charge
    );
    arrows.remainingRange[index] = definition.maximumRange;
    arrows.pierceRemaining[index] = charge >= 1
      ? definition.maximumChargePierceCount
      : 0;
    arrows.attackSequenceId[index] = attackSequenceId;
    arrows.state[index] = BattlefieldArrowState.Flying;
    arrows.markDeparted(index);
  }
}
