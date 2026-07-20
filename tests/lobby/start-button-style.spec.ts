import { describe, expect, it } from 'vitest';
import { LOBBY_START_BUTTON_STYLE } from '../../assets/lobby/model/lobby-start-button-style';
import { LOBBY_VANGUARD_OPTIONS } from '../../assets/lobby/model/lobby-vanguard-options';

describe('大厅开始按钮玩家吸附配置', () => {
  it('使用主角脚底世界位置作为投影锚点', () => {
    expect(LOBBY_START_BUTTON_STYLE.worldAnchor).toEqual(
      LOBBY_VANGUARD_OPTIONS.position,
    );
    expect(LOBBY_START_BUTTON_STYLE.screenOffsetY).toBe(-126);
  });
});
