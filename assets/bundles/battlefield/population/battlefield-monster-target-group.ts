import {
  type MutableBattlefieldAimRayContact,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';
import { type PlanarCrowdPopulation } from '../../../core/monsters/crowd/planar-crowd-population';

/** 战场聚合瞄准与子弹系统依赖的怪物群最小门面。 */
export interface BattlefieldMonsterTargetGroup {
  readonly populationId: number;
  readonly crowdPopulation: PlanarCrowdPopulation;
  writeAimRayContactForEntity(
    entityIndex: number,
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    result: MutableBattlefieldAimRayContact,
  ): boolean;
  writeProjectileHitForEntity(
    entityIndex: number,
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
