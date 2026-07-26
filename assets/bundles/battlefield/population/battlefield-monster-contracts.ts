/** 战场世界 XZ 平面中可被怪物感知和攻击的目标。 */
export interface BattlefieldMonsterCombatTarget {
  readonly x: number;
  readonly z: number;
  readonly collisionRadius: number;
}
