import { describe, expect, it } from 'vitest';
import { VanguardPoseInertializer } from '../../assets/player/vanguard/animation/vanguard-pose-inertializer';
import { VanguardPosePipeline } from '../../assets/player/vanguard/animation/vanguard-pose-pipeline';
import { VanguardRecoilSpring } from '../../assets/player/vanguard/animation/vanguard-recoil-spring';
import { writeVanguardWeaponRigPose } from '../../assets/player/vanguard/animation/vanguard-weapon-rig-output';
import { writeVanguardWeaponSockets } from '../../assets/player/vanguard/animation/vanguard-weapon-socket-pose';
import { VanguardWeaponPoseLayer } from '../../assets/player/vanguard/animation/vanguard-weapon-pose-layer';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../../assets/player/vanguard/model/vanguard-bone';
import { VANGUARD_CONFIG } from '../../assets/player/vanguard/model/vanguard-config';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import { VanguardWeaponAction } from '../../assets/player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../assets/player/vanguard/model/vanguard-weapon-pose';
import { getVanguardWeaponRigProfile } from '../../assets/player/vanguard/model/vanguard-weapon-rig';
import {
  VANGUARD_QUATERNION_COMPONENTS,
  writeAxisAngleQuaternion,
} from '../../assets/player/vanguard/rigging/vanguard-pose-math';
import {
  VANGUARD_LOCAL_POSITION_COMPONENTS,
  writeVanguardBindLocalPose,
} from '../../assets/player/vanguard/rigging/vanguard-rig';

const TEST_OPTIONS = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  heading: 0,
  action: VanguardAction.Idle,
});

describe('主角局部 Pose Pipeline', () => {
  it('支撑期锁住脚踝世界位置，角色根继续前移时不会带着脚掌滑动', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const pipeline = new VanguardPosePipeline();
    state.data.animation.locomotionBlend[0] = 1;
    state.data.animation.locomotionPhase[0] = Math.PI * 2 * 0.18;
    state.data.motion.velocityZ[0] = VANGUARD_CONFIG.maximumMoveSpeed;
    state.data.motion.speed[0] = VANGUARD_CONFIG.maximumMoveSpeed;
    pipeline.initialize(state);
    for (let frame = 0; frame < 18; frame++) {
      pipeline.update(state, 1 / 60);
    }
    const beforeContact = createContactState();
    pipeline.writeFootContactState(true, beforeContact);
    const footOffset = VanguardBone.LeftFoot * VANGUARD_BONE_MATRIX_COMPONENTS;
    const beforeFootX = state.data.pose.boneMatrices[footOffset + 9] ?? 0;
    const beforeFootZ = state.data.pose.boneMatrices[footOffset + 11] ?? 0;

    state.data.transform.z[0] = (state.data.transform.z[0] ?? 0) + 0.18;
    pipeline.update(state, 1 / 60);
    const afterContact = createContactState();
    pipeline.writeFootContactState(true, afterContact);
    const afterFootX = state.data.pose.boneMatrices[footOffset + 9] ?? 0;
    const afterFootZ = state.data.pose.boneMatrices[footOffset + 11] ?? 0;

    expect(beforeContact.locked).toBe(true);
    expect(beforeContact.contactWeight).toBeGreaterThan(0.95);
    expect(afterContact.worldX).toBeCloseTo(beforeContact.worldX, 6);
    expect(afterContact.worldZ).toBeCloseTo(beforeContact.worldZ, 6);
    expect(afterFootX).toBeCloseTo(beforeFootX, 2);
    expect(afterFootZ).toBeCloseTo(beforeFootZ, 2);
  });

  it('局部四元数惯性化保留角速度，并在短帧中连续追踪而非瞬间跳变', () => {
    const positions = new Float64Array(
      VanguardBone.Count * VANGUARD_LOCAL_POSITION_COMPONENTS,
    );
    const rotations = new Float64Array(
      VanguardBone.Count * VANGUARD_QUATERNION_COMPONENTS,
    );
    writeVanguardBindLocalPose(positions, rotations, 0);
    const targetPositions = positions.slice();
    const targetRotations = rotations.slice();
    const outputPositions = new Float32Array(positions.length);
    const outputRotations = new Float32Array(rotations.length);
    const inertializer = new VanguardPoseInertializer();
    inertializer.initialize(positions, rotations, outputPositions, outputRotations);
    const headOffset = VanguardBone.Head * VANGUARD_QUATERNION_COMPONENTS;
    writeAxisAngleQuaternion(targetRotations, headOffset, 0, 1, 0, 1);

    inertializer.update(
      targetPositions,
      targetRotations,
      outputPositions,
      outputRotations,
      1 / 60,
    );
    expect(outputRotations[headOffset + 1]).toBeGreaterThan(0);
    expect(outputRotations[headOffset + 1]).toBeLessThan(targetRotations[headOffset + 1] ?? 1);
    for (let frame = 0; frame < 120; frame++) {
      inertializer.update(
        targetPositions,
        targetRotations,
        outputPositions,
        outputRotations,
        1 / 60,
      );
    }
    expect(outputRotations[headOffset + 1]).toBeCloseTo(
      targetRotations[headOffset + 1] ?? 0,
      4,
    );
    expect(Math.hypot(
      outputRotations[headOffset] ?? 0,
      outputRotations[headOffset + 1] ?? 0,
      outputRotations[headOffset + 2] ?? 0,
      outputRotations[headOffset + 3] ?? 0,
    )).toBeCloseTo(1, 5);
  });

  it('实际加速度同时传到 VisualRoot、胸腔和有重量的武器根', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const pipeline = new VanguardPosePipeline();
    state.data.animation.locomotionBlend[0] = 1;
    state.data.animation.weaponPose[0] = VanguardWeaponPose.Shotgun;
    state.data.animation.weaponStanceBlend[0] = 1;
    state.data.intent.weaponPose[0] = VanguardWeaponPose.Shotgun;
    pipeline.initialize(state);
    const visualOffset = VanguardBone.VisualRoot * VANGUARD_QUATERNION_COMPONENTS;
    const chestOffset = VanguardBone.Chest * VANGUARD_QUATERNION_COMPONENTS;
    const weaponPositionOffset = VanguardBone.WeaponAimRoot
      * VANGUARD_LOCAL_POSITION_COMPONENTS;
    const beforeVisualX = state.data.pose.localRotations[visualOffset] ?? 0;
    const beforeChestX = state.data.pose.localRotations[chestOffset] ?? 0;
    const beforeWeaponZ = state.data.pose.localPositions[weaponPositionOffset + 2] ?? 0;

    state.data.motion.velocityZ[0] = VANGUARD_CONFIG.maximumMoveSpeed;
    state.data.motion.speed[0] = VANGUARD_CONFIG.maximumMoveSpeed;
    pipeline.update(state, 1 / 60);

    expect(Math.abs((state.data.pose.localRotations[visualOffset] ?? 0) - beforeVisualX))
      .toBeGreaterThan(0.0001);
    expect(Math.abs((state.data.pose.localRotations[chestOffset] ?? 0) - beforeChestX))
      .toBeGreaterThan(0.0001);
    expect(state.data.pose.localPositions[weaponPositionOffset + 2] ?? 0)
      .toBeLessThan(beforeWeaponZ);
  });

  it('霰弹枪泵把、弹仓轨迹和左手握把所有权由独立武器 Rig 配置驱动', () => {
    const layer = new VanguardWeaponPoseLayer();
    const positions = new Float64Array(
      VanguardBone.Count * VANGUARD_LOCAL_POSITION_COMPONENTS,
    );
    const rotations = new Float64Array(
      VanguardBone.Count * VANGUARD_QUATERNION_COMPONENTS,
    );
    writeVanguardBindLocalPose(positions, rotations, 0);
    layer.writeTargetPose(
      positions,
      rotations,
      VanguardWeaponPose.Shotgun,
      1,
      0,
      0,
      0,
      0,
      0,
      VanguardWeaponAction.Fire,
      0.46,
      1 / 60,
    );
    const pumpZ = layer.constraintTargets.supportLocalZ;

    writeVanguardBindLocalPose(positions, rotations, 0);
    layer.writeTargetPose(
      positions,
      rotations,
      VanguardWeaponPose.Shotgun,
      1,
      0,
      0,
      0,
      0,
      0,
      VanguardWeaponAction.Reload,
      0.5,
      1 / 60,
    );
    expect(pumpZ).toBeLessThan(0.25);
    expect(layer.constraintTargets.mainHandInfluence).toBe(1);
    expect(layer.constraintTargets.supportHandInfluence).toBe(1);
    expect(layer.constraintTargets.supportGripOwnership).toBe(0);
    expect(layer.constraintTargets.supportLocalY).toBeLessThan(-0.5);
    expect(layer.constraintTargets.supportLocalZ).toBeLessThan(0);
  });

  it('开火只向武器姿态根注入一次冲量，二阶弹簧随后稳定回零', () => {
    const spring = new VanguardRecoilSpring();
    const profile = getVanguardWeaponRigProfile(VanguardWeaponPose.Shotgun);
    spring.update(profile, VanguardWeaponAction.Ready, 0, 1 / 60);
    spring.update(profile, VanguardWeaponAction.Fire, 0.02, 1 / 60);
    expect(spring.pitchOffset).toBeGreaterThan(0);
    expect(spring.backOffset).toBeGreaterThan(0);
    for (let frame = 0; frame < 180; frame++) {
      spring.update(profile, VanguardWeaponAction.Ready, 0, 1 / 60);
    }
    expect(Math.abs(spring.pitchOffset)).toBeLessThan(0.0001);
    expect(Math.abs(spring.backOffset)).toBeLessThan(0.0001);
  });

  it('WeaponAimRoot 是枪身权威，右手追随主握把且正俯仰会把枪口抬高', () => {
    const state = new VanguardState(TEST_OPTIONS);
    const pipeline = new VanguardPosePipeline();
    state.data.intent.aiming[0] = 1;
    state.data.intent.aimX[0] = 0;
    state.data.intent.aimZ[0] = 1;
    state.data.intent.aimPitch[0] = 0.25;
    state.data.intent.weaponPose[0] = VanguardWeaponPose.Shotgun;
    state.data.animation.weaponPose[0] = VanguardWeaponPose.Shotgun;
    state.data.animation.weaponStanceBlend[0] = 1;
    pipeline.initialize(state);
    const rigPose = createWeaponRigPose();
    const handPose = createWeaponSocketPose();
    writeVanguardWeaponRigPose(state, 0, rigPose);
    writeVanguardWeaponSockets(state, 0, handPose);
    const forwardY = 2 * (
      rigPose.rotationY * rigPose.rotationZ
        - rigPose.rotationW * rigPose.rotationX
    );
    expect(Math.hypot(
      rigPose.rotationX,
      rigPose.rotationY,
      rigPose.rotationZ,
      rigPose.rotationW,
    )).toBeCloseTo(1, 5);
    expect(forwardY).toBeGreaterThan(0.15);
    expect(Math.hypot(
      handPose.rightX - rigPose.rootX,
      handPose.rightY - rigPose.rootY,
      handPose.rightZ - rigPose.rootZ,
    )).toBeLessThan(0.06);
  });
});

function createContactState() {
  return {
    contactWeight: 0,
    locked: false,
    worldX: 0,
    worldY: 0,
    worldZ: 0,
  };
}

function createWeaponRigPose() {
  return {
    rootX: 0,
    rootY: 0,
    rootZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    rotationW: 1,
    muzzleX: 0,
    muzzleY: 0,
    muzzleZ: 0,
    forwardX: 0,
    forwardY: 0,
    forwardZ: 1,
  };
}

function createWeaponSocketPose() {
  return {
    leftX: 0,
    leftY: 0,
    leftZ: 0,
    rightX: 0,
    rightY: 0,
    rightZ: 0,
  };
}
