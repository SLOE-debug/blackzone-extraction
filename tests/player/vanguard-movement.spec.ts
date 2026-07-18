import { describe, expect, it } from 'vitest';
import { VanguardMovementSystem } from '../../assets/player/vanguard/movement/vanguard-movement-system';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import { type VanguardPopulationOptions } from '../../assets/player/vanguard/model/vanguard-options';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';

const TEST_OPTIONS = Object.freeze({
  position: Object.freeze({ x: 0, y: 0.05, z: 0 }),
  heading: 0,
  action: VanguardAction.Idle,
}) satisfies VanguardPopulationOptions;

describe('主角第三人称双摇杆移动', () => {
  it('按加速度推进世界平面位移并自然转向移动方向', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const movement = new VanguardMovementSystem();
    state.data.intent.moveX[0] = 1;

    movement.update(state, 0.1);

    expect(state.data.transform.x[0]).toBeGreaterThan(0.25);
    expect(state.data.transform.z[0]).toBeCloseTo(0, 6);
    expect(state.data.motion.speed[0]).toBeCloseTo(3.1, 5);
    expect(state.data.transform.heading[0]).toBeGreaterThan(1);
  });

  it('瞄准生效时保持移动方向与角色朝向解耦', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const movement = new VanguardMovementSystem();
    state.data.intent.moveX[0] = 1;
    state.data.intent.aimZ[0] = -1;
    state.data.intent.aiming[0] = 1;

    movement.update(state, 0.1);

    expect(state.data.transform.x[0]).toBeGreaterThan(0);
    expect(state.data.transform.heading[0]).toBeGreaterThan(2.5);
  });

  it('不施加地图边界限制并在松开输入后快速减速', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const movement = new VanguardMovementSystem();
    state.data.intent.moveZ[0] = 1;
    for (let step = 0; step < 80; step++) {
      movement.update(state, 0.1);
    }
    expect(state.data.transform.z[0]).toBeGreaterThan(50);

    state.data.intent.moveZ[0] = 0;
    movement.update(state, 0.2);
    expect(state.data.motion.speed[0]).toBeCloseTo(0, 6);
  });
});
