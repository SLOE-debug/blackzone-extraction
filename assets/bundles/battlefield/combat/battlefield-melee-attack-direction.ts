/** 近战自动瞄准改变稳定目标的原因。 */
export enum MeleeTargetSwitchReason {
  None = 'none',
  InitialAcquire = 'initial-acquire',
  PreferredInvalid = 'preferred-invalid',
  PreferredOutOfRange = 'preferred-out-of-range',
  BetterCluster = 'better-cluster',
  NoTargetFallback = 'no-target-fallback',
  AttackReleased = 'attack-released',
}

/** 大锤挥击方向规划使用的世界空间参数。 */
export interface BattlefieldMeleeAttackDirectionQuery {
  readonly originX: number;
  readonly originZ: number;
  /** 新目标允许进入稳定锁定的搜索半径。 */
  readonly acquireRadius: number;
  /** 已有稳定目标允许继续保留的释放半径。 */
  readonly releaseRadius: number;
  /** 当前武器定义中的真实近战攻击距离。 */
  readonly attackReach: number;
  /** 当前武器定义中的真实横扫攻击弧度。 */
  readonly attackArcRadians: number;
  /** 计入近身威胁加分的距离。 */
  readonly closeThreatRadius: number;
  /** 人物当前身体朝向。 */
  readonly currentHeading: number;
  /** 上一次攻击方向；首次攻击为 null。 */
  readonly previousAttackHeading: number | null;
  /** 当前稳定目标。 */
  readonly preferredPopulationId: number;
  readonly preferredEntityId: number;
  /** 连段相对上一击允许规划的最大转角。 */
  readonly maximumTurnRadians: number;
}

/** 调用方长期复用的挥击方向规划结果。 */
export interface MutableBattlefieldMeleeAttackDirection {
  directionX: number;
  directionZ: number;
  heading: number;
  /** 该方向按真实攻击范围预计覆盖的怪物数量。 */
  expectedHitCount: number;
  closeThreatCount: number;
  /** 当前没有类型化威胁等级来源，暂时固定为零。 */
  eliteTargetCount: number;
  score: number;
  anchorPopulationId: number;
  anchorEntityId: number;
  targeted: boolean;
  /** 当前稳定目标是否仍存活且可攻击。 */
  preferredTargetValid: boolean;
  /** 当前稳定目标方案的预计命中数，供连段转向规则判断。 */
  preferredExpectedHitCount: number;
  preferredScore: number;
  targetRetained: boolean;
  targetSwitchReason: MeleeTargetSwitchReason;
}

/** 输入层依赖的近战挥击方向查询门面。 */
export interface BattlefieldMeleeAttackDirectionSource {
  writeBestMeleeAttackDirection(
    query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
    result: MutableBattlefieldMeleeAttackDirection,
  ): boolean;
}

/** 仅调试读取的近战自动瞄准快照。 */
export interface BattlefieldMeleeAimDebugState {
  readonly selectedHeading: number;
  readonly expectedHitCount: number;
  readonly selectedScore: number;
  readonly anchorPopulationId: number;
  readonly anchorEntityId: number;
  readonly targetRetained: boolean;
  readonly targetSwitchReason: MeleeTargetSwitchReason;
  readonly previousAttackHeading: number | null;
  readonly targetReleaseRadius: number;
}
