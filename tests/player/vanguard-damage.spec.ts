import { describe, expect, it } from 'vitest';
import { VanguardDamageSystem } from '../../assets/player/vanguard/combat/vanguard-damage-system';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import {
  VANGUARD_HIT_FLASH_DURATION,
  VANGUARD_MAX_HEALTH,
  VanguardLifePhase,
} from '../../assets/player/vanguard/model/vanguard-life';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';

function createState(): VanguardState {
  return new VanguardState({
    position: { x: 0, y: 0.05, z: 0 },
    heading: 0,
    action: VanguardAction.Idle,
  });
}

describe('主角承伤系统', () => {
  it('扣减生命并把受击闪烁连续衰减到零', () => {
    const state = createState();
    const damage = new VanguardDamageSystem();

    expect(damage.damage(state, 25)).toBe(false);
    expect(state.data.vitality.health[0]).toBe(VANGUARD_MAX_HEALTH - 25);
    expect(state.data.animation.hitFlash[0]).toBe(1);

    damage.update(state, VANGUARD_HIT_FLASH_DURATION * 0.5);
    expect(state.data.animation.hitFlash[0]).toBeCloseTo(0.5);
    damage.update(state, VANGUARD_HIT_FLASH_DURATION);
    expect(state.data.animation.hitFlash[0]).toBe(0);
  });

  it('致命伤害只结算一次并切换到不可行动阶段', () => {
    const state = createState();
    const damage = new VanguardDamageSystem();

    expect(damage.damage(state, VANGUARD_MAX_HEALTH)).toBe(true);
    expect(state.data.vitality.health[0]).toBe(0);
    expect(state.data.vitality.phase[0]).toBe(VanguardLifePhase.Defeated);
    expect(damage.damage(state, 10)).toBe(false);
    expect(state.data.vitality.health[0]).toBe(0);
  });
});
