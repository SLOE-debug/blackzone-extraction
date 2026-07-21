import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type BattlefieldPerformanceConsoleReport,
  presentBattlefieldPerformanceReport,
} from '../../assets/bundles/battlefield/debug/battlefield-performance-console';

describe('战场性能控制台表格', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('按照窗口累计耗时从高到低排列阶段', () => {
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined);
    vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const table = vi.spyOn(console, 'table').mockImplementation(() => undefined);

    presentBattlefieldPerformanceReport(createReport());

    const rows = table.mock.calls[0]?.[0] as readonly Readonly<Record<string, unknown>>[];
    expect(rows.map((row) => row['阶段'])).toEqual([
      '怪物群体',
      '玩家动画移动',
      '输入与瞄准',
    ]);
    expect(rows[0]?.['平均每帧(ms)']).toBe(5);
    expect(rows[0]?.['战场CPU占比']).toBe('50.0%');
  });
});

function createReport(): BattlefieldPerformanceConsoleReport {
  return {
    windowSeconds: 2,
    frameCount: 10,
    updateTotal: 100,
    updateMaximum: 18,
    frameIntervalTotal: 166.7,
    frameIntervalMaximum: 20,
    previousConsoleOutputMilliseconds: 0.4,
    engineFrameMilliseconds: 8,
    engineLogicMilliseconds: 6,
    engineRendererMilliseconds: 2,
    drawCalls: 20,
    triangles: 1000,
    instances: 0,
    stageNames: Object.freeze(['输入与瞄准', '玩家动画移动', '怪物群体']),
    stageTotals: Float64Array.of(10, 30, 50),
    stageMaximums: Float64Array.of(2, 4, 12),
    stageSamples: Uint32Array.of(10, 10, 10),
    slowestFrameStages: Float64Array.of(1, 3, 12),
    eventNames: Object.freeze(['开启宝箱', '释放掉落物']),
    eventValues: Float64Array.of(1, 3),
    slowestFrameEvents: Float64Array.of(0, 3),
    snapshot: {
      playerX: 0,
      playerZ: 0,
      activeChunks: 25,
      environmentEntities: 360,
      environmentBatches: 18,
      environmentSynchronizing: false,
      groundSynchronizing: false,
      monsterSlots: 220,
      aliveMonsters: 128,
      visibleMonsters: 72,
      activeChests: 5,
      openedChests: 1,
      droppedEquipment: 3,
      droppedRenderBatches: 2,
    },
  };
}
