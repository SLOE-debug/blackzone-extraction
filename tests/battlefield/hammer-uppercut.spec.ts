import { describe, expect, it } from 'vitest';
import { WeaponAction } from '../../assets/core/equipment/equipment';
import { type DirectionalLaunchEffect } from '../../assets/core/contracts/monster-effects';
import {
  BattlefieldMeleeHitBuffer,
  type BattlefieldMeleeQuery,
  type BattlefieldMeleeSweepQuery,
} from '../../assets/bundles/battlefield/combat/melee/battlefield-melee-query';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { BattlefieldHammerActionState } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-state';
import { type MutableHammerActionEvents } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-events';
import { type BattlefieldHammerCombatTarget } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-combat-target';
import { BattlefieldHammerCombatRuntime } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-combat-runtime';
import { SLEDGEHAMMER_PROGRESSION } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-progression';
import { SledgehammerSpinKnockbackTuning } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-spin-knockback-tuning';

const DEFINITION = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.Sledgehammer);
const EVENTS: MutableHammerActionEvents = {
  uppercutImpact: false,
  groundSlamImpact: false,
  spinPulse: false,
  spinFinal: false,
};

describe('大锤自动群体上挑', () => {
  it('使用玩家前方扇区命中整组怪物并按各自径向形成斜向飞散', () => {
    const target = new UppercutTarget();
    const runtime = new BattlefieldHammerCombatRuntime(
      target,
      new SledgehammerSpinKnockbackTuning(),
    );
    const state = createAutomaticUppercutState();
    runtime.beginFrame();
    state.update(0.21, DEFINITION, EVENTS);
    expect(EVENTS.uppercutImpact).toBe(true);
    runtime.collectHits({
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      heading: 0,
      alive: true,
    }, state, EVENTS, DEFINITION);
    runtime.resolveEvents(state, DEFINITION);

    expect(target.query?.originX).toBe(0);
    expect(target.query?.originZ).toBe(0);
    expect(target.query?.reach).toBeCloseTo(
      DEFINITION.reach * SLEDGEHAMMER_PROGRESSION.uppercutReachScale,
      6,
    );
    expect(target.query?.arcRadians).toBeCloseTo(
      SLEDGEHAMMER_PROGRESSION.uppercutArcRadians,
      6,
    );
    expect(target.launches).toHaveLength(5);
    expect(target.knockbackCount).toBe(0);
    expect(target.launches.every((effect) => effect.horizontalSpeed === 9.2)).toBe(true);
    expect(target.launches.every((effect) => Math.abs(effect.targetHeight - 4.2) < 0.001))
      .toBe(true);
    expect(target.launches.every((effect) => effect.landingDamageBase
      === DEFINITION.baseDamage * SLEDGEHAMMER_PROGRESSION.uppercutLandingDamageScale))
      .toBe(true);
    expect(target.launches[0]?.directionX).not.toBe(target.launches[4]?.directionX);
  });
});

class UppercutTarget implements BattlefieldHammerCombatTarget {
  public query: BattlefieldMeleeQuery | null = null;
  public readonly launches: DirectionalLaunchEffect[] = [];
  public knockbackCount = 0;
  private readonly accepted = new Set<string>();

  public collectMeleeHits(
    query: Readonly<BattlefieldMeleeQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number {
    this.query = { ...query };
    result.reset();
    const positions = [[-1.2, 2], [-0.6, 2.4], [0, 2.8], [0.6, 2.4], [1.2, 2]];
    for (let entityId = 0; entityId < positions.length; entityId++) {
      const position = positions[entityId];
      result.include(1, entityId, position?.[0] ?? 0, position?.[1] ?? 0);
    }
    return result.count;
  }

  public collectMeleeSweepHits(
    _query: Readonly<BattlefieldMeleeSweepQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number {
    result.reset();
    return 0;
  }

  public acceptHitSequence(populationId: number, entityId: number, sequenceId: number): boolean {
    const key = `${populationId}:${entityId}:${sequenceId}`;
    if (this.accepted.has(key)) {
      return false;
    }
    this.accepted.add(key);
    return true;
  }

  public damageMonster(): boolean { return true; }

  public applyKnockback(): boolean {
    this.knockbackCount++;
    return true;
  }

  public applyVerticalLaunch(): boolean { return true; }

  public applyDirectionalLaunch(
    _populationId: number,
    _entityId: number,
    effect: Readonly<DirectionalLaunchEffect>,
  ): boolean {
    this.launches.push({ ...effect });
    return true;
  }

  public recordSpinHit(): number { return 1; }

  public applyKineticCarrier(): boolean { return true; }

  public getKnockbackResistance(): number { return 1; }
}

function createAutomaticUppercutState(): BattlefieldHammerActionState {
  const state = new BattlefieldHammerActionState();
  state.setAttackHeld(true);
  state.requestSwing(0, 1, 0);
  for (let frame = 0; frame < 180 && state.action !== WeaponAction.Uppercut; frame++) {
    if (state.canBufferNextSwing) {
      state.requestSwing(0, 1, 0);
    }
    state.update(1 / 60, DEFINITION, EVENTS);
  }
  expect(state.action).toBe(WeaponAction.Uppercut);
  return state;
}
