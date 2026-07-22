import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { CurveCrawlerPackedMeshUpdate } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-packed-mesh-update';
import { CurveCrawlerColorSnapshot } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-color-snapshot';
import { CurveCrawlerDirtyUpdatePlan } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-dirty-update-plan';
import { CurveCrawlerResidentLayout } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-resident-layout';
import { createCurveCrawlerMeshTestState } from './mesh-test-fixture';

describe('Curve Crawler 脏区更新计划', () => {
  it('姿态脏时逐实体更新完整模型，不再按距离错峰', () => {
    const state = createCurveCrawlerMeshTestState(3);
    state.data.vitality.state.fill(MonsterLifecycleState.Alive);
    const residents = createResidents(state);
    const colors = new CurveCrawlerColorSnapshot(state);
    const plan = new CurveCrawlerDirtyUpdatePlan(state.count);
    colors.captureResident(residents.entityIndices, residents.count);

    plan.schedule(state, residents, colors, true, false);

    expect(Array.from(plan.updates.subarray(0, residents.count))).toEqual([
      CurveCrawlerPackedMeshUpdate.Position,
      CurveCrawlerPackedMeshUpdate.Position,
      CurveCrawlerPackedMeshUpdate.Position,
    ]);
  });

  it('只把颜色变化实体标为带明暗更新，强制重写覆盖全部驻留实体', () => {
    const state = createCurveCrawlerMeshTestState(3);
    state.data.vitality.state.fill(MonsterLifecycleState.Alive);
    const residents = createResidents(state);
    const colors = new CurveCrawlerColorSnapshot(state);
    const plan = new CurveCrawlerDirtyUpdatePlan(state.count);
    colors.captureResident(residents.entityIndices, residents.count);
    state.data.animation.hitFlash[1] = 0.3;
    colors.captureResident(residents.entityIndices, residents.count);

    plan.schedule(state, residents, colors, false, false);
    expect(Array.from(plan.updates.subarray(0, residents.count))).toEqual([
      CurveCrawlerPackedMeshUpdate.None,
      CurveCrawlerPackedMeshUpdate.Shaded,
      CurveCrawlerPackedMeshUpdate.None,
    ]);

    plan.schedule(state, residents, colors, false, true);
    expect(Array.from(plan.updates.subarray(0, residents.count))).toEqual([
      CurveCrawlerPackedMeshUpdate.Shaded,
      CurveCrawlerPackedMeshUpdate.Shaded,
      CurveCrawlerPackedMeshUpdate.Shaded,
    ]);
  });
});

function createResidents(
  state: ReturnType<typeof createCurveCrawlerMeshTestState>,
): CurveCrawlerResidentLayout {
  const residents = new CurveCrawlerResidentLayout(state.count);
  residents.synchronize(state);
  return residents;
}
