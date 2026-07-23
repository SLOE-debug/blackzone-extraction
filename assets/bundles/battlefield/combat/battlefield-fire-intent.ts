/** 玩家一次射击请求中保持不变的水平输入与可选纵向修正。 */
export interface BattlefieldFireIntent {
  readonly directionX: number;
  readonly directionZ: number;
  readonly targetElevation: number | null;
  /** 候选怪物在手动方向上的投影距离；自由射击时由武器射程决定。 */
  readonly targetDistance: number | null;
}

/** World 原地复用的可写射击意图。 */
export interface MutableBattlefieldFireIntent extends BattlefieldFireIntent {
  directionX: number;
  directionZ: number;
  targetElevation: number | null;
  targetDistance: number | null;
}
