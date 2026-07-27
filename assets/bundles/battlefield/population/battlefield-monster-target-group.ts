import { type PlanarCrowdPopulation } from '../../../core/monsters/crowd/planar-crowd-population';
import { type MonsterLaunchResponse } from '../../../core/contracts/monster-effects';

/** 战场近战、通用 Effect 与伤害路由依赖的怪物群最小门面。 */
export interface BattlefieldMonsterTargetGroup {
  readonly populationId: number;
  readonly crowdPopulation: PlanarCrowdPopulation;
  readonly launchResponse: Readonly<MonsterLaunchResponse>;
  damageMonster(entityId: number, amount: number): void;
  setAirborneEffect(entityId: number, active: boolean, elevation: number): boolean;
}
