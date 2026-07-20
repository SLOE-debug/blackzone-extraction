/** 计算尸潮目标数量所需的稳定波次配置。 */
export interface BattlefieldMonsterWaveSchedule {
  readonly populationCapacity: number;
  readonly openingGraceSeconds: number;
  readonly firstWaveCount: number;
  readonly reinforcementCount: number;
  readonly reinforcementIntervalSeconds: number;
}

/**
 * 根据战场有效运行时间计算当前应该加入模拟的正式怪物数量。
 *
 * 开局保护期内返回零；保护期结束时加入首批怪物，随后按固定间隔增加援军，
 * 最终不超过总容量。
 */
export function calculateBattlefieldMonsterTargetCount(
  schedule: Readonly<BattlefieldMonsterWaveSchedule>,
  elapsedSeconds: number,
): number {
  validateSchedule(schedule);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error('尸潮波次计时必须是有限非负数。');
  }
  if (elapsedSeconds < schedule.openingGraceSeconds) {
    return 0;
  }
  const reinforcementWaves = Math.floor(
    (elapsedSeconds - schedule.openingGraceSeconds)
      / schedule.reinforcementIntervalSeconds,
  );
  return Math.min(
    schedule.populationCapacity,
    schedule.firstWaveCount + reinforcementWaves * schedule.reinforcementCount,
  );
}

/** 校验静态尸潮配置，避免运行时进入无法推进或超过容量的波次。 */
function validateSchedule(schedule: Readonly<BattlefieldMonsterWaveSchedule>): void {
  if (!Number.isInteger(schedule.populationCapacity)
    || !Number.isInteger(schedule.firstWaveCount)
    || !Number.isInteger(schedule.reinforcementCount)
    || schedule.populationCapacity <= 0
    || schedule.firstWaveCount <= 0
    || schedule.firstWaveCount > schedule.populationCapacity
    || schedule.reinforcementCount <= 0
    || !Number.isFinite(schedule.openingGraceSeconds)
    || schedule.openingGraceSeconds < 0
    || !Number.isFinite(schedule.reinforcementIntervalSeconds)
    || schedule.reinforcementIntervalSeconds <= 0) {
    throw new Error('尸潮波次容量、首批数量、援军数量或时间参数无效。');
  }
}
