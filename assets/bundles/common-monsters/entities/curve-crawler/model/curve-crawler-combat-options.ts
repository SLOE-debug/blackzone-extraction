/** Curve Crawler 一次啃咬的类型化时间轴。 */
export interface CurveCrawlerBiteTiming {
  readonly windupSeconds: number;
  readonly strikeSeconds: number;
  readonly recoverySeconds: number;
  readonly cooldownSeconds: number;
}

/** Curve Crawler 自主战斗使用的感知、追击和攻击参数。 */
export interface CurveCrawlerCombatOptions {
  readonly detectionRadius: number;
  readonly disengageRadius: number;
  readonly attackReach: number;
  readonly impactTolerance: number;
  readonly pursuitSpeedMultiplier: number;
  readonly damage: number;
  readonly biteTiming: Readonly<CurveCrawlerBiteTiming>;
}

/** 校验并冻结战斗参数，确保高频系统无需重复处理输入边界。 */
export function normalizeCurveCrawlerCombatOptions(
  options: Readonly<CurveCrawlerCombatOptions>,
): Readonly<CurveCrawlerCombatOptions> {
  const positiveValues = [
    options.detectionRadius,
    options.disengageRadius,
    options.attackReach,
    options.impactTolerance,
    options.pursuitSpeedMultiplier,
    options.damage,
    options.biteTiming.windupSeconds,
    options.biteTiming.strikeSeconds,
    options.biteTiming.recoverySeconds,
    options.biteTiming.cooldownSeconds,
  ];
  if (!positiveValues.every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Curve Crawler 战斗距离、速度、伤害和时间参数必须是有限正数。');
  }
  if (options.disengageRadius <= options.detectionRadius) {
    throw new Error('Curve Crawler 脱战半径必须大于感知半径。');
  }
  return Object.freeze({
    detectionRadius: options.detectionRadius,
    disengageRadius: options.disengageRadius,
    attackReach: options.attackReach,
    impactTolerance: options.impactTolerance,
    pursuitSpeedMultiplier: options.pursuitSpeedMultiplier,
    damage: options.damage,
    biteTiming: Object.freeze({
      windupSeconds: options.biteTiming.windupSeconds,
      strikeSeconds: options.biteTiming.strikeSeconds,
      recoverySeconds: options.biteTiming.recoverySeconds,
      cooldownSeconds: options.biteTiming.cooldownSeconds,
    }),
  });
}
