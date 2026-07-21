import {
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';

/** 战场聚合瞄准与子弹系统依赖的怪物群最小门面。 */
export interface BattlefieldMonsterTargetGroup {
  writeAimTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean;
  writeAutoTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean;
  writeProjectileHit(
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    impactRadius: number,
    result: MutableBattlefieldProjectileHit,
  ): boolean;
  damageMonster(entityId: number, amount: number): void;
}
