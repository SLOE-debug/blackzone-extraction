import { describe, expect, it } from 'vitest';
import {
  isMonsterLifecycleResident,
  MonsterLifecycleState,
  type MonsterLifecycleSoA,
} from '../../assets/core/contracts/monster-lifecycle';
import {
  transitionMonsterLifecycle,
} from '../../assets/core/monsters/monster-lifecycle-state-machine';
import {
  MonsterPopulationActivationSystem,
  type MonsterPopulationActivationTarget,
} from '../../assets/core/monsters/monster-population-activation-system';

interface TestSpawnContext {
  readonly marker: number;
}

class TestActivationTarget implements MonsterPopulationActivationTarget<TestSpawnContext> {
  public readonly lifecycle: MonsterLifecycleSoA;
  public readonly delays: Float32Array;
  public readonly markers: Int32Array;

  constructor(public readonly capacity: number) {
    this.lifecycle = {
      state: new Uint8Array(capacity),
      stateTime: new Float32Array(capacity),
    };
    this.lifecycle.state.fill(MonsterLifecycleState.Dormant);
    this.delays = new Float32Array(capacity);
    this.markers = new Int32Array(capacity);
  }

  public getLifecycleState(entityIndex: number): MonsterLifecycleState {
    return this.lifecycle.state[entityIndex] as MonsterLifecycleState;
  }

  public beginSpawning(
    entityIndex: number,
    context: Readonly<TestSpawnContext>,
    delaySeconds: number,
  ): void {
    transitionMonsterLifecycle(
      this.lifecycle,
      entityIndex,
      MonsterLifecycleState.Spawning,
      -delaySeconds,
    );
    this.delays[entityIndex] = delaySeconds;
    this.markers[entityIndex] = context.marker;
  }
}

describe('通用怪物生命周期', () => {
  it('只允许按照出生、存活、死亡和死亡完成路径转换', () => {
    const target = new TestActivationTarget(1);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.Spawning);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.Alive);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.Dying);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.DeathComplete);
    expect(target.lifecycle.state[0]).toBe(MonsterLifecycleState.DeathComplete);
    expect(() => transitionMonsterLifecycle(
      target.lifecycle,
      0,
      MonsterLifecycleState.Alive,
    )).toThrow(/禁止/);
  });

  it('退场保持 Resident，演出完成后才能转入 Dormant', () => {
    const target = new TestActivationTarget(1);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.Spawning);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.Alive);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.Despawning);
    expect(isMonsterLifecycleResident(MonsterLifecycleState.Despawning)).toBe(true);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.Dormant);
    expect(target.lifecycle.state[0]).toBe(MonsterLifecycleState.Dormant);
  });

  it('把同批激活槽位按固定间隔错峰送入出生状态', () => {
    const target = new TestActivationTarget(6);
    const activation = new MonsterPopulationActivationSystem<TestSpawnContext>();

    expect(activation.synchronize(target, { marker: 37 }, 4, 0.16)).toBe(4);

    expect(Array.from(target.lifecycle.state)).toEqual([
      MonsterLifecycleState.Spawning,
      MonsterLifecycleState.Spawning,
      MonsterLifecycleState.Spawning,
      MonsterLifecycleState.Spawning,
      MonsterLifecycleState.Dormant,
      MonsterLifecycleState.Dormant,
    ]);
    expect(target.delays[3]).toBeCloseTo(0.48);
    expect(target.markers[3]).toBe(37);
  });

  it('死亡期间保留槽位，只有死亡完成后才启动替补出生', () => {
    const target = new TestActivationTarget(3);
    const activation = new MonsterPopulationActivationSystem<TestSpawnContext>();
    activation.synchronize(target, { marker: 1 }, 2, 0);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.Alive);
    transitionMonsterLifecycle(target.lifecycle, 1, MonsterLifecycleState.Alive);
    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.Dying);

    expect(activation.synchronize(target, { marker: 2 }, 2, 0)).toBe(0);
    expect(target.lifecycle.state[2]).toBe(MonsterLifecycleState.Dormant);

    transitionMonsterLifecycle(target.lifecycle, 0, MonsterLifecycleState.DeathComplete);
    expect(activation.synchronize(target, { marker: 3 }, 2, 0)).toBe(1);
    expect(target.lifecycle.state[0]).toBe(MonsterLifecycleState.Spawning);
    expect(target.markers[0]).toBe(3);
  });
});
