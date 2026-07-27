import { describe, expect, it } from 'vitest';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import { getVanguardWeaponStance } from '../../assets/player/vanguard/animation/vanguard-weapon-stance';
import { writeVanguardWeaponSockets } from '../../assets/player/vanguard/animation/vanguard-weapon-socket-pose';
import { writeVanguardWeaponRigPose } from '../../assets/player/vanguard/animation/vanguard-weapon-rig-output';
import { writeVanguardTwoHandShaftDirection } from '../../assets/player/vanguard/animation/vanguard-two-hand-weapon-trajectory';
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

describe('主角双手大锤姿势', () => {
  it('双手重武器同时约束左右臂并声明两个不同握点', () => {
    const stance = getVanguardWeaponStance(VanguardWeaponPose.TwoHandHeavy);
    const rig = getVanguardWeaponRigProfile(VanguardWeaponPose.TwoHandHeavy);
    expect(stance.leftInfluence).toBe(1);
    expect(stance.rightInfluence).toBe(1);
    expect(rig.sockets[VanguardWeaponRigSocket.MainGrip]).not.toEqual(
      rig.sockets[VanguardWeaponRigSocket.SupportGrip],
    );
  });

  it('左右掌心分别贴合主副握点且误差低于阈值', () => {
    const { state, animation } = createEquippedState();
    advance(animation, state, 60);
    const hands = {
      leftX: 0,
      leftY: 0,
      leftZ: 0,
      rightX: 0,
      rightY: 0,
      rightZ: 0,
    };
    const rig = {
      rootX: 0,
      rootY: 0,
      rootZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      rotationW: 1,
      forwardX: 0,
      forwardY: 0,
      forwardZ: 1,
      mainGripX: 0,
      mainGripY: 0,
      mainGripZ: 0,
      supportGripX: 0,
      supportGripY: 0,
      supportGripZ: 0,
    };
    writeVanguardWeaponSockets(state, 0, hands);
    writeVanguardWeaponRigPose(state, 0, rig);
    expect(distance(
      hands.rightX, hands.rightY, hands.rightZ,
      rig.mainGripX, rig.mainGripY, rig.mainGripZ,
    )).toBeLessThan(0.001);
    expect(distance(
      hands.leftX, hands.leftY, hands.leftZ,
      rig.supportGripX, rig.supportGripY, rig.supportGripZ,
    )).toBeLessThan(0.001);
  });

  it('横扫过程中左右肘关节保持弯曲并产生明显角度变化', () => {
    const { state, animation } = createEquippedState();
    advance(animation, state, 60);
    const idleLeft = readElbowAngle(
      state,
      VanguardBone.LeftUpperArm,
      VanguardBone.LeftForearm,
      VanguardBone.LeftHand,
    );
    const idleRight = readElbowAngle(
      state,
      VanguardBone.RightUpperArm,
      VanguardBone.RightForearm,
      VanguardBone.RightHand,
    );
    state.data.intent.weaponAction[0] = VanguardWeaponAction.SwingLeft;
    state.data.intent.weaponActionProgress[0] = 0.58;
    state.data.intent.weaponActionSide[0] = -1;
    advance(animation, state, 12);
    const swingLeft = readElbowAngle(
      state,
      VanguardBone.LeftUpperArm,
      VanguardBone.LeftForearm,
      VanguardBone.LeftHand,
    );
    const swingRight = readElbowAngle(
      state,
      VanguardBone.RightUpperArm,
      VanguardBone.RightForearm,
      VanguardBone.RightHand,
    );
    expect(swingLeft).toBeGreaterThan(0.15);
    expect(swingRight).toBeGreaterThan(0.15);
    expect(Math.abs(swingLeft - idleLeft)).toBeGreaterThan(0.04);
    expect(Math.abs(swingRight - idleRight)).toBeGreaterThan(0.04);
  });

  it('蓄力、挥动与恢复边界使用同一条连续锤杆轨迹', () => {
    const windupEnd = new Float64Array(3);
    const swingStart = new Float64Array(3);
    const swingEnd = new Float64Array(3);
    const recoverStart = new Float64Array(3);
    writeVanguardTwoHandShaftDirection(
      windupEnd,
      VanguardWeaponAction.WindupLeft,
      1,
      -1,
      0,
    );
    writeVanguardTwoHandShaftDirection(
      swingStart,
      VanguardWeaponAction.SwingLeft,
      0,
      -1,
      0,
    );
    writeVanguardTwoHandShaftDirection(
      swingEnd,
      VanguardWeaponAction.SwingLeft,
      1,
      -1,
      0,
    );
    writeVanguardTwoHandShaftDirection(
      recoverStart,
      VanguardWeaponAction.Recover,
      0,
      -1,
      0,
    );
    expectVectorClose(windupEnd, swingStart);
    expectVectorClose(swingEnd, recoverStart);
  });

  it('左右横扫只产生小幅镜像胸腔蓄力，不再让武器根重复旋转', () => {
    const left = createEquippedState();
    left.state.data.intent.weaponAction[0] = VanguardWeaponAction.SwingLeft;
    left.state.data.intent.weaponActionProgress[0] = 0.45;
    left.state.data.intent.weaponActionSide[0] = -1;
    advance(left.animation, left.state, 16);
    const leftChestForwardX = readBoneComponent(left.state, VanguardBone.Chest, 6);

    const right = createEquippedState();
    right.state.data.intent.weaponAction[0] = VanguardWeaponAction.SwingRight;
    right.state.data.intent.weaponActionProgress[0] = 0.45;
    right.state.data.intent.weaponActionSide[0] = 1;
    advance(right.animation, right.state, 16);
    const rightChestForwardX = readBoneComponent(right.state, VanguardBone.Chest, 6);
    expect(leftChestForwardX * rightChestForwardX).toBeLessThan(0);
    expect(Math.abs(left.state.data.weaponAnimation.chestYaw[0] ?? 0)).toBeLessThan(0.55);
    expect(Math.abs(right.state.data.weaponAnimation.chestYaw[0] ?? 0)).toBeLessThan(0.55);
  });
});

function createEquippedState(): { state: VanguardState; animation: VanguardAnimationSystem } {
  const state = new VanguardState(TEST_OPTIONS);
  const animation = new VanguardAnimationSystem();
  state.data.intent.weaponPose[0] = VanguardWeaponPose.TwoHandHeavy;
  animation.initialize(state);
  return { state, animation };
}

function advance(animation: VanguardAnimationSystem, state: VanguardState, frames: number): void {
  for (let frame = 0; frame < frames; frame++) {
    animation.update(state, 1 / 60);
  }
}

function readElbowAngle(
  state: VanguardState,
  upperArm: VanguardBone,
  forearm: VanguardBone,
  hand: VanguardBone,
): number {
  const shoulder = readBonePosition(state, upperArm);
  const elbow = readBonePosition(state, forearm);
  const wrist = readBonePosition(state, hand);
  const firstX = shoulder[0] - elbow[0];
  const firstY = shoulder[1] - elbow[1];
  const firstZ = shoulder[2] - elbow[2];
  const secondX = wrist[0] - elbow[0];
  const secondY = wrist[1] - elbow[1];
  const secondZ = wrist[2] - elbow[2];
  const cosine = (
    firstX * secondX + firstY * secondY + firstZ * secondZ
  ) / Math.max(
    Math.hypot(firstX, firstY, firstZ) * Math.hypot(secondX, secondY, secondZ),
    0.000001,
  );
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}

function readBonePosition(state: VanguardState, bone: VanguardBone): readonly number[] {
  const offset = bone * VANGUARD_BONE_MATRIX_COMPONENTS;
  return [
    state.data.pose.boneMatrices[offset + 9] ?? 0,
    state.data.pose.boneMatrices[offset + 10] ?? 0,
    state.data.pose.boneMatrices[offset + 11] ?? 0,
  ];
}

function readBoneComponent(state: VanguardState, bone: VanguardBone, component: number): number {
  return state.data.pose.boneMatrices[
    bone * VANGUARD_BONE_MATRIX_COMPONENTS + component
  ] ?? 0;
}

function distance(
  firstX: number,
  firstY: number,
  firstZ: number,
  secondX: number,
  secondY: number,
  secondZ: number,
): number {
  return Math.hypot(firstX - secondX, firstY - secondY, firstZ - secondZ);
}

function expectVectorClose(first: Float64Array, second: Float64Array): void {
  for (let axis = 0; axis < 3; axis++) {
    expect(first[axis]).toBeCloseTo(second[axis] ?? 0, 12);
  }
}
