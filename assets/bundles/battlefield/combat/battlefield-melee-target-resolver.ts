import {
  MeleeTargetSwitchReason,
  type BattlefieldMeleeAimDebugState,
  type BattlefieldMeleeAttackDirectionQuery,
  type BattlefieldMeleeAttackDirectionSource,
  type MutableBattlefieldMeleeAttackDirection,
} from './battlefield-melee-attack-direction';

const DIRECTION_EPSILON_SQUARED = 0.000001;
const TARGET_RELEASE_RADIUS_SCALE = 1.4;
const CLOSE_THREAT_RADIUS_SCALE = 0.6;
const NORMAL_CHAIN_TURN_RADIANS = 100 * Math.PI / 180;
const INVALID_TARGET_TURN_RADIANS = 160 * Math.PI / 180;

/** 一次普通横扫方向决策所需的稳定武器与人物状态。 */
export interface BattlefieldMeleeAttackDirectionRequest {
  readonly originX: number;
  readonly originZ: number;
  readonly acquireRadius: number;
  readonly attackReach: number;
  readonly attackArcRadians: number;
  readonly currentHeading: number;
  readonly previousAttackHeading: number | null;
}

/**
 * 管理近战稳定目标、连段转角、无目标回退和调试快照。
 *
 * 解析器只在调用方请求新动作时规划；移动输入从不参与目标候选过滤。
 */
export class BattlefieldMeleeTargetResolver {
  private readonly query: Mutable<BattlefieldMeleeAttackDirectionQuery> = {
    originX: 0,
    originZ: 0,
    acquireRadius: 1,
    releaseRadius: TARGET_RELEASE_RADIUS_SCALE,
    attackReach: 1,
    attackArcRadians: Math.PI,
    closeThreatRadius: CLOSE_THREAT_RADIUS_SCALE,
    currentHeading: 0,
    previousAttackHeading: null,
    preferredPopulationId: -1,
    preferredEntityId: -1,
    maximumTurnRadians: Math.PI,
  };
  private readonly debug: Mutable<BattlefieldMeleeAimDebugState> = {
    selectedHeading: 0,
    expectedHitCount: 0,
    selectedScore: 0,
    anchorPopulationId: -1,
    anchorEntityId: -1,
    targetRetained: false,
    targetSwitchReason: MeleeTargetSwitchReason.None,
    previousAttackHeading: null,
    targetReleaseRadius: 0,
  };
  private preferredPopulationId = -1;
  private preferredEntityId = -1;
  private lastCombatDirectionX = 0;
  private lastCombatDirectionZ = 1;
  private hasCombatDirection = false;
  private lastMovementX = 0;
  private lastMovementZ = 1;
  private hasMovementHistory = false;

  public get debugState(): Readonly<BattlefieldMeleeAimDebugState> {
    return this.debug;
  }

  /** 记录最近一次非零左摇杆世界方向，只供从未取得有效朝向时最终回退。 */
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

  /** 在首次攻击或连段预输入窗口规划一次普通横扫方向。 */
  public writeBestAttackDirection(
    targets: BattlefieldMeleeAttackDirectionSource,
    request: Readonly<BattlefieldMeleeAttackDirectionRequest>,
    result: MutableBattlefieldMeleeAttackDirection,
  ): void {
    validateRequest(request);
    this.configureQuery(request, Math.PI);
    let targeted = targets.writeBestMeleeAttackDirection(this.query, result);
    const turnLimit = targeted ? this.resolveTurnLimit(result) : Math.PI;
    if (targeted
      && request.previousAttackHeading !== null
      && absoluteAngleDifference(request.previousAttackHeading, result.heading) > turnLimit) {
      this.query.maximumTurnRadians = turnLimit;
      targeted = targets.writeBestMeleeAttackDirection(this.query, result);
    }
    if (!targeted) {
      this.preferredPopulationId = -1;
      this.preferredEntityId = -1;
      this.writeFallbackDirection(request, result);
      return;
    }
    this.preferredPopulationId = result.anchorPopulationId;
    this.preferredEntityId = result.anchorEntityId;
    this.rememberCombatDirection(result.directionX, result.directionZ);
    this.writeDebugState(request, result);
  }

  /** 玩家松开攻击、失去武器或失去行动能力时释放稳定目标。 */
  public releaseTarget(
    reason: MeleeTargetSwitchReason = MeleeTargetSwitchReason.AttackReleased,
  ): void {
    this.preferredPopulationId = -1;
    this.preferredEntityId = -1;
    this.debug.anchorPopulationId = -1;
    this.debug.anchorEntityId = -1;
    this.debug.targetRetained = false;
    this.debug.targetSwitchReason = reason;
  }

  private configureQuery(
    request: Readonly<BattlefieldMeleeAttackDirectionRequest>,
    maximumTurnRadians: number,
  ): void {
    const query = this.query;
    query.originX = request.originX;
    query.originZ = request.originZ;
    query.acquireRadius = request.acquireRadius;
    query.releaseRadius = request.acquireRadius * TARGET_RELEASE_RADIUS_SCALE;
    query.attackReach = request.attackReach;
    query.attackArcRadians = request.attackArcRadians;
    query.closeThreatRadius = request.attackReach * CLOSE_THREAT_RADIUS_SCALE;
    query.currentHeading = request.currentHeading;
    query.previousAttackHeading = request.previousAttackHeading;
    query.preferredPopulationId = this.preferredPopulationId;
    query.preferredEntityId = this.preferredEntityId;
    query.maximumTurnRadians = maximumTurnRadians;
  }

  private resolveTurnLimit(result: Readonly<MutableBattlefieldMeleeAttackDirection>): number {
    if (result.targetSwitchReason === MeleeTargetSwitchReason.PreferredInvalid
      || result.targetSwitchReason === MeleeTargetSwitchReason.PreferredOutOfRange) {
      return INVALID_TARGET_TURN_RADIANS;
    }
    if (result.preferredExpectedHitCount <= 0) {
      return Math.PI;
    }
    return NORMAL_CHAIN_TURN_RADIANS;
  }

  private writeFallbackDirection(
    request: Readonly<BattlefieldMeleeAttackDirectionRequest>,
    result: MutableBattlefieldMeleeAttackDirection,
  ): void {
    if (this.hasCombatDirection) {
      result.directionX = this.lastCombatDirectionX;
      result.directionZ = this.lastCombatDirectionZ;
    } else if (Number.isFinite(request.currentHeading)) {
      result.directionX = Math.sin(request.currentHeading);
      result.directionZ = Math.cos(request.currentHeading);
    } else if (this.hasMovementHistory) {
      result.directionX = this.lastMovementX;
      result.directionZ = this.lastMovementZ;
    } else {
      result.directionX = 0;
      result.directionZ = 1;
    }
    result.heading = Math.atan2(result.directionX, result.directionZ);
    result.expectedHitCount = 0;
    result.closeThreatCount = 0;
    result.eliteTargetCount = 0;
    result.score = 0;
    result.anchorPopulationId = -1;
    result.anchorEntityId = -1;
    result.targeted = false;
    result.preferredTargetValid = false;
    result.preferredExpectedHitCount = 0;
    result.preferredScore = 0;
    result.targetRetained = false;
    result.targetSwitchReason = MeleeTargetSwitchReason.NoTargetFallback;
    this.rememberCombatDirection(result.directionX, result.directionZ);
    this.writeDebugState(request, result);
  }

  private rememberCombatDirection(directionX: number, directionZ: number): void {
    const lengthSquared = directionX * directionX + directionZ * directionZ;
    if (lengthSquared <= DIRECTION_EPSILON_SQUARED) {
      return;
    }
    const inverseLength = 1 / Math.sqrt(lengthSquared);
    this.lastCombatDirectionX = directionX * inverseLength;
    this.lastCombatDirectionZ = directionZ * inverseLength;
    this.hasCombatDirection = true;
  }

  private writeDebugState(
    request: Readonly<BattlefieldMeleeAttackDirectionRequest>,
    result: Readonly<MutableBattlefieldMeleeAttackDirection>,
  ): void {
    this.debug.selectedHeading = result.heading;
    this.debug.expectedHitCount = result.expectedHitCount;
    this.debug.selectedScore = result.score;
    this.debug.anchorPopulationId = result.anchorPopulationId;
    this.debug.anchorEntityId = result.anchorEntityId;
    this.debug.targetRetained = result.targetRetained;
    this.debug.targetSwitchReason = result.targetSwitchReason;
    this.debug.previousAttackHeading = request.previousAttackHeading;
    this.debug.targetReleaseRadius = request.acquireRadius * TARGET_RELEASE_RADIUS_SCALE;
  }
}

/** 创建供输入系统和测试长期复用的方向结果。 */
export function createMutableMeleeAttackDirection(): MutableBattlefieldMeleeAttackDirection {
  return {
    directionX: 0,
    directionZ: 1,
    heading: 0,
    expectedHitCount: 0,
    closeThreatCount: 0,
    eliteTargetCount: 0,
    score: 0,
    anchorPopulationId: -1,
    anchorEntityId: -1,
    targeted: false,
    preferredTargetValid: false,
    preferredExpectedHitCount: 0,
    preferredScore: 0,
    targetRetained: false,
    targetSwitchReason: MeleeTargetSwitchReason.None,
  };
}

function validateRequest(request: Readonly<BattlefieldMeleeAttackDirectionRequest>): void {
  const previousHeadingValid = request.previousAttackHeading === null
    || Number.isFinite(request.previousAttackHeading);
  if (!Number.isFinite(request.originX)
    || !Number.isFinite(request.originZ)
    || !Number.isFinite(request.acquireRadius)
    || !Number.isFinite(request.attackReach)
    || !Number.isFinite(request.attackArcRadians)
    || !Number.isFinite(request.currentHeading)
    || !previousHeadingValid
    || request.acquireRadius <= 0
    || request.attackReach <= 0
    || request.attackArcRadians <= 0
    || request.attackArcRadians > Math.PI * 2) {
    throw new Error('近战自动瞄准必须使用有限坐标、合法弧度和正半径。');
  }
}

function absoluteAngleDifference(first: number, second: number): number {
  return Math.abs(Math.atan2(Math.sin(second - first), Math.cos(second - first)));
}

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
