/** 怪物总阶段内部需要单独观察的性能子阶段。 */
export enum BattlefieldMonsterPerformanceStage {
  PopulationMaintenance,
  Simulation,
  RenderingSynchronization,
  Count,
}

/** 怪物模块只依赖的窄性能记录契约，不直接感知控制台输出实现。 */
export interface BattlefieldMonsterPerformanceRecorder {
  beginMonsterStage(): number;
  endMonsterStage(stage: BattlefieldMonsterPerformanceStage, startedAt: number): void;
  recordMonsterBatchGrowth(previousCapacity: number, nextCapacity: number): void;
  recordMonsterRenderingWork(
    poseUploadBytes: number,
    poseUploadCalls: number,
  ): void;
}

/** 战场诊断层读取的共享怪物姿态版本链。 */
export interface BattlefieldMonsterPoseSynchronization {
  readonly simulationPoseRevision: number;
  readonly packedPoseRevision: number;
  readonly gpuPoseUploadRevision: number;
  readonly forcedResynchronizationCount: number;
  readonly desynchronized: boolean;
}
