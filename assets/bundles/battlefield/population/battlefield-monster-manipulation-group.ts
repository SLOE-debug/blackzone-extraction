import { type PlanarCrowdPopulation } from '../../../core/monsters/crowd/planar-crowd-population';
import { type MutableBattlefieldManipulationCandidate } from './battlefield-monster-contracts';

/** 战场行为模块操作异构怪物时依赖的最小群体门面。 */
export interface BattlefieldMonsterManipulationGroup {
  readonly populationId: number;
  readonly crowdPopulation: PlanarCrowdPopulation;

  /** 把指定活动槽位的能力与世界姿态写入复用结果。 */
  writeManipulationCandidateForEntity(
    entityIndex: number,
    result: MutableBattlefieldManipulationCandidate,
  ): boolean;

  beginCarry(entityId: number): boolean;
  beginThrow(entityId: number): boolean;
  synchronizeManipulatedPose(
    entityId: number,
    x: number,
    y: number,
    z: number,
    heading: number,
  ): boolean;
  releaseManipulation(entityId: number): boolean;
  killManipulated(entityId: number): boolean;
}
