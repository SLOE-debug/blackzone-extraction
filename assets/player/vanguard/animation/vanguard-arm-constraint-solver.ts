import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../model/vanguard-bone';
import { type MutableVanguardWeaponConstraintTargets } from './vanguard-weapon-pose-layer';
import { type MutableVanguardLimbTargets } from './vanguard-locomotion-pose';
import { type VanguardRigTransform } from '../rigging/vanguard-forward-kinematics';
import { VanguardTwoBoneIkSolver } from '../rigging/vanguard-two-bone-ik';

const HAND_SOCKET_DISTANCE = 0.17;
const LEFT_ARM = 0;
const RIGHT_ARM = 1;

/** 让自然摆臂或双手握把目标统一通过两骨 IK 驱动完整肩肘腕链。 */
export class VanguardArmConstraintSolver {
  private readonly naturalWrists = new Float64Array(6);
  private readonly naturalPoles = new Float64Array(6);
  private readonly gripPositions = new Float64Array(6);
  private readonly gripDirections = new Float64Array(6);
  private readonly gripPoles = new Float64Array(6);

  constructor(private readonly ikSolver: VanguardTwoBoneIkSolver) {}

  public solve(
    localPositions: Float32Array,
    localRotations: Float32Array,
    matrices: Float32Array,
    limbTargets: Readonly<MutableVanguardLimbTargets>,
    weaponTargets: Readonly<MutableVanguardWeaponConstraintTargets>,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    this.writeNaturalTargets(limbTargets, transform);
    this.protractClavicle(
      localPositions,
      localRotations,
      matrices,
      VanguardBone.LeftClavicle,
      VanguardBone.LeftUpperArm,
      weaponTargets.supportHandInfluence,
      0.24,
      transform,
    );
    this.protractClavicle(
      localPositions,
      localRotations,
      matrices,
      VanguardBone.RightClavicle,
      VanguardBone.RightUpperArm,
      weaponTargets.mainHandInfluence,
      0.1,
      transform,
    );
    this.writeWeaponTargets(matrices, weaponTargets, transform.scale);
    this.solveArm(
      localPositions,
      localRotations,
      matrices,
      LEFT_ARM,
      VanguardBone.LeftUpperArm,
      VanguardBone.LeftForearm,
      VanguardBone.LeftHand,
      weaponTargets.supportHandInfluence,
      transform,
    );
    this.solveArm(
      localPositions,
      localRotations,
      matrices,
      RIGHT_ARM,
      VanguardBone.RightUpperArm,
      VanguardBone.RightForearm,
      VanguardBone.RightHand,
      weaponTargets.mainHandInfluence,
      transform,
    );
  }

  private protractClavicle(
    localPositions: Float32Array,
    localRotations: Float32Array,
    matrices: Float32Array,
    clavicle: VanguardBone,
    upperArm: VanguardBone,
    influence: number,
    distance: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    const clampedInfluence = clamp01(influence);
    if (clampedInfluence <= 0.0001) {
      return;
    }
    const clavicleOffset = clavicle * VANGUARD_BONE_MATRIX_COMPONENTS;
    const shoulderOffset = upperArm * VANGUARD_BONE_MATRIX_COMPONENTS;
    const weaponOffset = VanguardBone.WeaponAimRoot * VANGUARD_BONE_MATRIX_COMPONENTS;
    this.ikSolver.alignBoneYAxis(
      localPositions,
      localRotations,
      matrices,
      0,
      clavicle,
      (matrices[shoulderOffset + 9] ?? 0) - (matrices[clavicleOffset + 9] ?? 0)
        + (matrices[weaponOffset + 6] ?? 0) * distance,
      (matrices[shoulderOffset + 10] ?? 0) - (matrices[clavicleOffset + 10] ?? 0)
        + (matrices[weaponOffset + 7] ?? 0) * distance,
      (matrices[shoulderOffset + 11] ?? 0) - (matrices[clavicleOffset + 11] ?? 0)
        + (matrices[weaponOffset + 8] ?? 0) * distance,
      clampedInfluence,
      transform,
    );
  }

  private solveArm(
    localPositions: Float32Array,
    localRotations: Float32Array,
    matrices: Float32Array,
    arm: number,
    upperArm: VanguardBone,
    forearm: VanguardBone,
    hand: VanguardBone,
    weaponInfluence: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    const offset = arm * 3;
    const influence = clamp01(weaponInfluence);
    const targetX = lerp(
      this.naturalWrists[offset] ?? 0,
      (this.gripPositions[offset] ?? 0)
        - (this.gripDirections[offset] ?? 0) * HAND_SOCKET_DISTANCE * transform.scale,
      influence,
    );
    const targetY = lerp(
      this.naturalWrists[offset + 1] ?? 0,
      (this.gripPositions[offset + 1] ?? 0)
        - (this.gripDirections[offset + 1] ?? 0) * HAND_SOCKET_DISTANCE * transform.scale,
      influence,
    );
    const targetZ = lerp(
      this.naturalWrists[offset + 2] ?? 0,
      (this.gripPositions[offset + 2] ?? 0)
        - (this.gripDirections[offset + 2] ?? 1) * HAND_SOCKET_DISTANCE * transform.scale,
      influence,
    );
    this.ikSolver.solve(
      localPositions,
      localRotations,
      matrices,
      0,
      upperArm,
      forearm,
      hand,
      targetX,
      targetY,
      targetZ,
      lerp(this.naturalPoles[offset] ?? 0, this.gripPoles[offset] ?? 0, influence),
      lerp(
        this.naturalPoles[offset + 1] ?? 0,
        this.gripPoles[offset + 1] ?? 0,
        influence,
      ),
      lerp(
        this.naturalPoles[offset + 2] ?? 0,
        this.gripPoles[offset + 2] ?? 0,
        influence,
      ),
      1,
      transform,
    );
    if (influence <= 0.0001) {
      return;
    }
    this.ikSolver.alignBoneYAxis(
      localPositions,
      localRotations,
      matrices,
      0,
      hand,
      this.gripDirections[offset] ?? 0,
      this.gripDirections[offset + 1] ?? 0,
      this.gripDirections[offset + 2] ?? 1,
      influence,
      transform,
    );
  }

  private writeNaturalTargets(
    targets: Readonly<MutableVanguardLimbTargets>,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    this.modelPointToWorld(
      LEFT_ARM,
      targets.leftWristX,
      targets.leftWristY,
      targets.leftWristZ,
      this.naturalWrists,
      transform,
    );
    this.modelPointToWorld(
      RIGHT_ARM,
      targets.rightWristX,
      targets.rightWristY,
      targets.rightWristZ,
      this.naturalWrists,
      transform,
    );
    this.modelPointToWorld(
      LEFT_ARM,
      targets.leftElbowX,
      targets.leftElbowY,
      targets.leftElbowZ,
      this.naturalPoles,
      transform,
    );
    this.modelPointToWorld(
      RIGHT_ARM,
      targets.rightElbowX,
      targets.rightElbowY,
      targets.rightElbowZ,
      this.naturalPoles,
      transform,
    );
  }

  private writeWeaponTargets(
    matrices: Float32Array,
    targets: Readonly<MutableVanguardWeaponConstraintTargets>,
    scale: number,
  ): void {
    const rootOffset = VanguardBone.WeaponAimRoot * VANGUARD_BONE_MATRIX_COMPONENTS;
    const profile = targets.profile;
    this.transformPoint(
      matrices,
      rootOffset,
      targets.supportLocalX,
      targets.supportLocalY,
      targets.supportLocalZ,
      this.gripPositions,
      LEFT_ARM,
    );
    this.transformPoint(matrices, rootOffset, 0, 0, 0, this.gripPositions, RIGHT_ARM);
    this.transformDirection(
      matrices,
      rootOffset,
      profile.supportHandAxis.x,
      profile.supportHandAxis.y,
      profile.supportHandAxis.z,
      this.gripDirections,
      LEFT_ARM,
      scale,
    );
    this.transformDirection(
      matrices,
      rootOffset,
      profile.mainHandAxis.x,
      profile.mainHandAxis.y,
      profile.mainHandAxis.z,
      this.gripDirections,
      RIGHT_ARM,
      scale,
    );
    this.transformPoint(
      matrices,
      rootOffset,
      profile.supportElbowPole.x,
      profile.supportElbowPole.y,
      profile.supportElbowPole.z,
      this.gripPoles,
      LEFT_ARM,
    );
    this.transformPoint(
      matrices,
      rootOffset,
      profile.mainElbowPole.x,
      profile.mainElbowPole.y,
      profile.mainElbowPole.z,
      this.gripPoles,
      RIGHT_ARM,
    );
  }

  private transformPoint(
    matrices: Float32Array,
    matrixOffset: number,
    x: number,
    y: number,
    z: number,
    result: Float64Array,
    index: number,
  ): void {
    const offset = index * 3;
    result[offset] = (matrices[matrixOffset + 9] ?? 0)
      + (matrices[matrixOffset] ?? 0) * x
      + (matrices[matrixOffset + 3] ?? 0) * y
      + (matrices[matrixOffset + 6] ?? 0) * z;
    result[offset + 1] = (matrices[matrixOffset + 10] ?? 0)
      + (matrices[matrixOffset + 1] ?? 0) * x
      + (matrices[matrixOffset + 4] ?? 0) * y
      + (matrices[matrixOffset + 7] ?? 0) * z;
    result[offset + 2] = (matrices[matrixOffset + 11] ?? 0)
      + (matrices[matrixOffset + 2] ?? 0) * x
      + (matrices[matrixOffset + 5] ?? 0) * y
      + (matrices[matrixOffset + 8] ?? 0) * z;
  }

  private transformDirection(
    matrices: Float32Array,
    matrixOffset: number,
    x: number,
    y: number,
    z: number,
    result: Float64Array,
    index: number,
    scale: number,
  ): void {
    const offset = index * 3;
    const worldX = ((matrices[matrixOffset] ?? 0) * x
      + (matrices[matrixOffset + 3] ?? 0) * y
      + (matrices[matrixOffset + 6] ?? 0) * z) / scale;
    const worldY = ((matrices[matrixOffset + 1] ?? 0) * x
      + (matrices[matrixOffset + 4] ?? 0) * y
      + (matrices[matrixOffset + 7] ?? 0) * z) / scale;
    const worldZ = ((matrices[matrixOffset + 2] ?? 0) * x
      + (matrices[matrixOffset + 5] ?? 0) * y
      + (matrices[matrixOffset + 8] ?? 0) * z) / scale;
    const inverseLength = 1 / Math.max(Math.hypot(worldX, worldY, worldZ), 0.000001);
    result[offset] = worldX * inverseLength;
    result[offset + 1] = worldY * inverseLength;
    result[offset + 2] = worldZ * inverseLength;
  }

  private modelPointToWorld(
    index: number,
    x: number,
    y: number,
    z: number,
    result: Float64Array,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    const offset = index * 3;
    const headingCosine = Math.cos(transform.heading);
    const headingSine = Math.sin(transform.heading);
    result[offset] = transform.positionX
      + (x * headingCosine + z * headingSine) * transform.scale;
    result[offset + 1] = transform.positionY + y * transform.scale;
    result[offset + 2] = transform.positionZ
      + (-x * headingSine + z * headingCosine) * transform.scale;
  }
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
