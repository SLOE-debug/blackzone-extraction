/** Venom Lobber 抛射物、酸池和连锁催化使用的完整参数。 */
export interface VenomLobberCombatOptions {
  readonly detectionRadius: number;
  readonly disengageRadius: number;
  readonly preferredMinimumRange: number;
  readonly preferredMaximumRange: number;
  readonly pursuitSpeedMultiplier: number;
  readonly retreatSpeedMultiplier: number;
  readonly castWindupSeconds: number;
  readonly castRecoverySeconds: number;
  readonly minimumCooldownSeconds: number;
  readonly maximumCooldownSeconds: number;
  readonly meleeRange: number;
  readonly meleeDamage: number;
  readonly meleeWindupSeconds: number;
  readonly meleeRecoverySeconds: number;
  readonly meleeCooldownSeconds: number;
  readonly meleeLungeSpeedMultiplier: number;
  readonly projectileFlightSeconds: number;
  readonly projectileStartElevation: number;
  readonly blastRadius: number;
  readonly blastDamage: number;
  readonly poolRadius: number;
  readonly poolDurationSeconds: number;
  readonly poolDamagePerSecond: number;
  readonly poolMovementMultiplier: number;
  readonly catalystRadiusMultiplier: number;
  readonly catalystDamageMultiplier: number;
  readonly catalystDurationMultiplier: number;
}

/** 校验并冻结技能参数，保证高频战斗与弹道系统只处理已归一化输入。 */
export function normalizeVenomLobberCombatOptions(
  options: Readonly<VenomLobberCombatOptions>,
): Readonly<VenomLobberCombatOptions> {
  const values = Object.values(options);
  if (!values.every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Venom Lobber 技能距离、伤害、时长和倍率必须是有限正数。');
  }
  if (options.disengageRadius <= options.detectionRadius
    || options.preferredMaximumRange <= options.preferredMinimumRange
    || options.preferredMaximumRange > options.detectionRadius
    || options.meleeRange >= options.preferredMinimumRange
    || options.maximumCooldownSeconds < options.minimumCooldownSeconds
    || options.poolMovementMultiplier > 1
    || options.catalystRadiusMultiplier <= 1
    || options.catalystDamageMultiplier <= 1
    || options.catalystDurationMultiplier <= 1) {
    throw new Error('Venom Lobber 技能范围、冷却或催化倍率关系无效。');
  }
  return Object.freeze({ ...options });
}
