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
import {
  type BattlefieldArrowAimQuery,
  type BattlefieldArrowCombatTarget,
  type BattlefieldArrowHitBuffer,
  type BattlefieldArrowSweepQuery,
  type MutableBattlefieldArrowAimTarget,
  type MutableBattlefieldArrowTargetPose,
} from '../equipment/projectile/model/battlefield-arrow-query';
import { PlanarKnockbackCombineMode } from '../../../core/contracts/monster-effects';

/** 聚合怪物目标查询、伤害与通用受力效果的稳定战斗门面。 */
export class BattlefieldMonsterCombatFacade
implements BattlefieldHammerCombatTarget, BattlefieldArrowCombatTarget {
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

  public recordSpinHit(
    populationId: number,
    entityId: number,
    skillSequenceId: number,
  ): number {
    return this.isActive()
      ? this.effects.recordSpinHit(populationId, entityId, skillSequenceId)
      : 0;
  }

  public applyKineticCarrier(
    populationId: number,
    entityId: number,
    skillSequenceId: number,
    baseDamage: number,
    damageBudget: number,
  ): boolean {
    return this.isActive() && this.effects.applyKineticCarrier(
      populationId,
      entityId,
      skillSequenceId,
      baseDamage,
      damageBudget,
    );
  }

  public getKnockbackResistance(populationId: number): number {
    return this.targets.getKnockbackResistance(populationId);
  }

  public collectArrowSweepHits(
    query: Readonly<BattlefieldArrowSweepQuery>,
    result: BattlefieldArrowHitBuffer,
  ): number {
    return this.isActive() ? this.targets.collectArrowSweepHits(query, result) : 0;
  }

  public writeBestArrowAimTarget(
    query: Readonly<BattlefieldArrowAimQuery>,
    result: MutableBattlefieldArrowAimTarget,
  ): boolean {
    return this.isActive() && this.targets.writeBestArrowAimTarget(query, result);
  }

  public writeArrowTargetPose(
    populationId: number,
    entityId: number,
    result: MutableBattlefieldArrowTargetPose,
  ): boolean {
    return this.isActive()
      && this.targets.writeArrowTargetPose(populationId, entityId, result);
  }

  /** 通过怪物公共 Effect SoA 叠加弦网移动减速。 */
  public applyArrowSlow(
    populationId: number,
    entityId: number,
    scale: number,
    durationSeconds: number,
  ): boolean {
    return this.isActive()
      && this.effects.applyMovementSlow(populationId, entityId, scale, durationSeconds);
  }

  /** 猎钩通过现有可累积平面受力契约施加朝玩家方向的轻拖拽。 */
  public applyArrowPull(
    populationId: number,
    entityId: number,
    directionX: number,
    directionZ: number,
    strength: number,
  ): boolean {
    return this.applyKnockback(populationId, entityId, {
      directionX,
      directionZ,
      initialSpeed: strength,
      remainingSeconds: 0.18,
      resistanceScale: this.getKnockbackResistance(populationId),
      combineMode: PlanarKnockbackCombineMode.Accumulate,
      maximumSpeed: strength * 1.5,
    });
  }
}
