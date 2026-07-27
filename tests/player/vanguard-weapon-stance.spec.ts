import { describe, expect, it } from 'vitest';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import { getVanguardWeaponStance } from '../../assets/player/vanguard/animation/vanguard-weapon-stance';
import { writeVanguardWeaponSockets } from '../../assets/player/vanguard/animation/vanguard-weapon-socket-pose';
import { writeVanguardWeaponRigPose } from '../../assets/player/vanguard/animation/vanguard-weapon-rig-output';
import {
  createVanguardTwoHandWeaponTrajectoryPose,
  writeVanguardTwoHandWeaponTrajectory,
} from '../../assets/player/vanguard/animation/vanguard-two-hand-weapon-trajectory';
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
  it('双手重武器声明双臂能力与两个不同握点', () => {
    const stance = getVanguardWeaponStance(VanguardWeaponPose.TwoHandHeavy);
    const rig = getVanguardWeaponRigProfile(VanguardWeaponPose.TwoHandHeavy);
    expect(stance.leftInfluence).toBe(1);
    expect(stance.rightInfluence).toBe(1);
    expect(rig.sockets[VanguardWeaponRigSocket.MainGrip]).not.toEqual(
      rig.sockets[VanguardWeaponRigSocket.SupportGrip],
    );
  });

  it('Idle 时右手贴合主握点，左手保持自然姿态', () => {
    const { state, animation } = createEquippedState();
    const natural = createUnarmedState();
    advance(animation, state, 60);
    advance(natural.animation, natural.state, 60);
    const hands = createHands();
    const naturalHands = createHands();
    const rig = createRig();
    writeVanguardWeaponSockets(state, 0, hands);
    writeVanguardWeaponSockets(natural.state, 0, naturalHands);
    writeVanguardWeaponRigPose(state, 0, rig);
    expect(distance(
      hands.rightX, hands.rightY, hands.rightZ,
      rig.mainGripX, rig.mainGripY, rig.mainGripZ,
    )).toBeLessThan(0.001);
    expect(distance(
      hands.leftX, hands.leftY, hands.leftZ,
      naturalHands.leftX, naturalHands.leftY, naturalHands.leftZ,
    )).toBeLessThan(0.08);
    expect(distance(
      hands.leftX, hands.leftY, hands.leftZ,
      rig.supportGripX, rig.supportGripY, rig.supportGripZ,
    )).toBeGreaterThan(0.25);
  });

  it('Windup 结束前左手平滑贴合副握点', () => {
    const { state, animation } = createEquippedState();
    advance(animation, state, 40);
    state.data.intent.weaponAction[0] = VanguardWeaponAction.WindupLeft;
    state.data.intent.weaponActionProgress[0] = 1;
    state.data.intent.weaponActionSide[0] = -1;
    advance(animation, state, 24);
    const hands = createHands();
    const rig = createRig();
    writeVanguardWeaponSockets(state, 0, hands);
    writeVanguardWeaponRigPose(state, 0, rig);
    expect(distance(
      hands.leftX, hands.leftY, hands.leftZ,
      rig.supportGripX, rig.supportGripY, rig.supportGripZ,
    )).toBeLessThan(0.01);
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
    expect(swingLeft).toBeGreaterThan(0.3);
    expect(swingRight).toBeGreaterThan(0.3);
    expect(Math.abs(swingLeft - idleLeft)).toBeGreaterThan(0.04);
    expect(Math.abs(swingRight - idleRight)).toBeGreaterThan(0.04);
  });

  it('普通横扫接触阶段双手和锤头保持在身体前方与骨盆上方', () => {
    const pose = createVanguardTwoHandWeaponTrajectoryPose();
    writeVanguardTwoHandWeaponTrajectory(
      pose,
      VanguardWeaponAction.SwingLeft,
      0.5,
      -1,
      0,
    );
    const gripSpacing = 0.75 * 0.45;
    const hammerHeadDistance = 3.08 * 0.45;
    expect(pose.mainGripZ).toBeGreaterThan(0.6);
    expect(pose.mainGripZ + pose.shaftZ * gripSpacing).toBeGreaterThan(0.6);
    expect(pose.mainGripZ + pose.shaftZ * hammerHeadDistance).toBeGreaterThan(1.8);
    expect(pose.mainGripY + pose.shaftY * hammerHeadDistance).toBeGreaterThan(1.45);
  });

  it('横扫期间双肘维持在身体左右外侧', () => {
    const { state, animation } = createEquippedState();
    state.data.intent.weaponAction[0] = VanguardWeaponAction.SwingLeft;
    state.data.intent.weaponActionProgress[0] = 0.5;
    state.data.intent.weaponActionSide[0] = -1;
    advance(animation, state, 30);
    const leftElbow = readBonePosition(state, VanguardBone.LeftForearm);
    const rightElbow = readBonePosition(state, VanguardBone.RightForearm);
    const leftWrist = readBonePosition(state, VanguardBone.LeftHand);
    const rightWrist = readBonePosition(state, VanguardBone.RightHand);
    expect(leftElbow[0]).toBeLessThan(-0.55);
    expect(rightElbow[0]).toBeGreaterThan(0.55);
    expect(planarDistanceSquaredToSegment(
      0, 0,
      leftElbow[0] ?? 0, leftElbow[2] ?? 0,
      leftWrist[0] ?? 0, leftWrist[2] ?? 0,
    )).toBeGreaterThan(0.3 * 0.3);
    expect(planarDistanceSquaredToSegment(
      0, 0,
      rightElbow[0] ?? 0, rightElbow[2] ?? 0,
      rightWrist[0] ?? 0, rightWrist[2] ?? 0,
    )).toBeGreaterThan(0.3 * 0.3);
  });

  it('蓄力、挥动与恢复边界的位置和速度连续', () => {
    const windupEnd = createVanguardTwoHandWeaponTrajectoryPose();
    const swingStart = createVanguardTwoHandWeaponTrajectoryPose();
    const swingEnd = createVanguardTwoHandWeaponTrajectoryPose();
    const recoverStart = createVanguardTwoHandWeaponTrajectoryPose();
    writeVanguardTwoHandWeaponTrajectory(
      windupEnd,
      VanguardWeaponAction.WindupLeft,
      1,
      -1,
      0,
    );
    writeVanguardTwoHandWeaponTrajectory(
      swingStart,
      VanguardWeaponAction.SwingLeft,
      0,
      -1,
      0,
    );
    writeVanguardTwoHandWeaponTrajectory(
      swingEnd,
      VanguardWeaponAction.SwingLeft,
      1,
      -1,
      0,
    );
    writeVanguardTwoHandWeaponTrajectory(
      recoverStart,
      VanguardWeaponAction.Recover,
      0,
      -1,
      0,
    );
    expectTrajectoryClose(windupEnd, swingStart);
    expectTrajectoryClose(swingEnd, recoverStart);
    expectBoundaryVelocityContinuous(
      VanguardWeaponAction.WindupLeft,
      VanguardWeaponAction.SwingLeft,
      -1,
      0.28,
      0.34,
    );
    expectBoundaryVelocityContinuous(
      VanguardWeaponAction.SwingLeft,
      VanguardWeaponAction.Recover,
      -1,
      0.34,
      0.1,
    );
  });

  it('左右连段通过准备段共享端点与非零切线', () => {
    expectBoundaryVelocityContinuous(
      VanguardWeaponAction.SwingLeft,
      VanguardWeaponAction.ChainPrepareRight,
      -1,
      0.34,
      0.12,
      true,
    );
    expectBoundaryVelocityContinuous(
      VanguardWeaponAction.ChainPrepareRight,
      VanguardWeaponAction.SwingRight,
      1,
      0.12,
      0.34,
      true,
    );
    expectBoundaryVelocityContinuous(
      VanguardWeaponAction.SwingRight,
      VanguardWeaponAction.ChainPrepareLeft,
      1,
      0.34,
      0.12,
      true,
    );
  });

  it('旋风中段锤杆保持角色局部固定，不再叠加第二个三圈旋转', () => {
    const early = createVanguardTwoHandWeaponTrajectoryPose();
    const middle = createVanguardTwoHandWeaponTrajectoryPose();
    const late = createVanguardTwoHandWeaponTrajectoryPose();
    writeVanguardTwoHandWeaponTrajectory(early, VanguardWeaponAction.Spin, 0.2, 0, 0);
    writeVanguardTwoHandWeaponTrajectory(middle, VanguardWeaponAction.Spin, 0.5, 0, 0);
    writeVanguardTwoHandWeaponTrajectory(late, VanguardWeaponAction.Spin, 0.8, 0, 0);
    expectTrajectoryClose(early, middle);
    expectTrajectoryClose(middle, late);
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

function createUnarmedState(): { state: VanguardState; animation: VanguardAnimationSystem } {
  const state = new VanguardState(TEST_OPTIONS);
  const animation = new VanguardAnimationSystem();
  animation.initialize(state);
  return { state, animation };
}

function createHands() {
  return {
    leftX: 0,
    leftY: 0,
    leftZ: 0,
    rightX: 0,
    rightY: 0,
    rightZ: 0,
  };
}

function createRig() {
  return {
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

function planarDistanceSquaredToSegment(
  pointX: number,
  pointZ: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
): number {
  const segmentX = endX - startX;
  const segmentZ = endZ - startZ;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  const progress = lengthSquared <= 0.000001
    ? 0
    : Math.max(0, Math.min(1,
      ((pointX - startX) * segmentX + (pointZ - startZ) * segmentZ) / lengthSquared));
  const deltaX = pointX - (startX + segmentX * progress);
  const deltaZ = pointZ - (startZ + segmentZ * progress);
  return deltaX * deltaX + deltaZ * deltaZ;
}

function expectTrajectoryClose(
  first: ReturnType<typeof createVanguardTwoHandWeaponTrajectoryPose>,
  second: ReturnType<typeof createVanguardTwoHandWeaponTrajectoryPose>,
): void {
  for (const key of ['mainGripX', 'mainGripY', 'mainGripZ', 'shaftX', 'shaftY', 'shaftZ'] as const) {
    expect(first[key]).toBeCloseTo(second[key], 12);
  }
}

function expectBoundaryVelocityContinuous(
  firstAction: VanguardWeaponAction,
  secondAction: VanguardWeaponAction,
  side: -1 | 1,
  firstDuration: number,
  secondDuration: number,
  requireMotion = false,
): void {
  const step = 0.00001;
  const firstBefore = createVanguardTwoHandWeaponTrajectoryPose();
  const boundary = createVanguardTwoHandWeaponTrajectoryPose();
  const secondAfter = createVanguardTwoHandWeaponTrajectoryPose();
  writeVanguardTwoHandWeaponTrajectory(firstBefore, firstAction, 1 - step, side, 0);
  writeVanguardTwoHandWeaponTrajectory(boundary, firstAction, 1, side, 0);
  writeVanguardTwoHandWeaponTrajectory(secondAfter, secondAction, step, side, 0);
  for (const key of ['mainGripX', 'mainGripY', 'mainGripZ', 'shaftX', 'shaftY', 'shaftZ'] as const) {
    const incoming = (boundary[key] - firstBefore[key]) / (step * firstDuration);
    const outgoing = (secondAfter[key] - boundary[key]) / (step * secondDuration);
    expect(incoming).toBeCloseTo(outgoing, 3);
  }
  if (requireMotion) {
    const speed = Math.hypot(
      (boundary.mainGripX - firstBefore.mainGripX) / (step * firstDuration),
      (boundary.mainGripY - firstBefore.mainGripY) / (step * firstDuration),
      (boundary.mainGripZ - firstBefore.mainGripZ) / (step * firstDuration),
      (boundary.shaftX - firstBefore.shaftX) / (step * firstDuration),
      (boundary.shaftY - firstBefore.shaftY) / (step * firstDuration),
      (boundary.shaftZ - firstBefore.shaftZ) / (step * firstDuration),
    );
    expect(speed).toBeGreaterThan(0.1);
  }
}
