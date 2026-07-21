import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_PLAYER_STATUS_STYLE } from '../../assets/bundles/battlefield/ui/battlefield-player-status-style';

describe('战场玩家生命条布局', () => {
  it('保持单行紧凑尺寸并使用居中数字所需的标签空间', () => {
    const style = BATTLEFIELD_PLAYER_STATUS_STYLE;
    expect(style.panelWidth).toBeLessThanOrEqual(120);
    expect(style.panelHeight).toBeLessThanOrEqual(22);
    expect(style.labelHeight).toBeLessThan(style.panelHeight);
    expect(style.fillInset).toBeGreaterThan(0);
  });
});
