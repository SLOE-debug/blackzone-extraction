import {
  type MonsterCombatPopulation,
  type PlanarMonsterCombatTarget,
} from '../../../core/contracts/monster-combat';
import { type PlanarMonsterEffectPopulation } from '../../../core/contracts/monster-effects';
import { type PlanarCrowdPopulation } from '../../../core/monsters/crowd/planar-crowd-population';

/** 战场怪物组装器向群体门面提供的完整运行时能力。 */
export interface BattlefieldMonsterRuntime extends MonsterCombatPopulation,
PlanarMonsterEffectPopulation {
  readonly count: number;
  readonly aliveCount: number;
  maintainAround(options: Readonly<BattlefieldMonsterRepopulationOptions>): void;
  update(deltaTime: number): void;
  simulate(deltaTime: number): void;
  synchronizeRendering(): void;
  createCrowdPopulation(populationId: number): PlanarCrowdPopulation;
  dispose(): void;
}

/** 一个怪物群围绕玩家维护活动槽位时复用的世界配置。 */
export interface BattlefieldMonsterRepopulationOptions {
  centerX: number;
  centerY: number;
  spawnInnerRadius: number;
  spawnOuterRadius: number;
  recycleRadius: number;
  hardRecycleRadius: number;
  desiredPopulationCount: number;
}

/** 战场怪物组复用的局部平面战斗目标。 */
export interface MutablePlanarMonsterCombatTarget extends PlanarMonsterCombatTarget {
  x: number;
  y: number;
  collisionRadius: number;
}
