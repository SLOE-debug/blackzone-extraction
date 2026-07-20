import { describe, expect, it } from 'vitest';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import { writeVanguardMainHandWeaponSocket } from '../../assets/player/vanguard/animation/vanguard-weapon-socket-pose';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../../assets/player/vanguard/model/vanguard-bone';
import { type VanguardPopulationOptions } from '../../assets/player/vanguard/model/vanguard-options';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';

const TEST_OPTIONS = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  heading: 0,
  action: VanguardAction.Idle,
}) satisfies VanguardPopulationOptions;

describe('主角持枪姿势', () => {
  it('装备武器后抬起双臂，并把主手挂点推进到胸前', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const animation = new VanguardAnimationSystem();
    animation.initialize(state);
    const rightHandOffset = VanguardBone.RightHand * VANGUARD_BONE_MATRIX_COMPONENTS;
    const relaxedHandY = state.data.pose.boneMatrices[rightHandOffset + 10] ?? 0;
    const relaxedHandZ = state.data.pose.boneMatrices[rightHandOffset + 11] ?? 0;

    state.data.intent.weaponReady[0] = 1;
    animation.update(state, 0.5);

    const armedHandY = state.data.pose.boneMatrices[rightHandOffset + 10] ?? 0;
    const armedHandZ = state.data.pose.boneMatrices[rightHandOffset + 11] ?? 0;
    const socket = { x: 0, y: 0, z: 0 };
    writeVanguardMainHandWeaponSocket(state, 0, socket);
    expect(armedHandY).toBeGreaterThan(relaxedHandY + 0.6);
    expect(armedHandZ).toBeGreaterThan(relaxedHandZ + 0.7);
    expect(socket.y).toBeGreaterThan(2.3);
    expect(socket.z).toBeGreaterThan(1);
  });
});
