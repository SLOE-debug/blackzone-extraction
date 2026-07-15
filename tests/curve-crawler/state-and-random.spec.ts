import { describe, expect, it } from 'vitest';
import { nextRandom } from '../../assets/core/math/xorshift32';
import { normalizeCurveCrawlerOptions } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-options';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';

const options = normalizeCurveCrawlerOptions({
  count: 12,
  spawnArea: { width: 320, height: 180 },
  seed: 20260715,
});

describe('Curve Crawler 状态初始化', () => {
  it('相同种子生成完全一致的 SoA 数据', () => {
    const first = new CurveCrawlerState(options);
    const second = new CurveCrawlerState(options);

    expect(Array.from(first.data.transform.x)).toEqual(Array.from(second.data.transform.x));
    expect(Array.from(first.data.transform.y)).toEqual(Array.from(second.data.transform.y));
    expect(Array.from(first.data.morphology.legLength)).toEqual(
      Array.from(second.data.morphology.legLength),
    );
    expect(Array.from(first.data.morphology.liquidRadiusScales)).toEqual(
      Array.from(second.data.morphology.liquidRadiusScales),
    );
    expect(Array.from(first.data.death.fragmentDirectionX)).toEqual(
      Array.from(second.data.death.fragmentDirectionX),
    );
    expect(Array.from(first.data.death.fragmentSpinSpeed)).toEqual(
      Array.from(second.data.death.fragmentSpinSpeed),
    );
    expect(Array.from(first.data.animation.legPhaseOffsets)).toEqual(
      Array.from(second.data.animation.legPhaseOffsets),
    );
  });

  it('不同实体持有互相隔离的随机状态', () => {
    const state = new CurveCrawlerState(options);
    const firstValue = nextRandom(state.data.identity.randomState, 0);
    const secondValue = nextRandom(state.data.identity.randomState, 1);

    expect(firstValue).not.toBe(secondValue);
    expect(state.data.identity.randomState[0]).not.toBe(state.data.identity.randomState[1]);
  });

  it('初始化位置位于声明的生成区域内', () => {
    const state = new CurveCrawlerState(options);

    for (let index = 0; index < state.count; index++) {
      expect(Math.abs(state.data.transform.x[index] ?? 0)).toBeLessThan(options.spawnArea.width * 0.5);
      expect(Math.abs(state.data.transform.y[index] ?? 0)).toBeLessThan(options.spawnArea.height * 0.5);
    }
  });
});
