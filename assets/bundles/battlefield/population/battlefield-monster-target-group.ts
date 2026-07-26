import { type PlanarCrowdPopulation } from '../../../core/monsters/crowd/planar-crowd-population';

/** 战场近战、通用 Effect 与伤害路由依赖的怪物群最小门面。 */
export interface BattlefieldMonsterTargetGroup {
  readonly populationId: number;
  readonly crowdPopulation: PlanarCrowdPopulation;
  /** 一表示完整承受，零表示免疫平面击退。 */
  readonly knockbackResistanceScale: number;
  /** 一表示完整承受，零表示免疫垂直腾空。 */
  readonly airborneResistanceScale: number;
  damageMonster(entityId: number, amount: number): void;
  setEffectElevation(entityId: number, elevation: number): boolean;
}
