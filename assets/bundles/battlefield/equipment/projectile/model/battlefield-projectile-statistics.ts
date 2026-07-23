/** 单帧实体弹丸从生成到伤害结算的只读观测数据。 */
export interface BattlefieldProjectileStatistics {
  readonly projectilesSpawned: number;
  readonly projectilesIntegrated: number;
  readonly broadPhaseCandidates: number;
  readonly narrowPhaseHits: number;
  readonly impactsQueued: number;
  readonly damageEventsApplied: number;
}

/** 高频弹丸链路原地累计的单帧统计器。 */
export class MutableBattlefieldProjectileStatistics implements BattlefieldProjectileStatistics {
  public projectilesSpawned = 0;
  public projectilesIntegrated = 0;
  public broadPhaseCandidates = 0;
  public narrowPhaseHits = 0;
  public impactsQueued = 0;
  public damageEventsApplied = 0;

  /** 在武器生成阶段开始前清空上一帧数据。 */
  public reset(): void {
    this.projectilesSpawned = 0;
    this.projectilesIntegrated = 0;
    this.broadPhaseCandidates = 0;
    this.narrowPhaseHits = 0;
    this.impactsQueued = 0;
    this.damageEventsApplied = 0;
  }
}
