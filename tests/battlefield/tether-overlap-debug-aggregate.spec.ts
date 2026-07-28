import { afterEach, describe, expect, it, vi } from 'vitest';
import { BattlefieldTetherOverlapDebugAggregate } from '../../assets/bundles/battlefield/population/battlefield-tether-overlap-debug-aggregate';
import { type BattlefieldTetherQuery } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-arrow-query';

const QUERY: Readonly<BattlefieldTetherQuery> = {
  startX: -1,
  startY: 0.1,
  startZ: 0,
  endX: 1,
  endY: 0.1,
  endZ: 0,
  radius: 0.12,
};

describe('弦线重叠聚合诊断', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('按拒绝阶段聚合并保留最近的 Y 轴漏判样本', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const group = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined);
    const table = vi.spyOn(console, 'table').mockImplementation(() => undefined);
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
    const aggregate = new BattlefieldTetherOverlapDebugAggregate();

    aggregate.beginQuery(3);
    aggregate.beginQuery(0);
    aggregate.rejectLifecycle();
    aggregate.observeCandidate(4, 7, QUERY, 0, 1, 0, 0.2, 0.3, -1);
    aggregate.observeCandidate(4, 8, QUERY, 0, 0, 0.8, 1.2, 0.3, -1);
    aggregate.observeCandidate(4, 9, QUERY, 0.2, 0, 0.7, 1.1, 0.3, -1);
    aggregate.observeCandidate(4, 10, QUERY, 0, 0, 0, 0.2, 0.3, 0.5);

    now.mockReturnValue(1999);
    aggregate.flushIfDue();
    expect(group).not.toHaveBeenCalled();

    now.mockReturnValue(2000);
    aggregate.flushIfDue();

    expect(group).toHaveBeenCalledWith(
      '[TetherOverlap 2s] accepted=1, verticalRejected=2, planarRejected=1',
    );
    expect(table).toHaveBeenNthCalledWith(1, [{
      '窗口毫秒': 2000,
      '弦线查询数': 2,
      '宽相位候选数': 3,
      '零候选查询数': 1,
      '生命周期拒绝': 1,
      '平面距离拒绝': 1,
      'Y轴高度拒绝': 2,
      '最终重叠命中': 1,
    }]);
    expect(table).toHaveBeenNthCalledWith(2, [{
      '最近Y轴漏判 population': 4,
      'entity': 9,
      '激光Y': 0.1,
      '足部范围最低Y': 0.7,
      '身体顶部最高Y': 1.1,
      'Y轴差距': 0.6,
      'XZ中心到线距离': 0,
      'XZ允许半径': 0.3,
      '线段进度': 0.6,
    }]);
    expect(groupEnd).toHaveBeenCalledOnce();
  });

  it('输出后重置窗口计数与漏判样本', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined);
    const table = vi.spyOn(console, 'table').mockImplementation(() => undefined);
    vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
    const aggregate = new BattlefieldTetherOverlapDebugAggregate();

    aggregate.beginQuery(1);
    aggregate.observeCandidate(2, 3, QUERY, 0, 0, 0.8, 1.2, 0.3, -1);
    now.mockReturnValue(2000);
    aggregate.flushIfDue();

    table.mockClear();
    aggregate.beginQuery(0);
    now.mockReturnValue(4000);
    aggregate.flushIfDue();

    expect(table).toHaveBeenCalledOnce();
    expect(table).toHaveBeenCalledWith([expect.objectContaining({
      '弦线查询数': 1,
      '宽相位候选数': 0,
      '零候选查询数': 1,
      'Y轴高度拒绝': 0,
      '最终重叠命中': 0,
    })]);
  });
});
