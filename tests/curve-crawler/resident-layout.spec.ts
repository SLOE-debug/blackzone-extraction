import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { type CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { CurveCrawlerResidentLayout } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-resident-layout';

describe('CurveCrawlerResidentLayout', () => {
  it('只紧凑保留出生、存活和死亡中的槽位', () => {
    const state = createState([
      MonsterLifecycleState.Dormant,
      MonsterLifecycleState.Spawning,
      MonsterLifecycleState.Alive,
      MonsterLifecycleState.Dying,
      MonsterLifecycleState.DeathComplete,
    ]);
    const layout = new CurveCrawlerResidentLayout(state.count);

    expect(layout.synchronize(state)).toBe(true);
    expect(layout.count).toBe(3);
    expect(Array.from(layout.entityIndices.subarray(0, layout.count))).toEqual([1, 2, 3]);
    expect(layout.synchronize(state)).toBe(false);
  });

  it('在生命周期顺序变化后原地更新，不替换 TypedArray', () => {
    const state = createState([
      MonsterLifecycleState.Alive,
      MonsterLifecycleState.Dormant,
      MonsterLifecycleState.Alive,
      MonsterLifecycleState.DeathComplete,
    ]);
    const layout = new CurveCrawlerResidentLayout(state.count);
    const indices = layout.entityIndices;
    layout.synchronize(state);

    state.data.vitality.state[0] = MonsterLifecycleState.DeathComplete;
    state.data.vitality.state[1] = MonsterLifecycleState.Spawning;

    expect(layout.synchronize(state)).toBe(true);
    expect(layout.entityIndices).toBe(indices);
    expect(Array.from(layout.entityIndices.subarray(0, layout.count))).toEqual([1, 2]);
  });

  it('保留全部处于可渲染生命周期的实体，不按空间位置裁切', () => {
    const state = createState([
      MonsterLifecycleState.Alive,
      MonsterLifecycleState.Alive,
      MonsterLifecycleState.Alive,
    ]);
    state.data.transform.x[0] = -4;
    state.data.transform.x[1] = 2;
    state.data.transform.x[2] = 8;
    const layout = new CurveCrawlerResidentLayout(state.count);

    expect(layout.synchronize(state)).toBe(true);
    expect(Array.from(layout.entityIndices.subarray(0, layout.count))).toEqual([0, 1, 2]);
  });
});

function createState(states: readonly MonsterLifecycleState[]): CurveCrawlerState {
  return {
    count: states.length,
    data: {
      transform: {
        x: new Float32Array(states.length),
        y: new Float32Array(states.length),
      },
      morphology: {
        bodyLength: new Float32Array(states.length).fill(6),
        legLength: new Float32Array(states.length).fill(9),
        legWidth: new Float32Array(states.length).fill(0.7),
      },
      vitality: {
        state: Uint8Array.from(states),
        stateTime: new Float32Array(states.length),
      },
    },
  } as unknown as CurveCrawlerState;
}
