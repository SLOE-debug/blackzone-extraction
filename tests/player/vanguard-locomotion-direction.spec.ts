import { describe, expect, it } from 'vitest';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../../assets/player/vanguard/model/vanguard-bone';
import { type VanguardPopulationOptions } from '../../assets/player/vanguard/model/vanguard-options';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import { VANGUARD_CONFIG } from '../../assets/player/vanguard/model/vanguard-config';

const TEST_OPTIONS = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  heading: 0,
  action: VanguardAction.Idle,
}) satisfies VanguardPopulationOptions;

describe('主角二维局部步态', () => {
  it('前后移动共用连续相位，并把下一落点放到真实移动方向', () => {
    const forward = createMovingState(VANGUARD_CONFIG.maximumMoveSpeed, 0);
    const backward = createMovingState(-VANGUARD_CONFIG.maximumMoveSpeed, 0);
    forward.animation.update(forward.state, 0.1);
    backward.animation.update(backward.state, 0.1);

    expect(forward.state.data.animation.locomotionPhase[0]).toBeGreaterThan(0);
    expect(backward.state.data.animation.locomotionPhase[0]).toBeCloseTo(
      forward.state.data.animation.locomotionPhase[0] ?? 0,
      6,
    );
    expect(forward.state.data.gait.rightLandingZ[0]).toBeGreaterThan(0.7);
    expect(backward.state.data.gait.rightLandingZ[0]).toBeLessThan(-0.7);
  });

  it('向右横移时支撑脚锁定且摆动脚朝移动侧落地', () => {
    const fixture = createMovingState(0, VANGUARD_CONFIG.maximumMoveSpeed);
    fixture.animation.update(fixture.state, 0.1);
    const leftFootX = readBonePositionX(fixture.state, VanguardBone.LeftFoot);
    const rightFootX = readBonePositionX(fixture.state, VanguardBone.RightFoot);

    expect(leftFootX).toBeCloseTo(-0.36, 2);
    expect(rightFootX).toBeGreaterThan(0.6);
  });
});

function createMovingState(
  forward: number,
  right: number,
): { state: VanguardState; animation: VanguardAnimationSystem } {
  const state = new VanguardState(TEST_OPTIONS);
  const animation = new VanguardAnimationSystem();
  state.data.motion.speed[0] = Math.hypot(forward, right);
  state.data.motion.velocityX[0] = right;
  state.data.motion.velocityZ[0] = forward;
  state.data.motion.locomotionForward[0] = forward;
  state.data.motion.locomotionRight[0] = right;
  animation.initialize(state);
  return { state, animation };
}

function readBonePositionX(state: VanguardState, bone: VanguardBone): number {
  return state.data.pose.boneMatrices[
    bone * VANGUARD_BONE_MATRIX_COMPONENTS + 9
  ] ?? 0;
}
