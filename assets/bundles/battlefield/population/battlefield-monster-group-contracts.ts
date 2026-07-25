import {
  type MonsterCombatPopulation,
  type PlanarMonsterCombatTarget,
} from '../../../core/contracts/monster-combat';
import {
  type MutablePlanarMonsterHitResult,
  type PlanarMonsterHitPopulation,
  type PlanarMonsterHitQuery,
} from '../../../core/contracts/monster-hit';
import { type PlanarMonsterManipulationPopulation } from '../../../core/contracts/monster-manipulation';
import {
  type MutablePlanarTargetResult,
  type PlanarTargetPopulation,
  type PlanarTargetQuery,
} from '../../../core/contracts/planar-target';
import { type PlanarCrowdPopulation } from '../../../core/monsters/crowd/planar-crowd-population';

/** 战场怪物组装器向群体门面提供的完整运行时能力。 */
export interface BattlefieldMonsterRuntime extends PlanarTargetPopulation,
MonsterCombatPopulation, PlanarMonsterHitPopulation, PlanarMonsterManipulationPopulation {
  readonly count: number;
  readonly aliveCount: number;
  maintainAround(options: Readonly<BattlefieldMonsterRepopulationOptions>): void;
  update(deltaTime: number): void;
  simulate(deltaTime: number): void;
  synchronizeRendering(): void;
  createCrowdPopulation(populationId: number): PlanarCrowdPopulation;
  findPlanarTarget(
    entityIndex: number,
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean;
  findPlanarHit(
    entityIndex: number,
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean;
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

/** 战场怪物组复用的局部平面目标查询。 */
export interface MutablePlanarTargetQuery extends PlanarTargetQuery {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/** 战场怪物组复用的局部平面战斗目标。 */
export interface MutablePlanarMonsterCombatTarget extends PlanarMonsterCombatTarget {
  x: number;
  y: number;
  collisionRadius: number;
}

/** 战场怪物组复用的局部三维扫掠查询。 */
export interface MutablePlanarMonsterHitQuery extends PlanarMonsterHitQuery {
  startX: number;
  startY: number;
  startElevation: number;
  endX: number;
  endY: number;
  endElevation: number;
  impactRadius: number;
}
