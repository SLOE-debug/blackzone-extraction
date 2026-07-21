import { describe, expect, it } from 'vitest';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import { writeVanguardWeaponSockets } from '../../assets/player/vanguard/animation/vanguard-weapon-socket-pose';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../../assets/player/vanguard/model/vanguard-bone';
import { VANGUARD_CONFIG } from '../../assets/player/vanguard/model/vanguard-config';
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

describe('主角模块化武器与跑步姿势', () => {
  it('手枪只锁定右臂，左臂仍保留自然摆动空间', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const animation = new VanguardAnimationSystem();
    animation.initialize(state);
    const matrices = state.data.pose.boneMatrices;
    const leftHandOffset = boneOffset(VanguardBone.LeftHand);
    const rightHandOffset = boneOffset(VanguardBone.RightHand);
    const relaxedLeftZ = matrices[leftHandOffset + 11] ?? 0;
    const relaxedRightZ = matrices[rightHandOffset + 11] ?? 0;

    state.data.intent.weaponPose[0] = VanguardWeaponPose.Handgun;
    animation.update(state, 0.5);

    const armedLeftZ = matrices[leftHandOffset + 11] ?? 0;
    const armedRightZ = matrices[rightHandOffset + 11] ?? 0;
    const sockets = createSocketPose();
    writeVanguardWeaponSockets(state, 0, sockets);
    expect(Math.abs(armedLeftZ - relaxedLeftZ)).toBeLessThan(0.2);
    expect(armedRightZ).toBeGreaterThan(relaxedRightZ + 0.7);
    expect(sockets.rightY).toBeGreaterThan(2.25);
    expect(sockets.rightZ).toBeGreaterThan(1);
  });

  it('满速跑步时膝盖和手肘明显偏离直线，并能叠加手枪上身姿态', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const animation = new VanguardAnimationSystem();
    state.data.motion.speed[0] = VANGUARD_CONFIG.maximumMoveSpeed;
    state.data.animation.locomotionBlend[0] = 1;
    state.data.animation.locomotionPhase[0] = Math.PI * 0.5;
    state.data.intent.weaponPose[0] = VanguardWeaponPose.Handgun;
    state.data.animation.weaponPose[0] = VanguardWeaponPose.Handgun;
    state.data.animation.weaponStanceBlend[0] = 1;
    animation.initialize(state);

    const hipZ = readBonePosition(state, VanguardBone.LeftThigh, 2);
    const kneeZ = readBonePosition(state, VanguardBone.LeftShin, 2);
    const ankleZ = readBonePosition(state, VanguardBone.LeftFoot, 2);
    const shoulderZ = readBonePosition(state, VanguardBone.LeftUpperArm, 2);
    const elbowZ = readBonePosition(state, VanguardBone.LeftForearm, 2);
    const wristZ = readBonePosition(state, VanguardBone.LeftHand, 2);
    expect(Math.abs(kneeZ - (hipZ + ankleZ) * 0.5)).toBeGreaterThan(0.18);
    expect(Math.abs(elbowZ - (shoulderZ + wristZ) * 0.5)).toBeGreaterThan(0.12);
    const sockets = createSocketPose();
    writeVanguardWeaponSockets(state, 0, sockets);
    expect(sockets.rightZ).toBeGreaterThan(1);
  });

  it('霰弹枪使用固定双手折臂，换弹时也不会由 IK 拉扯关节', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const animation = new VanguardAnimationSystem();
    state.data.intent.weaponPose[0] = VanguardWeaponPose.LongGun;
    state.data.animation.weaponPose[0] = VanguardWeaponPose.LongGun;
    state.data.animation.weaponStanceBlend[0] = 1;
    animation.initialize(state);

    const readySockets = createSocketPose();
    writeVanguardWeaponSockets(state, 0, readySockets);
    const profile = getVanguardWeaponRigProfile(VanguardWeaponPose.LongGun);
    const mainGrip = transformWeaponPoint(
      state,
      profile.sockets[VanguardWeaponRigSocket.MainGrip],
    );
    const supportGrip = transformWeaponPoint(
      state,
      profile.sockets[VanguardWeaponRigSocket.SupportGrip],
    );
    const leftElbowX = readBonePosition(state, VanguardBone.LeftForearm, 0);
    const leftWristX = readBonePosition(state, VanguardBone.LeftHand, 0);
    const rightElbowX = readBonePosition(state, VanguardBone.RightForearm, 0);
    const rightWristX = readBonePosition(state, VanguardBone.RightHand, 0);

    expect(socketDistance(readySockets, supportGrip, true)).toBeLessThan(0.004);
    expect(socketDistance(readySockets, mainGrip, false)).toBeLessThan(0.004);
    expect(leftElbowX).toBeLessThan(leftWristX - 0.3);
    expect(rightElbowX).toBeGreaterThan(rightWristX + 0.3);
    expect(readySockets.leftZ).toBeGreaterThan(1);
    expect(readySockets.rightZ).toBeGreaterThan(0.55);

    state.data.intent.weaponAction[0] = VanguardWeaponAction.Reload;
    state.data.intent.weaponActionProgress[0] = 0.5;
    animation.initialize(state);
    const reloadSockets = createSocketPose();
    writeVanguardWeaponSockets(state, 0, reloadSockets);
    expect(reloadSockets.leftX).toBeCloseTo(readySockets.leftX, 5);
    expect(reloadSockets.leftY).toBeCloseTo(readySockets.leftY, 5);
    expect(reloadSockets.leftZ).toBeCloseTo(readySockets.leftZ, 5);
    expect(reloadSockets.rightX).toBeCloseTo(readySockets.rightX, 5);
    expect(reloadSockets.rightY).toBeCloseTo(readySockets.rightY, 5);
    expect(reloadSockets.rightZ).toBeCloseTo(readySockets.rightZ, 5);
  });
});

function readBonePosition(state: VanguardState, bone: VanguardBone, axis: number): number {
  return state.data.pose.boneMatrices[boneOffset(bone) + 9 + axis] ?? 0;
}

function boneOffset(bone: VanguardBone): number {
  return bone * VANGUARD_BONE_MATRIX_COMPONENTS;
}

function createSocketPose() {
  return {
    leftX: 0,
    leftY: 0,
    leftZ: 0,
    rightX: 0,
    rightY: 0,
    rightZ: 0,
  };
}

interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function transformWeaponPoint(state: VanguardState, point: Point3): Point3 {
  const offset = boneOffset(VanguardBone.WeaponAimRoot);
  const matrices = state.data.pose.boneMatrices;
  return {
    x: (matrices[offset + 9] ?? 0) + (matrices[offset] ?? 0) * point.x
      + (matrices[offset + 3] ?? 0) * point.y + (matrices[offset + 6] ?? 0) * point.z,
    y: (matrices[offset + 10] ?? 0) + (matrices[offset + 1] ?? 0) * point.x
      + (matrices[offset + 4] ?? 0) * point.y + (matrices[offset + 7] ?? 0) * point.z,
    z: (matrices[offset + 11] ?? 0) + (matrices[offset + 2] ?? 0) * point.x
      + (matrices[offset + 5] ?? 0) * point.y + (matrices[offset + 8] ?? 0) * point.z,
  };
}

function socketDistance(
  sockets: Readonly<ReturnType<typeof createSocketPose>>,
  point: Point3,
  left: boolean,
): number {
  return Math.hypot(
    (left ? sockets.leftX : sockets.rightX) - point.x,
    (left ? sockets.leftY : sockets.rightY) - point.y,
    (left ? sockets.leftZ : sockets.rightZ) - point.z,
  );
}
