/** 战场世界 XZ 平面中可被怪物感知和攻击的目标。 */
export interface BattlefieldMonsterCombatTarget {
  readonly x: number;
  readonly z: number;
  readonly collisionRadius: number;
}

/** 战场世界 XZ 平面中复用的瞄准吸附结果。 */
export interface MutableBattlefieldAimTarget {
  x: number;
  z: number;
}
