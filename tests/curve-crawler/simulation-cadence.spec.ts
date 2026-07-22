import { describe, expect, it } from 'vitest';
import { CurveCrawlerSimulationCadence } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-simulation-cadence';

describe('Curve Crawler 模拟节奏', () => {
  it('在 60 Hz 下将决策和分离错开到相邻帧并保持累计时间', () => {
    const cadence = new CurveCrawlerSimulationCadence();
    cadence.advance(1 / 60);
    expect(cadence.intentDeltaTime).toBe(0);
    expect(cadence.separationDeltaTime).toBeCloseTo(1 / 30, 6);

    cadence.advance(1 / 60);
    expect(cadence.intentDeltaTime).toBeCloseTo(1 / 30, 6);
    expect(cadence.separationDeltaTime).toBe(0);
  });

  it('限制低帧率时间债务并在无实体时复位', () => {
    const cadence = new CurveCrawlerSimulationCadence();
    cadence.advance(0.5);
    expect(cadence.intentDeltaTime).toBeCloseTo(1 / 15, 6);
    expect(cadence.separationDeltaTime).toBeCloseTo(1 / 15, 6);

    cadence.reset();
    expect(cadence.intentDeltaTime).toBe(0);
    expect(cadence.separationDeltaTime).toBe(0);
  });

  it('在 Web 61 Hz 调度下仍稳定每两个显示帧发布一次决策', () => {
    const cadence = new CurveCrawlerSimulationCadence();
    cadence.advance(1 / 61);
    expect(cadence.intentDeltaTime).toBe(0);
    cadence.advance(1 / 61);
    expect(cadence.intentDeltaTime).toBeCloseTo(2 / 61, 6);
  });
});
