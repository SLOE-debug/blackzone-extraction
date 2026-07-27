import { describe, expect, it } from 'vitest';
import { type PlanarKnockbackEffect } from '../../assets/core/contracts/monster-effects';
import { type BattlefieldMeleeHitBuffer, type BattlefieldMeleeQuery, type BattlefieldMeleeSweepQuery } from '../../assets/bundles/battlefield/combat/melee/battlefield-melee-query';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { BattlefieldHammerActionState } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-state';
import { type MutableHammerActionEvents } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-events';
import { type BattlefieldHammerCombatTarget } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-combat-target';
import { BattlefieldHammerCombatRuntime, type BattlefieldHammerOwnerState } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-combat-runtime';
import { type BattlefieldHammerWorldPose } from '../../assets/bundles/battlefield/equipment/model/battlefield-hammer-world-pose';
import { SledgehammerSpinKnockbackTuning } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-spin-knockback-tuning';

const DEFINITION = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.Sledgehammer);
const OWNER: BattlefieldHammerOwnerState = Object.freeze({
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  heading: 0,
  alive: true,
});
const EVENTS: MutableHammerActionEvents = {
  uppercutImpact: false,
  groundSlamImpact: false,
  spinPulse: false,
  spinFinal: false,
};

describe('旋风真实锤头扫掠', () => {
  it('逐帧查询上一帧到当前帧的锤头胶囊并仅增加小幅辅助余量', () => {
    const target = new RecordingCombatTarget();
    const runtime = new BattlefieldHammerCombatRuntime(
      target,
      new SledgehammerSpinKnockbackTuning(),
    );
    runtime.sweepDebug.setEnabled(true);
    const state = createSpinState();
    runtime.synchronizeHead(createHeadPose(0, 0), 0.369);
    state.update(0.05, DEFINITION, EVENTS);
    runtime.synchronizeHead(createHeadPose(1.8, 0.4), 0.369);
    runtime.collectHits(OWNER, state, EVENTS, DEFINITION);

    expect(target.radialQueryCount).toBe(0);
    expect(target.sweepQueryCount).toBe(1);
    expect(target.lastSweep?.startX).toBeCloseTo(0, 6);
    expect(target.lastSweep?.startZ).toBeCloseTo(0, 6);
    expect(target.lastSweep?.endX).toBeCloseTo(1.8, 6);
    expect(target.lastSweep?.endZ).toBeCloseTo(0.4, 6);
    expect(target.lastSweep?.radius).toBeCloseTo(0.519, 6);
    expect(runtime.sweepDebug.active).toBe(true);
    expect(runtime.sweepDebug.startX).toBeCloseTo(0, 6);
    expect(runtime.sweepDebug.endX).toBeCloseTo(1.8, 6);
  });

  it('同一脉冲窗口内同一怪物只受伤一次，跨窗口后可再次命中', () => {
    const target = new RecordingCombatTarget(true);
    const runtime = new BattlefieldHammerCombatRuntime(
      target,
      new SledgehammerSpinKnockbackTuning(),
    );
    runtime.sweepDebug.setEnabled(true);
    const state = createSpinState();
    runtime.synchronizeHead(createHeadPose(0, 0), 0.369);

    advanceSpinFrame(runtime, state, 0.05, 1, 0);
    advanceSpinFrame(runtime, state, 0.05, 1.4, 0.2);
    expect(target.damageCount).toBe(1);

    advanceSpinFrame(runtime, state, 0.12, 1.8, 0.4);
    expect(EVENTS.spinPulse).toBe(true);
    expect(target.damageCount).toBe(2);
    expect(target.radialQueryCount).toBe(0);
    expect(runtime.sweepDebug.hitCount).toBe(1);
    expect(runtime.sweepDebug.getHitX(0)).toBeCloseTo(1, 6);
  });

  it('普通脉冲同时产生径向与切向冲量，终结打击恢复纯径向并显著提速', () => {
    const target = new RecordingCombatTarget(true);
    const runtime = new BattlefieldHammerCombatRuntime(
      target,
      new SledgehammerSpinKnockbackTuning(),
    );
    const state = createSpinState();
    runtime.synchronizeHead(createHeadPose(0, 0), 0.369);

    advanceSpinFrame(runtime, state, 0.05, 1, 0);
    const pulse = target.knockbacks[0];
    expect(pulse?.directionX).toBeGreaterThan(0);
    expect(pulse?.directionZ).toBeGreaterThan(0);
    expect(pulse?.initialSpeed).toBeGreaterThanOrEqual(32);
    expect(pulse?.initialSpeed).toBeLessThan(32.1);

    advanceSpinFrame(runtime, state, 1.4, 1.2, 0);
    expect(EVENTS.spinFinal).toBe(true);
    const final = target.knockbacks.at(-1);
    expect(final?.directionX).toBeCloseTo(1, 6);
    expect(final?.directionZ).toBeCloseTo(0, 6);
    expect(final?.initialSpeed).toBeCloseTo(80, 6);
    expect(final?.initialSpeed).toBeGreaterThan(pulse?.initialSpeed ?? 0);
    expect(final?.maximumSpeed).toBe(80);
  });

  it('运行时直接读取右上角调参对象的最新旋风击退值', () => {
    const target = new RecordingCombatTarget(true);
    const tuning = new SledgehammerSpinKnockbackTuning();
    tuning.setImpulse(20);
    tuning.setPulseMinimumScale(1);
    tuning.setPulseMaximumScale(1);
    tuning.setMaximumSpeed(70);
    tuning.setDurationSeconds(0.8);
    tuning.setPulseRadialWeight(1);
    tuning.setPulseTangentialWeight(0);
    const runtime = new BattlefieldHammerCombatRuntime(target, tuning);
    const state = createSpinState();
    runtime.synchronizeHead(createHeadPose(0, 0), 0.369);

    advanceSpinFrame(runtime, state, 0.05, 1, 0);
    const pulse = target.knockbacks[0];
    expect(pulse?.initialSpeed).toBe(20);
    expect(pulse?.remainingSeconds).toBeCloseTo(0.8, 6);
    expect(pulse?.maximumSpeed).toBe(70);
    expect(pulse?.directionX).toBeCloseTo(1, 6);
    expect(pulse?.directionZ).toBeCloseTo(0, 6);

    tuning.setImpulse(25);
    tuning.setFinalScale(3);
    advanceSpinFrame(runtime, state, 1.4, 1.2, 0);
    expect(target.knockbacks.at(-1)?.initialSpeed).toBe(75);
  });
});

class RecordingCombatTarget implements BattlefieldHammerCombatTarget {
  public radialQueryCount = 0;
  public sweepQueryCount = 0;
  public damageCount = 0;
  public readonly knockbacks: PlanarKnockbackEffect[] = [];
  public lastSweep: BattlefieldMeleeSweepQuery | null = null;
  private readonly acceptedSequences = new Set<number>();

  constructor(private readonly includeHit = false) {}

  public collectMeleeHits(
    _query: Readonly<BattlefieldMeleeQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number {
    this.radialQueryCount++;
    result.reset();
    return 0;
  }

  public collectMeleeSweepHits(
    query: Readonly<BattlefieldMeleeSweepQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number {
    this.sweepQueryCount++;
    this.lastSweep = { ...query };
    result.reset();
    if (this.includeHit) {
      result.include(7, 11, 1, 0);
    }
    return result.count;
  }

  public acceptHitSequence(_populationId: number, _entityId: number, sequenceId: number): boolean {
    if (this.acceptedSequences.has(sequenceId)) {
      return false;
    }
    this.acceptedSequences.add(sequenceId);
    return true;
  }

  public damageMonster(): boolean {
    this.damageCount++;
    return true;
  }

  public applyKnockback(
    _populationId: number,
    _entityId: number,
    effect: Readonly<PlanarKnockbackEffect>,
  ): boolean {
    this.knockbacks.push({ ...effect });
    return true;
  }

  public applyVerticalLaunch(): boolean {
    return true;
  }

  public applyDirectionalLaunch(): boolean {
    return true;
  }

  public recordSpinHit(): number {
    return this.damageCount + 1;
  }

  public applyKineticCarrier(): boolean {
    return true;
  }

  public getKnockbackResistance(): number {
    return 1;
  }
}

function createSpinState(): BattlefieldHammerActionState {
  const state = new BattlefieldHammerActionState();
  for (let hit = 0; hit < DEFINITION.specialRequiredHits; hit++) {
    state.recordConfirmedAttack(DEFINITION);
  }
  state.update(0.05, DEFINITION, EVENTS);
  expect(state.requestSpin(0)).toBe(true);
  return state;
}

function advanceSpinFrame(
  runtime: BattlefieldHammerCombatRuntime,
  state: BattlefieldHammerActionState,
  deltaTime: number,
  headX: number,
  headZ: number,
): void {
  runtime.beginFrame();
  state.update(deltaTime, DEFINITION, EVENTS);
  runtime.synchronizeHead(createHeadPose(headX, headZ), 0.369);
  runtime.collectHits(OWNER, state, EVENTS, DEFINITION);
  runtime.resolveEvents(state, DEFINITION);
}

function createHeadPose(headX: number, headZ: number): BattlefieldHammerWorldPose {
  return {
    headX,
    headY: 1,
    headZ,
  };
}
