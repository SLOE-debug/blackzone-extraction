import { describe, expect, it } from 'vitest';
import {
  BattlefieldTreasurePerformanceMetrics,
  BattlefieldTreasurePerformanceSection,
} from '../../assets/bundles/battlefield/debug/battlefield-treasure-performance';
import { DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS } from '../../assets/bundles/battlefield/equipment/rendering/dropped-equipment-conservative-bounds';
import { BATTLEFIELD_LAYOUT } from '../../assets/bundles/battlefield/model/battlefield-layout';

describe('宝箱掉落性能指标', () => {
  it('同时累计 CPU、上传顶点、字节、活动数量与首显批次', () => {
    const metrics = new BattlefieldTreasurePerformanceMetrics();
    metrics.record(
      BattlefieldTreasurePerformanceSection.DroppedBodyUpload,
      0.8,
      120,
      1440,
      3,
      true,
    );
    metrics.record(
      BattlefieldTreasurePerformanceSection.DroppedBodyUpload,
      0.4,
      60,
      720,
      2,
      false,
    );
    const section = BattlefieldTreasurePerformanceSection.DroppedBodyUpload;
    expect(metrics.totals[section]).toBeCloseTo(1.2, 6);
    expect(metrics.maximums[section]).toBe(0.8);
    expect(metrics.uploadedVertices[section]).toBe(180);
    expect(metrics.uploadedBytes[section]).toBe(2160);
    expect(metrics.maximumActiveDrops[section]).toBe(3);
    expect(metrics.firstVisibleBatches[section]).toBe(1);
  });

  it('固定包围盒覆盖完整战场并为飞行和地面下预热保留余量', () => {
    expect(DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS.minX)
      .toBeLessThan(-BATTLEFIELD_LAYOUT.groundHalfExtent);
    expect(DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS.maxX)
      .toBeGreaterThan(BATTLEFIELD_LAYOUT.groundHalfExtent);
    expect(DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS.minY).toBeLessThan(-16);
    expect(DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS.maxY).toBeGreaterThan(4);
  });
});
