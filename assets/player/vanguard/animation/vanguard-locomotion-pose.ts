import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import { VanguardBone } from '../model/vanguard-bone';
import {
  multiplyQuaternionComponents,
  VANGUARD_QUATERNION_COMPONENTS,
  writeYawPitchRollQuaternion,
} from '../rigging/vanguard-pose-math';
import {
  VANGUARD_BIND_LOCAL_POSITIONS,
  VANGUARD_BIND_LOCAL_ROTATIONS,
  VANGUARD_LOCAL_POSITION_COMPONENTS,
} from '../rigging/vanguard-rig';
import {
  sampleVanguardRunArmDrive,
  sampleVanguardRunContactWeight,
  sampleVanguardRunFlightAmount,
  sampleVanguardRunFootPitch,
  sampleVanguardRunHipAngle,
  sampleVanguardRunKneeFlexion,
  VANGUARD_RUN_RIGHT_PHASE_OFFSET,
} from './vanguard-run-cycle';

const UPPER_LEG_LENGTH = 0.78;
const LOWER_LEG_LENGTH = 0.73;
const UPPER_ARM_LENGTH = 0.69;
const FOREARM_LENGTH = 0.54;

/** 基础移动层接收的归一化运动、瞄准和惯性输入。 */
export interface VanguardLocomotionPoseInput {
  readonly idlePhase: number;
  readonly locomotionPhase: number;
  readonly locomotionBlend: number;
  readonly movementRight: number;
  readonly movementForward: number;
  readonly accelerationRight: number;
  readonly accelerationForward: number;
  readonly aimYaw: number;
  readonly aimPitch: number;
}

/** IK 阶段复用的角色模型空间四肢目标。 */
export interface MutableVanguardLimbTargets {
  leftAnkleX: number;
  leftAnkleY: number;
  leftAnkleZ: number;
  leftKneeX: number;
  leftKneeY: number;
  leftKneeZ: number;
  leftFootPitch: number;
  leftContactWeight: number;
  rightAnkleX: number;
  rightAnkleY: number;
  rightAnkleZ: number;
  rightKneeX: number;
  rightKneeY: number;
  rightKneeZ: number;
  rightFootPitch: number;
  rightContactWeight: number;
  leftWristX: number;
  leftWristY: number;
  leftWristZ: number;
  leftElbowX: number;
  leftElbowY: number;
  leftElbowZ: number;
  rightWristX: number;
  rightWristY: number;
  rightWristZ: number;
  rightElbowX: number;
  rightElbowY: number;
  rightElbowZ: number;
}

/** 生成肩胯联动、加速度倾斜以及四肢约束目标的基础局部 Pose。 */
export class VanguardLocomotionPose {
  private readonly additiveRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  public readonly limbTargets: MutableVanguardLimbTargets = createLimbTargets();

  public write(
    targetPositions: Float64Array,
    targetRotations: Float64Array,
    input: Readonly<VanguardLocomotionPoseInput>,
  ): void {
    this.resetToBindPose(targetPositions, targetRotations);
    const locomotion = clamp01(input.locomotionBlend);
    const idleWeight = 1 - locomotion;
    const leftContact = sampleVanguardRunContactWeight(input.locomotionPhase) * locomotion;
    const rightPhase = input.locomotionPhase + VANGUARD_RUN_RIGHT_PHASE_OFFSET;
    const rightContact = sampleVanguardRunContactWeight(rightPhase) * locomotion;
    const supportBalance = rightContact - leftContact;
    const gaitDrive = sampleVanguardRunArmDrive(input.locomotionPhase);
    const delayedGaitDrive = sampleVanguardRunArmDrive(input.locomotionPhase - 0.16);
    const flight = sampleVanguardRunFlightAmount(input.locomotionPhase) * locomotion;
    const breath = Math.sin(input.idlePhase * 2) * 0.012 * idleWeight;
    const shrugWave = Math.max(0, -Math.sin(input.idlePhase));
    const shoulderShrug = shrugWave * shrugWave * shrugWave * shrugWave
      * 0.04
      * idleWeight;
    const pelvisBob = locomotion * (0.012 + flight * 0.024);
    const pelvisShift = supportBalance * 0.045;
    const accelerationPitch = clampSigned(input.accelerationForward) * 0.095;
    const accelerationRoll = clampSigned(input.accelerationRight) * 0.085;
    const directionLean = Math.max(-0.04, input.movementForward * 0.055) * locomotion;
    const pelvisYaw = gaitDrive * 0.095 * locomotion;
    const chestYaw = -delayedGaitDrive * 0.13 * locomotion;

    this.addBonePosition(
      targetPositions,
      VanguardBone.Pelvis,
      pelvisShift,
      pelvisBob,
      0,
    );
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.VisualRoot,
      input.aimYaw * 0.08,
      accelerationPitch * 0.42,
      accelerationRoll * 0.38,
    );
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.Pelvis,
      pelvisYaw + input.aimYaw * 0.08,
      directionLean * 0.16,
      -pelvisShift * 0.48 + accelerationRoll * 0.2,
    );
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.SpineLower,
      chestYaw * 0.34 + input.aimYaw * 0.18,
      directionLean * 0.52 + accelerationPitch * 0.3,
      accelerationRoll * 0.24,
    );
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.Chest,
      chestYaw + input.aimYaw * 0.42,
      directionLean * 0.52 + accelerationPitch * 0.28 - input.aimPitch * 0.52,
      accelerationRoll * 0.28 + supportBalance * 0.018,
    );
    this.addBonePosition(targetPositions, VanguardBone.Chest, 0, breath, 0);
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.Neck,
      input.aimYaw * 0.12,
      -input.aimPitch * 0.2 - directionLean * 0.12,
      -accelerationRoll * 0.08,
    );
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.Head,
      input.aimYaw * 0.12 + Math.sin(input.idlePhase) * 0.12 * idleWeight,
      -input.aimPitch * 0.18 - directionLean * 0.18,
      -supportBalance * 0.01,
    );
    this.addBonePosition(targetPositions, VanguardBone.LeftClavicle, 0, shoulderShrug, 0);
    this.addBonePosition(targetPositions, VanguardBone.RightClavicle, 0, shoulderShrug, 0);
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.LeftClavicle,
      -chestYaw * 0.16,
      -gaitDrive * 0.035 * locomotion,
      -0.025 * locomotion,
    );
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.RightClavicle,
      -chestYaw * 0.16,
      gaitDrive * 0.035 * locomotion,
      0.025 * locomotion,
    );

    this.writeLegTargets(
      input.locomotionPhase,
      -1,
      pelvisShift,
      pelvisBob,
      input.movementRight,
      input.movementForward,
      locomotion,
    );
    this.writeLegTargets(
      rightPhase,
      1,
      pelvisShift,
      pelvisBob,
      input.movementRight,
      input.movementForward,
      locomotion,
    );
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.LeftToe,
      0,
      Math.max(0, -this.limbTargets.leftFootPitch) * 0.32,
      0,
    );
    this.writeBoneRotation(
      targetRotations,
      VanguardBone.RightToe,
      0,
      Math.max(0, -this.limbTargets.rightFootPitch) * 0.32,
      0,
    );
    this.writeArmTargets(input, pelvisShift, pelvisBob, breath);
  }

  private writeLegTargets(
    phase: number,
    side: -1 | 1,
    pelvisShift: number,
    pelvisBob: number,
    movementRight: number,
    movementForward: number,
    locomotion: number,
  ): void {
    const directionLength = Math.max(Math.hypot(movementRight, movementForward), 0.000001);
    const directionRight = movementRight / directionLength;
    const directionForward = movementForward / directionLength;
    const hipX = side * VANGUARD_ANATOMY.hipHalfWidth + pelvisShift;
    const hipY = VANGUARD_ANATOMY.pelvisY + pelvisBob;
    const hipAngle = sampleVanguardRunHipAngle(phase) * locomotion * 0.88;
    const kneeFlexion = lerp(0.08, sampleVanguardRunKneeFlexion(phase), locomotion);
    const kneeDistance = Math.sin(hipAngle) * UPPER_LEG_LENGTH;
    const kneeX = hipX + directionRight * kneeDistance;
    const kneeY = hipY - Math.cos(hipAngle) * UPPER_LEG_LENGTH;
    const kneeZ = directionForward * kneeDistance;
    const shinAngle = hipAngle - kneeFlexion;
    const ankleDistance = Math.sin(shinAngle) * LOWER_LEG_LENGTH;
    const ankleX = kneeX + directionRight * ankleDistance;
    const ankleY = kneeY - Math.cos(shinAngle) * LOWER_LEG_LENGTH;
    const ankleZ = kneeZ + directionForward * ankleDistance;
    const targets = this.limbTargets;
    if (side < 0) {
      targets.leftAnkleX = ankleX;
      targets.leftAnkleY = ankleY;
      targets.leftAnkleZ = ankleZ;
      targets.leftKneeX = kneeX;
      targets.leftKneeY = kneeY;
      targets.leftKneeZ = kneeZ + directionForward * 0.45;
      targets.leftFootPitch = sampleVanguardRunFootPitch(phase) * locomotion;
      targets.leftContactWeight = sampleVanguardRunContactWeight(phase) * locomotion;
      return;
    }
    targets.rightAnkleX = ankleX;
    targets.rightAnkleY = ankleY;
    targets.rightAnkleZ = ankleZ;
    targets.rightKneeX = kneeX;
    targets.rightKneeY = kneeY;
    targets.rightKneeZ = kneeZ + directionForward * 0.45;
    targets.rightFootPitch = sampleVanguardRunFootPitch(phase) * locomotion;
    targets.rightContactWeight = sampleVanguardRunContactWeight(phase) * locomotion;
  }

  private writeArmTargets(
    input: Readonly<VanguardLocomotionPoseInput>,
    pelvisShift: number,
    pelvisBob: number,
    breath: number,
  ): void {
    const locomotion = clamp01(input.locomotionBlend);
    const leftDrive = sampleVanguardRunArmDrive(input.locomotionPhase);
    const rightDrive = sampleVanguardRunArmDrive(
      input.locomotionPhase + VANGUARD_RUN_RIGHT_PHASE_OFFSET,
    );
    this.writeArmTarget(-1, leftDrive, locomotion, pelvisShift, pelvisBob, breath);
    this.writeArmTarget(1, rightDrive, locomotion, pelvisShift, pelvisBob, breath);
  }

  private writeArmTarget(
    side: -1 | 1,
    drive: number,
    locomotion: number,
    pelvisShift: number,
    pelvisBob: number,
    breath: number,
  ): void {
    const shoulderX = side * VANGUARD_ANATOMY.shoulderHalfWidth + pelvisShift * 0.22;
    const shoulderY = VANGUARD_ANATOMY.shoulderY + pelvisBob + breath * 0.5;
    const upperAngle = -drive * 0.42 * locomotion;
    const elbowFlex = 0.18 + locomotion * (0.48 + Math.max(0, -drive) * 0.18);
    const elbowX = shoulderX + side * 0.09;
    const elbowY = shoulderY - Math.cos(upperAngle) * UPPER_ARM_LENGTH;
    const elbowZ = Math.sin(upperAngle) * UPPER_ARM_LENGTH;
    const forearmAngle = upperAngle + elbowFlex;
    const wristX = elbowX - side * 0.055;
    const wristY = elbowY - Math.cos(forearmAngle) * FOREARM_LENGTH;
    const wristZ = elbowZ + Math.sin(forearmAngle) * FOREARM_LENGTH;
    const targets = this.limbTargets;
    if (side < 0) {
      targets.leftElbowX = elbowX;
      targets.leftElbowY = elbowY;
      targets.leftElbowZ = elbowZ + 0.28;
      targets.leftWristX = wristX;
      targets.leftWristY = wristY;
      targets.leftWristZ = wristZ;
      return;
    }
    targets.rightElbowX = elbowX;
    targets.rightElbowY = elbowY;
    targets.rightElbowZ = elbowZ + 0.28;
    targets.rightWristX = wristX;
    targets.rightWristY = wristY;
    targets.rightWristZ = wristZ;
  }

  private writeBoneRotation(
    rotations: Float64Array,
    bone: VanguardBone,
    yaw: number,
    pitch: number,
    roll: number,
  ): void {
    const offset = bone * VANGUARD_QUATERNION_COMPONENTS;
    writeYawPitchRollQuaternion(this.additiveRotation, 0, yaw, pitch, roll);
    multiplyQuaternionComponents(
      rotations,
      offset,
      VANGUARD_BIND_LOCAL_ROTATIONS[offset] ?? 0,
      VANGUARD_BIND_LOCAL_ROTATIONS[offset + 1] ?? 0,
      VANGUARD_BIND_LOCAL_ROTATIONS[offset + 2] ?? 0,
      VANGUARD_BIND_LOCAL_ROTATIONS[offset + 3] ?? 1,
      this.additiveRotation[0] ?? 0,
      this.additiveRotation[1] ?? 0,
      this.additiveRotation[2] ?? 0,
      this.additiveRotation[3] ?? 1,
    );
  }

  private addBonePosition(
    positions: Float64Array,
    bone: VanguardBone,
    x: number,
    y: number,
    z: number,
  ): void {
    const offset = bone * VANGUARD_LOCAL_POSITION_COMPONENTS;
    positions[offset] = (VANGUARD_BIND_LOCAL_POSITIONS[offset] ?? 0) + x;
    positions[offset + 1] = (VANGUARD_BIND_LOCAL_POSITIONS[offset + 1] ?? 0) + y;
    positions[offset + 2] = (VANGUARD_BIND_LOCAL_POSITIONS[offset + 2] ?? 0) + z;
  }

  private resetToBindPose(positions: Float64Array, rotations: Float64Array): void {
    for (let component = 0; component < positions.length; component++) {
      positions[component] = VANGUARD_BIND_LOCAL_POSITIONS[component] ?? 0;
    }
    for (let component = 0; component < rotations.length; component++) {
      rotations[component] = VANGUARD_BIND_LOCAL_ROTATIONS[component] ?? 0;
    }
  }
}

function createLimbTargets(): MutableVanguardLimbTargets {
  return {
    leftAnkleX: 0, leftAnkleY: 0, leftAnkleZ: 0,
    leftKneeX: 0, leftKneeY: 0, leftKneeZ: 0,
    leftFootPitch: 0, leftContactWeight: 0,
    rightAnkleX: 0, rightAnkleY: 0, rightAnkleZ: 0,
    rightKneeX: 0, rightKneeY: 0, rightKneeZ: 0,
    rightFootPitch: 0, rightContactWeight: 0,
    leftWristX: 0, leftWristY: 0, leftWristZ: 0,
    leftElbowX: 0, leftElbowY: 0, leftElbowZ: 0,
    rightWristX: 0, rightWristY: 0, rightWristZ: 0,
    rightElbowX: 0, rightElbowY: 0, rightElbowZ: 0,
  };
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
