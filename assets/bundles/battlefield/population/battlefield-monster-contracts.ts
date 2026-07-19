/** 战场世界 XZ 平面中可被怪物感知和攻击的目标。 */
export interface BattlefieldMonsterCombatTarget {
  readonly x: number;
  readonly z: number;
  readonly collisionRadius: number;
}

/** 战场世界空间中的只读瞄准吸附结果。 */
export interface BattlefieldAimTarget {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 调用方复用的可写世界空间瞄准吸附结果。 */
export interface MutableBattlefieldAimTarget extends BattlefieldAimTarget {
  x: number;
  y: number;
  z: number;
}

/** 战场世界空间中复用的首个子弹命中结果。 */
export interface MutableBattlefieldProjectileHit {
  entityId: number;
  x: number;
  y: number;
  z: number;
  segmentProgress: number;
}
