import { type VenomLobberCombatOptions } from '../model/venom-lobber-combat-options';
import { VenomBombState } from '../model/venom-bomb-state';
import { VenomPoolState } from '../model/venom-pool-state';

/**
 * 推进全部抛物线毒弹、目标预警和落地酸池，并聚合玩家受到的范围效果。
 *
 * 毒弹命中既有酸池时会催化更大的爆炸并延长相邻酸池，形成效果影响效果的连锁。
 */
export class VenomBombSystem {
  public readonly bombs: VenomBombState;
  public readonly pools: VenomPoolState;
  private pendingDamage = 0;
  private currentMovementMultiplier = 1;

  constructor(
    populationCapacity: number,
    private readonly options: Readonly<VenomLobberCombatOptions>,
  ) {
    this.bombs = new VenomBombState(populationCapacity * 2);
    this.pools = new VenomPoolState(populationCapacity * 2);
  }

  /** 把一次尾刺施法写入固定毒弹槽位。 */
  public spawn(
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    arcHeight: number,
    startElevation: number,
  ): boolean {
    return this.bombs.spawn(
      originX,
      originY,
      targetX,
      targetY,
      startElevation,
      arcHeight,
      this.options.projectileFlightSeconds,
    );
  }

  /** 推进毒弹与酸池；目标失效时仍保持视觉生命周期但不再结算玩家效果。 */
  public update(
    deltaTime: number,
    targetActive: boolean,
    targetX: number,
    targetY: number,
    targetCollisionRadius: number,
  ): void {
    this.pendingDamage = 0;
    this.currentMovementMultiplier = 1;
    this.updateBombs(deltaTime, targetActive, targetX, targetY, targetCollisionRadius);
    this.updatePools(deltaTime, targetActive, targetX, targetY, targetCollisionRadius);
  }

  public consumeDamage(): number {
    const damage = this.pendingDamage;
    this.pendingDamage = 0;
    return damage;
  }

  /** 当前帧酸池对玩家移动速度施加的最强乘数。 */
  public get movementMultiplier(): number {
    return this.currentMovementMultiplier;
  }

  private updateBombs(
    deltaTime: number,
    targetActive: boolean,
    targetX: number,
    targetY: number,
    targetCollisionRadius: number,
  ): void {
    const bombs = this.bombs;
    for (let index = 0; index < bombs.capacity; index++) {
      if ((bombs.active[index] ?? 0) === 0) {
        continue;
      }
      const elapsed = (bombs.elapsed[index] ?? 0) + deltaTime;
      bombs.elapsed[index] = elapsed;
      if (elapsed < (bombs.duration[index] ?? 0)) {
        continue;
      }
      bombs.active[index] = 0;
      const impactX = bombs.targetX[index] ?? 0;
      const impactY = bombs.targetY[index] ?? 0;
      const catalyzed = this.catalyzeOverlappingPools(impactX, impactY);
      const blastRadius = this.options.blastRadius
        * (catalyzed ? this.options.catalystRadiusMultiplier : 1);
      const blastDamage = this.options.blastDamage
        * (catalyzed ? this.options.catalystDamageMultiplier : 1);
      if (targetActive && isTargetInside(
        impactX,
        impactY,
        blastRadius,
        targetX,
        targetY,
        targetCollisionRadius,
      )) {
        this.pendingDamage += blastDamage;
      }
      this.pools.spawn(
        impactX,
        impactY,
        this.options.poolRadius * (catalyzed ? this.options.catalystRadiusMultiplier : 1),
        this.options.poolDurationSeconds
          * (catalyzed ? this.options.catalystDurationMultiplier : 1),
        catalyzed,
      );
    }
  }

  private updatePools(
    deltaTime: number,
    targetActive: boolean,
    targetX: number,
    targetY: number,
    targetCollisionRadius: number,
  ): void {
    const pools = this.pools;
    for (let index = 0; index < pools.capacity; index++) {
      if ((pools.active[index] ?? 0) === 0) {
        continue;
      }
      const elapsed = (pools.elapsed[index] ?? 0) + deltaTime;
      pools.elapsed[index] = elapsed;
      if (elapsed >= (pools.duration[index] ?? 0)) {
        pools.active[index] = 0;
        continue;
      }
      if (!targetActive || !isTargetInside(
        pools.x[index] ?? 0,
        pools.y[index] ?? 0,
        pools.radius[index] ?? 0,
        targetX,
        targetY,
        targetCollisionRadius,
      )) {
        continue;
      }
      const catalystFactor = (pools.catalyzed[index] ?? 0) !== 0 ? 1.35 : 1;
      this.pendingDamage += this.options.poolDamagePerSecond * catalystFactor * deltaTime;
      this.currentMovementMultiplier = Math.min(
        this.currentMovementMultiplier,
        this.options.poolMovementMultiplier / Math.sqrt(catalystFactor),
      );
    }
  }

  /** 催化撞点附近的既有酸池，并返回这次爆炸是否进入连锁强化。 */
  private catalyzeOverlappingPools(x: number, y: number): boolean {
    const pools = this.pools;
    let catalyzed = false;
    for (let index = 0; index < pools.capacity; index++) {
      if ((pools.active[index] ?? 0) === 0) {
        continue;
      }
      const deltaX = (pools.x[index] ?? 0) - x;
      const deltaY = (pools.y[index] ?? 0) - y;
      const triggerRadius = (pools.radius[index] ?? 0) + this.options.poolRadius * 0.5;
      if (deltaX * deltaX + deltaY * deltaY > triggerRadius * triggerRadius) {
        continue;
      }
      catalyzed = true;
      pools.catalyzed[index] = 1;
      pools.radius[index] = Math.min(
        this.options.poolRadius * this.options.catalystRadiusMultiplier,
        (pools.radius[index] ?? 0) * 1.18,
      );
      pools.duration[index] = Math.max(
        pools.duration[index] ?? 0,
        (pools.elapsed[index] ?? 0)
          + this.options.poolDurationSeconds * this.options.catalystDurationMultiplier,
      );
    }
    return catalyzed;
  }
}

function isTargetInside(
  effectX: number,
  effectY: number,
  effectRadius: number,
  targetX: number,
  targetY: number,
  targetCollisionRadius: number,
): boolean {
  const deltaX = targetX - effectX;
  const deltaY = targetY - effectY;
  const contactRadius = effectRadius + targetCollisionRadius;
  return deltaX * deltaX + deltaY * deltaY <= contactRadius * contactRadius;
}
