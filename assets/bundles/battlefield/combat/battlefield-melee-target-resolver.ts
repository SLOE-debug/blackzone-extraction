import {
  type BattlefieldMeleeTargetSource,
  type MutableBattlefieldMeleeTarget,
} from '../population/battlefield-monster-target-registry';

const DIRECTION_EPSILON_SQUARED = 0.000001;
const TARGET_RELEASE_RADIUS_SCALE = 1.25;

/** 输入系统复用的近战瞄准结果。 */
export interface MutableBattlefieldMeleeAim {
  directionX: number;
  directionZ: number;
  targeted: boolean;
  populationId: number;
  entityId: number;
}

/**
 * 按“稳定目标、当前移动、最后移动、人物朝向”优先级解析一次动作方向。
 *
 * 解析器只在调用方请求新动作时评估目标；进行中的武器状态继续持有自己的锁定方向。
 */
export class BattlefieldMeleeTargetResolver {
  private readonly target: MutableBattlefieldMeleeTarget = {
    populationId: -1,
    entityId: -1,
    x: 0,
    z: 0,
    distanceSquared: 0,
  };
  private preferredPopulationId = -1;
  private preferredEntityId = -1;
  private lastMovementX = 0;
  private lastMovementZ = 1;
  private hasMovementHistory = false;

  /** 记录最近一次非零左摇杆世界方向，供静止攻击回退。 */
  public observeMovement(directionX: number, directionZ: number): void {
    if (!Number.isFinite(directionX) || !Number.isFinite(directionZ)) {
      throw new Error('近战移动方向必须是有限数值。');
    }
    const lengthSquared = directionX * directionX + directionZ * directionZ;
    if (lengthSquared <= DIRECTION_EPSILON_SQUARED) {
      return;
    }
    const inverseLength = 1 / Math.sqrt(lengthSquared);
    this.lastMovementX = directionX * inverseLength;
    this.lastMovementZ = directionZ * inverseLength;
    this.hasMovementHistory = true;
  }

  /** 在一个新攻击或定向技能开始前写出唯一方向。 */
  public writeAim(
    targets: BattlefieldMeleeTargetSource,
    originX: number,
    originZ: number,
    acquireRadius: number,
    movementX: number,
    movementZ: number,
    currentHeading: number,
    result: MutableBattlefieldMeleeAim,
  ): void {
    if (!Number.isFinite(originX)
      || !Number.isFinite(originZ)
      || !Number.isFinite(acquireRadius)
      || !Number.isFinite(movementX)
      || !Number.isFinite(movementZ)
      || !Number.isFinite(currentHeading)
      || acquireRadius <= 0) {
      throw new Error('近战自动瞄准必须使用有限坐标、方向和正半径。');
    }
    if (this.tryWritePreferredTarget(targets, originX, originZ, acquireRadius, result)) {
      return;
    }
    if (targets.writeBestMeleeTarget(
      originX,
      originZ,
      acquireRadius,
      -1,
      -1,
      this.target,
    )) {
      this.preferredPopulationId = this.target.populationId;
      this.preferredEntityId = this.target.entityId;
      if (this.writeTargetDirection(originX, originZ, result)) {
        return;
      }
      this.releaseTarget();
    }
    this.writeFallbackDirection(movementX, movementZ, currentHeading, result);
  }

  /** 玩家停止普通攻击时释放目标迟滞，但保留最后移动方向。 */
  public releaseTarget(): void {
    this.preferredPopulationId = -1;
    this.preferredEntityId = -1;
  }

  private tryWritePreferredTarget(
    targets: BattlefieldMeleeTargetSource,
    originX: number,
    originZ: number,
    acquireRadius: number,
    result: MutableBattlefieldMeleeAim,
  ): boolean {
    if (this.preferredPopulationId < 0 || this.preferredEntityId < 0) {
      return false;
    }
    const found = targets.writeBestMeleeTarget(
      originX,
      originZ,
      acquireRadius * TARGET_RELEASE_RADIUS_SCALE,
      this.preferredPopulationId,
      this.preferredEntityId,
      this.target,
    );
    if (found
      && this.target.populationId === this.preferredPopulationId
      && this.target.entityId === this.preferredEntityId
      && this.writeTargetDirection(originX, originZ, result)) {
      return true;
    }
    this.releaseTarget();
    return false;
  }

  private writeTargetDirection(
    originX: number,
    originZ: number,
    result: MutableBattlefieldMeleeAim,
  ): boolean {
    const deltaX = this.target.x - originX;
    const deltaZ = this.target.z - originZ;
    const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
    if (lengthSquared <= DIRECTION_EPSILON_SQUARED) {
      return false;
    }
    const inverseLength = 1 / Math.sqrt(lengthSquared);
    result.directionX = deltaX * inverseLength;
    result.directionZ = deltaZ * inverseLength;
    result.targeted = true;
    result.populationId = this.target.populationId;
    result.entityId = this.target.entityId;
    return true;
  }

  private writeFallbackDirection(
    movementX: number,
    movementZ: number,
    currentHeading: number,
    result: MutableBattlefieldMeleeAim,
  ): void {
    const movementLengthSquared = movementX * movementX + movementZ * movementZ;
    if (movementLengthSquared > DIRECTION_EPSILON_SQUARED) {
      const inverseLength = 1 / Math.sqrt(movementLengthSquared);
      result.directionX = movementX * inverseLength;
      result.directionZ = movementZ * inverseLength;
    } else if (this.hasMovementHistory) {
      result.directionX = this.lastMovementX;
      result.directionZ = this.lastMovementZ;
    } else {
      result.directionX = Math.sin(currentHeading);
      result.directionZ = Math.cos(currentHeading);
    }
    result.targeted = false;
    result.populationId = -1;
    result.entityId = -1;
  }
}
