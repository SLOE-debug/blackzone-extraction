import { describe, expect, it } from 'vitest';
import { shouldFireAtLockedTarget } from '../../assets/bundles/battlefield/combat/battlefield-fire-intent';

describe('战场玩家射击许可', () => {
  it('右摇杆有方向但没有锁定目标时不批准射击', () => {
    expect(shouldFireAtLockedTarget(false, 0, 1, 0, 1)).toBe(false);
  });

  it('锁定目标后仍会等待角色完成转向', () => {
    expect(shouldFireAtLockedTarget(true, 1, 0, 0, 1)).toBe(false);
  });

  it('锁定目标且朝向对齐时批准射击', () => {
    expect(shouldFireAtLockedTarget(true, 0, 1, 0, 1)).toBe(true);
  });
});
