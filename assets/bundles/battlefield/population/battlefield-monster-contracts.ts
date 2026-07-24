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

/** 怪物平面轮廓与瞄准线段的首次接触结果。 */
export interface MutableBattlefieldAimRayContact extends MutableBattlefieldAimTarget {
  segmentProgress: number;
}

/** 战场世界空间中复用的首个子弹命中结果。 */
export interface MutableBattlefieldProjectileHit {
  populationId: number;
  entityId: number;
  x: number;
  y: number;
  z: number;
  segmentProgress: number;
}

/** 一颗实体弹丸在单帧内实际扫掠的世界空间线段。 */
export interface BattlefieldProjectileSweepQuery {
  readonly startX: number;
  readonly startY: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endY: number;
  readonly endZ: number;
  readonly impactRadius: number;
}
