import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { PlanarVisibilityDetail } from '../../assets/core/contracts/planar-circle-visibility';
import { curveCrawlerMeshPlan } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-compiler';
import {
  CurveCrawlerActiveIndexLayout,
  getCurveCrawlerBodyLodIndexCount,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-active-index-layout';
import { CurveCrawlerResidentLayout } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-resident-layout';
import { createCurveCrawlerMeshTestState } from './mesh-test-fixture';

describe('Curve Crawler 活动索引与距离 LOD', () => {
  it('同一共享批次按距离减少足部和腿部三角形', () => {
    const state = createCurveCrawlerMeshTestState(3);
    state.data.vitality.state.fill(MonsterLifecycleState.Alive);
    state.data.transform.x[0] = 0;
    state.data.transform.x[1] = 1;
    state.data.transform.x[2] = 2;
    const residents = new CurveCrawlerResidentLayout(state.count, {
      isCircleVisible: (): boolean => true,
      resolveDetail: (centerX): PlanarVisibilityDetail => centerX === 0
        ? PlanarVisibilityDetail.Full
        : centerX === 1
          ? PlanarVisibilityDetail.Reduced
          : PlanarVisibilityDetail.Minimal,
    });
    residents.synchronize(state);

    const layout = new CurveCrawlerActiveIndexLayout(curveCrawlerMeshPlan);
    const indices = new Uint32Array(curveCrawlerMeshPlan.indexCount * state.count);
    expect(layout.synchronize(
      [{ renderIdentity: 1, state, residents }],
      indices,
      state.count,
      true,
    )).toBe(true);
    const expected = getCurveCrawlerBodyLodIndexCount(
      curveCrawlerMeshPlan,
      PlanarVisibilityDetail.Full,
    ) + getCurveCrawlerBodyLodIndexCount(
      curveCrawlerMeshPlan,
      PlanarVisibilityDetail.Reduced,
    ) + getCurveCrawlerBodyLodIndexCount(
      curveCrawlerMeshPlan,
      PlanarVisibilityDetail.Minimal,
    );
    expect(layout.indexCount).toBe(expected);
    expect(layout.indexCount).toBeLessThan(curveCrawlerMeshPlan.indexCount * 2);
    expect(maximumIndex(indices, layout.indexCount)).toBeLessThan(
      curveCrawlerMeshPlan.vertexCount * state.count,
    );
    expect(layout.synchronize(
      [{ renderIdentity: 1, state, residents }],
      indices,
      state.count,
      false,
    )).toBe(false);

    const fullCount = getCurveCrawlerBodyLodIndexCount(
      curveCrawlerMeshPlan,
      PlanarVisibilityDetail.Full,
    );
    expect(getCurveCrawlerBodyLodIndexCount(
      curveCrawlerMeshPlan,
      PlanarVisibilityDetail.Reduced,
    )).toBeLessThan(fullCount * 0.45);
    expect(getCurveCrawlerBodyLodIndexCount(
      curveCrawlerMeshPlan,
      PlanarVisibilityDetail.Minimal,
    )).toBeLessThan(fullCount * 0.36);
  });

  it('存活实体不提交出生和死亡拓扑，死亡时只追加液体扇面', () => {
    const state = createCurveCrawlerMeshTestState(1);
    state.data.vitality.state[0] = MonsterLifecycleState.Alive;
    const residents = new CurveCrawlerResidentLayout(state.count, {
      isCircleVisible: (): boolean => true,
      resolveDetail: (): PlanarVisibilityDetail => PlanarVisibilityDetail.Full,
    });
    residents.synchronize(state);
    const layout = new CurveCrawlerActiveIndexLayout(curveCrawlerMeshPlan);
    const indices = new Uint32Array(curveCrawlerMeshPlan.indexCount);
    layout.synchronize([{ renderIdentity: 7, state, residents }], indices, 1, true);
    const aliveIndexCount = layout.indexCount;
    expect(aliveIndexCount).toBe(
      curveCrawlerMeshPlan.body.indexCount + curveCrawlerMeshPlan.eyes.indexCount,
    );

    state.data.vitality.state[0] = MonsterLifecycleState.Dying;
    residents.synchronize(state);
    expect(layout.synchronize(
      [{ renderIdentity: 7, state, residents }],
      indices,
      1,
      false,
    )).toBe(true);
    expect(layout.indexCount).toBe(aliveIndexCount + curveCrawlerMeshPlan.liquidFan.indexCount);
  });
});

function maximumIndex(indices: Uint32Array, count: number): number {
  let maximum = 0;
  for (let index = 0; index < count; index++) {
    maximum = Math.max(maximum, indices[index] ?? 0);
  }
  return maximum;
}
