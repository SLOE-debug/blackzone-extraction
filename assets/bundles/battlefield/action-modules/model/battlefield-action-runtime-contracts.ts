import { type PlanarMovementConstraint } from '../../../../core/contracts/planar-movement-constraint';
import { type MutableBattlefieldProjectileStatistics } from '../../equipment/projectile/model/battlefield-projectile-statistics';
import {
  type BattlefieldGrabTargetQuery,
  type BattlefieldProjectileSweepQuery,
  type MutableBattlefieldManipulationCandidate,
  type MutableBattlefieldProjectileHit,
} from '../../population/battlefield-monster-contracts';

/** 行为模块运行时依赖的异构怪物聚合门面。 */
export interface BattlefieldActionMonsterGateway {
  findGrabbable(
    query: Readonly<BattlefieldGrabTargetQuery>,
    result: MutableBattlefieldManipulationCandidate,
  ): boolean;
  beginCarry(populationId: number, entityId: number): boolean;
  beginThrow(populationId: number, entityId: number): boolean;
  synchronizeManipulatedPose(
    populationId: number,
    entityId: number,
    x: number,
    y: number,
    z: number,
    heading: number,
  ): boolean;
  releaseManipulation(populationId: number, entityId: number): boolean;
  killManipulated(populationId: number, entityId: number): boolean;
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
  knockbackMonster(
    populationId: number,
    entityId: number,
    offsetX: number,
    offsetZ: number,
  ): boolean;
}

/** 投掷预览只依赖的地图平面约束。 */
export type BattlefieldThrowMovementConstraint = PlanarMovementConstraint;
