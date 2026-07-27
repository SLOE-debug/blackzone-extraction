import { describe, expect, it } from 'vitest';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import { getVanguardWeaponStance } from '../../assets/player/vanguard/animation/vanguard-weapon-stance';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../../assets/player/vanguard/model/vanguard-bone';
import { type VanguardPopulationOptions } from '../../assets/player/vanguard/model/vanguard-options';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import { VanguardWeaponAction } from '../../assets/player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../assets/player/vanguard/model/vanguard-weapon-pose';
import {
  getVanguardWeaponRigProfile,
  VanguardWeaponRigSocket,
} from '../../assets/player/vanguard/model/vanguard-weapon-rig';

const TEST_OPTIONS = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  heading: 0,
  action: VanguardAction.Idle,
}) satisfies VanguardPopulationOptions;

describe('主角单手大锤姿势', () => {
  it('单手重武器只约束右臂并保留左臂移动摆动', () => {
    const stance = getVanguardWeaponStance(VanguardWeaponPose.OneHandHeavy);
    expect(stance.leftInfluence).toBe(0);
    expect(stance.rightInfluence).toBe(1);
    expect(stance.rightHand.shoulderDrop).toBeGreaterThan(1.3);
  });

  it('横扫动作把右手明显送向前方而不改写左手姿态', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const animation = new VanguardAnimationSystem();
    state.data.intent.weaponPose[0] = VanguardWeaponPose.OneHandHeavy;
    state.data.animation.weaponPose[0] = VanguardWeaponPose.OneHandHeavy;
    state.data.animation.weaponStanceBlend[0] = 1;
    animation.initialize(state);
    const idleRightZ = readBonePosition(state, VanguardBone.RightHand, 2);
    const idleLeftZ = readBonePosition(state, VanguardBone.LeftHand, 2);

    state.data.intent.weaponAction[0] = VanguardWeaponAction.SwingLeft;
    state.data.intent.weaponActionProgress[0] = 0.35;
    animation.initialize(state);

    expect(readBonePosition(state, VanguardBone.RightHand, 2)).toBeGreaterThan(
      idleRightZ + 0.45,
    );
    expect(readBonePosition(state, VanguardBone.LeftHand, 2)).toBeCloseTo(idleLeftZ, 6);
  });

  it('大锤武器根使用右掌主握持挂点', () => {
    const profile = getVanguardWeaponRigProfile(VanguardWeaponPose.OneHandHeavy);
    expect(profile.pose).toBe(VanguardWeaponPose.OneHandHeavy);
    expect(profile.sockets[VanguardWeaponRigSocket.MainGrip]).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('左右横扫把符号方向传到胸腔和右手而不是压成同一姿态', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const animation = new VanguardAnimationSystem();
    state.data.intent.weaponPose[0] = VanguardWeaponPose.OneHandHeavy;
    state.data.animation.weaponPose[0] = VanguardWeaponPose.OneHandHeavy;
    state.data.animation.weaponStanceBlend[0] = 1;
    state.data.intent.weaponAction[0] = VanguardWeaponAction.SwingLeft;
    state.data.intent.weaponActionProgress[0] = 0.45;
    state.data.intent.weaponActionSide[0] = -1;
    animation.initialize(state);
    const leftHandX = readBonePosition(state, VanguardBone.RightHand, 0);
    const leftChestForwardX = readBoneComponent(state, VanguardBone.Chest, 6);

    state.data.intent.weaponAction[0] = VanguardWeaponAction.SwingRight;
    state.data.intent.weaponActionSide[0] = 1;
    animation.initialize(state);
    expect(readBonePosition(state, VanguardBone.RightHand, 0)).not.toBeCloseTo(leftHandX, 3);
    expect(readBoneComponent(state, VanguardBone.Chest, 6) * leftChestForwardX).toBeLessThan(0);
  });
});

function readBonePosition(state: VanguardState, bone: VanguardBone, axis: number): number {
  return state.data.pose.boneMatrices[
    bone * VANGUARD_BONE_MATRIX_COMPONENTS + 9 + axis
  ] ?? 0;
}

function readBoneComponent(state: VanguardState, bone: VanguardBone, component: number): number {
  return state.data.pose.boneMatrices[
    bone * VANGUARD_BONE_MATRIX_COMPONENTS + component
  ] ?? 0;
}
