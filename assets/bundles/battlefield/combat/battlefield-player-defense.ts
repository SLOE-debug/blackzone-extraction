/**
 * 把怪物聚合伤害按当前动作防御配置缩放，环境伤害不经过该函数。
 *
 * @param incomingDamage 怪物本帧产生的原始聚合伤害。
 * @param damageTakenScale 当前武器动作声明的承伤比例。
 * @returns 应实际写入玩家生命值的伤害。
 */
export function calculateBattlefieldMonsterDamage(
  incomingDamage: number,
  damageTakenScale: number,
): number {
  if (!Number.isFinite(incomingDamage)
    || incomingDamage < 0
    || !Number.isFinite(damageTakenScale)
    || damageTakenScale <= 0
    || damageTakenScale > 1) {
    throw new Error('怪物伤害与动作承伤比例必须位于合法有限范围。');
  }
  return incomingDamage * damageTakenScale;
}
