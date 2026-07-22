import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { CurveCrawlerPackedMeshUpdate } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-packed-mesh-update';
import { CurveCrawlerColorSnapshot } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-color-snapshot';
import { CurveCrawlerDirtyUpdatePlan } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-dirty-update-plan';
import { CurveCrawlerPoseSnapshot } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-pose-snapshot';
import { CurveCrawlerRenderCadence } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-render-cadence';
import { CurveCrawlerResidentLayout } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-resident-layout';
import { type CurveCrawlerVisibilityLayout } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-visibility-layout';
import { createCurveCrawlerMeshTestState } from './mesh-test-fixture';

describe('Curve Crawler 脏区更新计划', () => {
  it('只为固定频率到期且姿态实际变化的实体生成位置更新', () => {
    const state = createCurveCrawlerMeshTestState(3);
    state.data.vitality.state.fill(MonsterLifecycleState.Alive);
    const residents = createResidents(state);
    const colors = new CurveCrawlerColorSnapshot(state);
    const poses = new CurveCrawlerPoseSnapshot(state.count);
    const cadence = new CurveCrawlerRenderCadence();
    const plan = new CurveCrawlerDirtyUpdatePlan(state.count);
    const visibility = createVisibility(residents);
    cadence.advance(0, state.count);
    plan.schedule(state, visibility, 0, cadence, poses, colors, true);
    state.data.animation.phase[1] = 0.5;
    cadence.advance(1 / 30, state.count);

    plan.schedule(state, visibility, 0, cadence, poses, colors, false);

    expect(Array.from(plan.updates.subarray(0, residents.count))).toEqual([
      CurveCrawlerPackedMeshUpdate.None,
      CurveCrawlerPackedMeshUpdate.Position,
      CurveCrawlerPackedMeshUpdate.None,
    ]);
  });

  it('只把颜色变化实体标为带明暗更新，强制重写覆盖全部驻留实体', () => {
    const state = createCurveCrawlerMeshTestState(3);
    state.data.vitality.state.fill(MonsterLifecycleState.Alive);
    const residents = createResidents(state);
    const colors = new CurveCrawlerColorSnapshot(state);
    const poses = new CurveCrawlerPoseSnapshot(state.count);
    const cadence = new CurveCrawlerRenderCadence();
    const plan = new CurveCrawlerDirtyUpdatePlan(state.count);
    const visibility = createVisibility(residents);
    cadence.advance(0, state.count);
    plan.schedule(state, visibility, 0, cadence, poses, colors, true);
    state.data.animation.hitFlash[1] = 0.3;
    cadence.advance(1 / 30, state.count);

    plan.schedule(state, visibility, 0, cadence, poses, colors, false);
    expect(Array.from(plan.updates.subarray(0, residents.count))).toEqual([
      CurveCrawlerPackedMeshUpdate.None,
      CurveCrawlerPackedMeshUpdate.Shaded,
      CurveCrawlerPackedMeshUpdate.None,
    ]);

    plan.schedule(state, visibility, 0, cadence, poses, colors, true);
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

function createVisibility(
  residents: CurveCrawlerResidentLayout,
): CurveCrawlerVisibilityLayout {
  return {
    entityIndices: residents.entityIndices,
    count: residents.count,
    didEntityChange: () => false,
  } as unknown as CurveCrawlerVisibilityLayout;
}
