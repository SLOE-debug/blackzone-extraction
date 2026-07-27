import {
  type DirectionalLaunchEffect,
  type PlanarKnockbackEffect,
  type VerticalLaunchEffect,
} from '../../../core/contracts/monster-effects';
import {
  BattlefieldMeleeHitBuffer,
  type BattlefieldMeleeQuery,
  type BattlefieldMeleeSweepQuery,
} from '../combat/melee/battlefield-melee-query';
import { type BattlefieldMonsterEffectRuntime } from '../combat/effects/battlefield-monster-effect-runtime';
import { type BattlefieldHammerCombatTarget } from '../equipment/combat/battlefield-hammer-combat-target';
import { type BattlefieldMonsterTargetRegistry } from './battlefield-monster-target-registry';

/** 聚合怪物目标查询、伤害与通用受力效果的稳定战斗门面。 */
export class BattlefieldMonsterCombatFacade implements BattlefieldHammerCombatTarget {
  constructor(
    private readonly targets: BattlefieldMonsterTargetRegistry,
    private readonly effects: BattlefieldMonsterEffectRuntime,
    private readonly isActive: () => boolean,
  ) {}

  public collectMeleeHits(
    query: Readonly<BattlefieldMeleeQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number {
    return this.isActive() ? this.targets.collectMeleeHits(query, result) : 0;
  }

  public collectMeleeSweepHits(
    query: Readonly<BattlefieldMeleeSweepQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number {
    return this.isActive() ? this.targets.collectMeleeSweepHits(query, result) : 0;
  }

  public damageMonster(populationId: number, entityId: number, amount: number): boolean {
    return this.isActive() && this.targets.damageMonster(populationId, entityId, amount);
  }

  public acceptHitSequence(
    populationId: number,
    entityId: number,
    attackSequenceId: number,
  ): boolean {
    return this.isActive() && this.effects.acceptHitSequence(
      populationId,
      entityId,
      attackSequenceId,
    );
  }

  public applyKnockback(
    populationId: number,
    entityId: number,
    effect: Readonly<PlanarKnockbackEffect>,
  ): boolean {
    return this.isActive() && this.effects.applyKnockback(populationId, entityId, effect);
  }

  public applyVerticalLaunch(
    populationId: number,
    entityId: number,
    effect: Readonly<VerticalLaunchEffect>,
  ): boolean {
    return this.isActive() && this.effects.applyVerticalLaunch(populationId, entityId, effect);
  }

  public applyDirectionalLaunch(
    populationId: number,
    entityId: number,
    effect: Readonly<DirectionalLaunchEffect>,
  ): boolean {
    return this.isActive() && this.effects.applyDirectionalLaunch(populationId, entityId, effect);
  }

  public applyMagnetized(
    populationId: number,
    entityId: number,
    skillSequenceId: number,
    durationSeconds: number,
  ): boolean {
    return this.isActive() && this.effects.applyMagnetized(
      populationId,
      entityId,
      skillSequenceId,
      durationSeconds,
    );
  }

  public getKnockbackResistance(populationId: number): number {
    return this.targets.getKnockbackResistance(populationId);
  }

  public getAirborneResistance(populationId: number): number {
    return this.targets.getAirborneResistance(populationId);
  }
}
