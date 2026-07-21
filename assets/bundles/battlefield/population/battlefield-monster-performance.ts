/** 怪物总阶段内部需要单独观察的性能子阶段。 */
export enum BattlefieldMonsterPerformanceStage {
  PopulationMaintenance,
  Simulation,
  Visibility,
  RenderingSynchronization,
  Count,
}

/** 怪物模块只依赖的窄性能记录契约，不直接感知控制台输出实现。 */
export interface BattlefieldMonsterPerformanceRecorder {
  beginMonsterStage(): number;
  endMonsterStage(stage: BattlefieldMonsterPerformanceStage, startedAt: number): void;
  recordMonsterBatchGrowth(previousCapacity: number, nextCapacity: number): void;
}
