import {
  type BattlefieldMeleeTargetQuery,
  type BattlefieldMeleeTargetSource,
  type MutableBattlefieldMeleeTarget,
} from '../population/battlefield-monster-target-registry';
import { moveAngleTowards } from '../../../core/math/scalar';

const DIRECTION_EPSILON_SQUARED = 0.000001;
const TARGET_RELEASE_RADIUS_SCALE = 1.25;
const MOVEMENT_HALF_ARC_RADIANS = 70 * Math.PI / 180;
const FACING_HALF_ARC_RADIANS = 100 * Math.PI / 180;
const TARGET_ANGLE_WEIGHT = 6;
const PREFERRED_TARGET_BONUS = 1_000;
const CHAIN_TARGET_TURN_RADIANS = 40 * Math.PI / 180;
const REPLACEMENT_TARGET_TURN_RADIANS = 70 * Math.PI / 180;

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
  private readonly query: Mutable<BattlefieldMeleeTargetQuery> = {
    originX: 0,
    originZ: 0,
    radius: 1,
    directionX: 0,
    directionZ: 1,
    halfArcRadians: FACING_HALF_ARC_RADIANS,
    angleWeight: TARGET_ANGLE_WEIGHT,
    preferredPopulationId: -1,
    preferredEntityId: -1,
    preferredTargetBonus: 0,
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
    turnReferenceHeading: number | null,
    result: MutableBattlefieldMeleeAim,
  ): void {
    if (!Number.isFinite(originX)
      || !Number.isFinite(originZ)
      || !Number.isFinite(acquireRadius)
      || !Number.isFinite(movementX)
      || !Number.isFinite(movementZ)
      || !Number.isFinite(currentHeading)
      || (turnReferenceHeading !== null && !Number.isFinite(turnReferenceHeading))
      || acquireRadius <= 0) {
      throw new Error('近战自动瞄准必须使用有限坐标、方向和正半径。');
    }
    this.configureQueryDirection(movementX, movementZ, currentHeading);
    if (this.tryWritePreferredTarget(
      targets,
      originX,
      originZ,
      acquireRadius,
      turnReferenceHeading,
      result,
    )) {
      return;
    }
    this.configureQuery(
      originX,
      originZ,
      acquireRadius,
      -1,
      -1,
      0,
    );
    if (targets.writeBestMeleeTarget(this.query, this.target)) {
      this.preferredPopulationId = this.target.populationId;
      this.preferredEntityId = this.target.entityId;
      if (this.writeTargetDirection(
        originX,
        originZ,
        turnReferenceHeading,
        REPLACEMENT_TARGET_TURN_RADIANS,
        result,
      )) {
        return;
      }
      this.releaseTarget();
    }
    this.writeFallbackDirection(
      movementX,
      movementZ,
      currentHeading,
      turnReferenceHeading,
      result,
    );
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
    turnReferenceHeading: number | null,
    result: MutableBattlefieldMeleeAim,
  ): boolean {
    if (this.preferredPopulationId < 0 || this.preferredEntityId < 0) {
      return false;
    }
    this.configureQuery(
      originX,
      originZ,
      acquireRadius * TARGET_RELEASE_RADIUS_SCALE,
      this.preferredPopulationId,
      this.preferredEntityId,
      PREFERRED_TARGET_BONUS,
    );
    const found = targets.writeBestMeleeTarget(this.query, this.target);
    if (found
      && this.target.populationId === this.preferredPopulationId
      && this.target.entityId === this.preferredEntityId
      && this.writeTargetDirection(
        originX,
        originZ,
        turnReferenceHeading,
        CHAIN_TARGET_TURN_RADIANS,
        result,
      )) {
      return true;
    }
    this.releaseTarget();
    return false;
  }

  private writeTargetDirection(
    originX: number,
    originZ: number,
    turnReferenceHeading: number | null,
    maximumChainTurn: number,
    result: MutableBattlefieldMeleeAim,
  ): boolean {
    const deltaX = this.target.x - originX;
    const deltaZ = this.target.z - originZ;
    const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
    if (lengthSquared <= DIRECTION_EPSILON_SQUARED) {
      return false;
    }
    const inverseLength = 1 / Math.sqrt(lengthSquared);
    const targetHeading = Math.atan2(deltaX * inverseLength, deltaZ * inverseLength);
    const resolvedHeading = turnReferenceHeading === null
      ? targetHeading
      : moveAngleTowards(turnReferenceHeading, targetHeading, maximumChainTurn);
    result.directionX = Math.sin(resolvedHeading);
    result.directionZ = Math.cos(resolvedHeading);
    result.targeted = true;
    result.populationId = this.target.populationId;
    result.entityId = this.target.entityId;
    return true;
  }

  private writeFallbackDirection(
    movementX: number,
    movementZ: number,
    currentHeading: number,
    turnReferenceHeading: number | null,
    result: MutableBattlefieldMeleeAim,
  ): void {
    const movementLengthSquared = movementX * movementX + movementZ * movementZ;
    if (movementLengthSquared > DIRECTION_EPSILON_SQUARED) {
      const inverseLength = 1 / Math.sqrt(movementLengthSquared);
      this.writeConstrainedFallback(
        movementX * inverseLength,
        movementZ * inverseLength,
        turnReferenceHeading,
        result,
      );
    } else if (this.hasMovementHistory) {
      this.writeConstrainedFallback(
        this.lastMovementX,
        this.lastMovementZ,
        turnReferenceHeading,
        result,
      );
    } else {
      this.writeConstrainedFallback(
        Math.sin(currentHeading),
        Math.cos(currentHeading),
        turnReferenceHeading,
        result,
      );
    }
    result.targeted = false;
    result.populationId = -1;
    result.entityId = -1;
  }

  /** 有移动时按七十度扇区搜索，静止时按人物前方一百度扇区搜索。 */
  private configureQueryDirection(
    movementX: number,
    movementZ: number,
    currentHeading: number,
  ): void {
    const lengthSquared = movementX * movementX + movementZ * movementZ;
    if (lengthSquared > DIRECTION_EPSILON_SQUARED) {
      const inverseLength = 1 / Math.sqrt(lengthSquared);
      this.query.directionX = movementX * inverseLength;
      this.query.directionZ = movementZ * inverseLength;
      this.query.halfArcRadians = MOVEMENT_HALF_ARC_RADIANS;
      return;
    }
    this.query.directionX = Math.sin(currentHeading);
    this.query.directionZ = Math.cos(currentHeading);
    this.query.halfArcRadians = FACING_HALF_ARC_RADIANS;
  }

  private configureQuery(
    originX: number,
    originZ: number,
    radius: number,
    preferredPopulationId: number,
    preferredEntityId: number,
    preferredTargetBonus: number,
  ): void {
    this.query.originX = originX;
    this.query.originZ = originZ;
    this.query.radius = radius;
    this.query.preferredPopulationId = preferredPopulationId;
    this.query.preferredEntityId = preferredEntityId;
    this.query.preferredTargetBonus = preferredTargetBonus;
  }

  private writeConstrainedFallback(
    directionX: number,
    directionZ: number,
    turnReferenceHeading: number | null,
    result: MutableBattlefieldMeleeAim,
  ): void {
    if (turnReferenceHeading === null) {
      result.directionX = directionX;
      result.directionZ = directionZ;
      return;
    }
    const heading = moveAngleTowards(
      turnReferenceHeading,
      Math.atan2(directionX, directionZ),
      CHAIN_TARGET_TURN_RADIANS,
    );
    result.directionX = Math.sin(heading);
    result.directionZ = Math.cos(heading);
  }
}

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
