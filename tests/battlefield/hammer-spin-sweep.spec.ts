import { describe, expect, it } from 'vitest';
import { type BattlefieldMeleeHitBuffer, type BattlefieldMeleeQuery, type BattlefieldMeleeSweepQuery } from '../../assets/bundles/battlefield/combat/melee/battlefield-melee-query';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { BattlefieldHammerActionState } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-state';
import { type MutableHammerActionEvents } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-events';
import { type BattlefieldHammerCombatTarget } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-combat-target';
import { BattlefieldHammerCombatRuntime, type BattlefieldHammerOwnerState } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-combat-runtime';
import { type BattlefieldHammerWorldPose } from '../../assets/bundles/battlefield/equipment/model/battlefield-hammer-world-pose';

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
    const runtime = new BattlefieldHammerCombatRuntime(target);
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
    const runtime = new BattlefieldHammerCombatRuntime(target);
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
});

class RecordingCombatTarget implements BattlefieldHammerCombatTarget {
  public radialQueryCount = 0;
  public sweepQueryCount = 0;
  public damageCount = 0;
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
      result.include(7, 11, 1, 0.2);
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

  public applyKnockback(): boolean {
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
