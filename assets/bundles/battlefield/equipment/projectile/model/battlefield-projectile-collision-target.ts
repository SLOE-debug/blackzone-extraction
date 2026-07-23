import {
  type BattlefieldProjectileSweepQuery,
  type MutableBattlefieldProjectileHit,
} from '../../../population/battlefield-monster-contracts';
import {
  type MutableBattlefieldProjectileStatistics,
} from './battlefield-projectile-statistics';

/** 实体弹丸碰撞与伤害阶段依赖的怪物聚合最小门面。 */
export interface BattlefieldProjectileCollisionTarget {
  findFirstProjectileHit(
    query: Readonly<BattlefieldProjectileSweepQuery>,
    ignoredPopulationIds: Uint32Array,
    ignoredEntityIds: Uint32Array,
    ignoredOffset: number,
    ignoredCount: number,
    result: MutableBattlefieldProjectileHit,
    statistics: MutableBattlefieldProjectileStatistics,
  ): boolean;
  damageMonster(populationId: number, entityId: number, amount: number): boolean;
}
