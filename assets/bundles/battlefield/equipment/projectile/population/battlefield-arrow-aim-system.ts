import {
  type BattlefieldArrowAimQuery,
  type BattlefieldArrowCombatTarget,
  type MutableBattlefieldArrowAimTarget,
} from '../model/battlefield-arrow-query';

const FALLBACK_AIM_DISTANCE = 19;
const FALLBACK_AIM_HEIGHT = 1.25;

export interface MutableBattlefieldArrowAimDirection {
  x: number;
  y: number;
  z: number;
}

/** 保持右摇杆平面方向不变，只把箭的垂直方向对齐到怪物躯干或远处地表。 */
export class BattlefieldArrowAimSystem {
  private readonly query: Mutable<BattlefieldArrowAimQuery> = {
    originX: 0,
    originY: 0,
    originZ: 0,
    directionX: 0,
    directionZ: 1,
    maximumDistance: 1,
    projectileRadius: 0.1,
  };
  private readonly target: MutableBattlefieldArrowAimTarget = { x: 0, y: 0, z: 0 };

  public writeDirection(
    combatTarget: BattlefieldArrowCombatTarget,
    originX: number,
    originY: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    maximumDistance: number,
    projectileRadius: number,
    groundY: number,
    result: MutableBattlefieldArrowAimDirection,
  ): void {
    const planarLength = Math.max(0.0001, Math.hypot(directionX, directionZ));
    const planarX = directionX / planarLength;
    const planarZ = directionZ / planarLength;
    this.query.originX = originX;
    this.query.originY = originY;
    this.query.originZ = originZ;
    this.query.directionX = planarX;
    this.query.directionZ = planarZ;
    this.query.maximumDistance = maximumDistance;
    this.query.projectileRadius = projectileRadius;
    const hasTarget = combatTarget.writeBestArrowAimTarget(this.query, this.target);
    const targetX = hasTarget ? this.target.x : originX + planarX * FALLBACK_AIM_DISTANCE;
    const targetY = hasTarget ? this.target.y : groundY + FALLBACK_AIM_HEIGHT;
    const targetZ = hasTarget ? this.target.z : originZ + planarZ * FALLBACK_AIM_DISTANCE;
    const distance = Math.max(0.0001, Math.hypot(targetX - originX, targetZ - originZ));
    result.x = planarX;
    result.y = (targetY - originY) / distance;
    result.z = planarZ;
  }
}

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
