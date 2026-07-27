import {
  BattlefieldMeleeHitBuffer,
  type BattlefieldMeleeQuery,
  type BattlefieldMeleeSweepQuery,
} from '../../combat/melee/battlefield-melee-query';
import {
  type DirectionalLaunchEffect,
  type PlanarKnockbackEffect,
  type VerticalLaunchEffect,
} from '../../../../core/contracts/monster-effects';

/** 大锤运行时依赖的异构怪物战斗门面。 */
export interface BattlefieldHammerCombatTarget {
  collectMeleeHits(query: Readonly<BattlefieldMeleeQuery>, result: BattlefieldMeleeHitBuffer): number;
  collectMeleeSweepHits(
    query: Readonly<BattlefieldMeleeSweepQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number;
  acceptHitSequence(populationId: number, entityId: number, attackSequenceId: number): boolean;
  damageMonster(populationId: number, entityId: number, amount: number): boolean;
  applyKnockback(
    populationId: number,
    entityId: number,
    effect: Readonly<PlanarKnockbackEffect>,
  ): boolean;
  applyVerticalLaunch(
    populationId: number,
    entityId: number,
    effect: Readonly<VerticalLaunchEffect>,
  ): boolean;
  applyDirectionalLaunch(
    populationId: number,
    entityId: number,
    effect: Readonly<DirectionalLaunchEffect>,
  ): boolean;
  applyMagnetized(
    populationId: number,
    entityId: number,
    skillSequenceId: number,
    durationSeconds: number,
  ): boolean;
  getKnockbackResistance(populationId: number): number;
  getAirborneResistance(populationId: number): number;
}
