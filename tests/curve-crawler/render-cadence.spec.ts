import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { PlanarVisibilityDetail } from '../../assets/core/contracts/planar-circle-visibility';
import { CurveCrawlerPackedMeshUpdate } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-packed-mesh-update';
import { CurveCrawlerColorSnapshot } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-color-snapshot';
import { CurveCrawlerRenderCadence } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-render-cadence';
import { CurveCrawlerResidentLayout } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-resident-layout';
import { createCurveCrawlerMeshTestState } from './mesh-test-fixture';

describe('Curve Crawler 渲染错峰', () => {
  it('近距逐帧、中距隔帧、远距四帧一次且按实体身份分散', () => {
    const state = createCurveCrawlerMeshTestState(3);
    const residents = createResidents(state);
    const colors = new CurveCrawlerColorSnapshot(state);
    const cadence = new CurveCrawlerRenderCadence(state.count);
    colors.captureResident(residents.entityIndices, residents.count);

    cadence.schedule(1, state, residents, colors, 0, true, false);
    expect(Array.from(cadence.updates.subarray(0, residents.count))).toEqual([
      CurveCrawlerPackedMeshUpdate.Position,
      CurveCrawlerPackedMeshUpdate.Position,
      CurveCrawlerPackedMeshUpdate.None,
    ]);

    colors.captureResident(residents.entityIndices, residents.count);
    cadence.schedule(1, state, residents, colors, 1, true, false);
    expect(Array.from(cadence.updates.subarray(0, residents.count))).toEqual([
      CurveCrawlerPackedMeshUpdate.Position,
      CurveCrawlerPackedMeshUpdate.None,
      CurveCrawlerPackedMeshUpdate.None,
    ]);
  });

  it('出生死亡逐帧更新，颜色只在跨过量化档位时触发带明暗求值', () => {
    const state = createCurveCrawlerMeshTestState(3);
    const residents = createResidents(state);
    const colors = new CurveCrawlerColorSnapshot(state);
    const cadence = new CurveCrawlerRenderCadence(state.count);
    state.data.vitality.state[2] = MonsterLifecycleState.Dying;
    colors.captureResident(residents.entityIndices, residents.count);
    state.data.animation.hitFlash[1] = 0.3;
    colors.captureResident(residents.entityIndices, residents.count);

    cadence.schedule(2, state, residents, colors, 1, true, false);
    expect(cadence.updates[1]).toBe(CurveCrawlerPackedMeshUpdate.Shaded);
    expect(cadence.updates[2]).toBe(CurveCrawlerPackedMeshUpdate.Position);

    state.data.animation.hitFlash[1] = 0.31;
    colors.captureResident(residents.entityIndices, residents.count);
    cadence.schedule(2, state, residents, colors, 1, false, false);
    expect(cadence.updates[1]).toBe(CurveCrawlerPackedMeshUpdate.None);
  });
});

function createResidents(
  state: ReturnType<typeof createCurveCrawlerMeshTestState>,
): CurveCrawlerResidentLayout {
  const residents = new CurveCrawlerResidentLayout(state.count, {
    isCircleVisible: (): boolean => true,
    resolveDetail: (centerX): PlanarVisibilityDetail => centerX < 20
      ? PlanarVisibilityDetail.Full
      : centerX < 40
        ? PlanarVisibilityDetail.Reduced
        : PlanarVisibilityDetail.Minimal,
  });
  residents.synchronize(state);
  return residents;
}
