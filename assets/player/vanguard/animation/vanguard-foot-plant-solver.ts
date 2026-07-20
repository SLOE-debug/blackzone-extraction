import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../model/vanguard-bone';
import { type MutableVanguardLimbTargets } from './vanguard-locomotion-pose';
import { VanguardForwardKinematics, type VanguardRigTransform } from '../rigging/vanguard-forward-kinematics';
import { VANGUARD_LOCAL_POSITION_COMPONENTS } from '../rigging/vanguard-rig';
import { VanguardTwoBoneIkSolver } from '../rigging/vanguard-two-bone-ik';

const LEFT_FOOT = 0;
const RIGHT_FOOT = 1;
const FOOT_COUNT = 2;
const CONTACT_ESTABLISH_THRESHOLD = 0.12;
const CONTACT_RELEASE_THRESHOLD = 0.025;
const PELVIS_SHARPNESS = 24;

/** 可观察的单脚世界接触状态，供约束测试和调试面板使用。 */
export interface MutableVanguardFootContactState {
  contactWeight: number;
  locked: boolean;
  worldX: number;
  worldY: number;
  worldZ: number;
}

/** 在基础姿态之后建立脚锁、调整骨盆，再用双骨 IK 恢复完整腿链。 */
export class VanguardFootPlantSolver {
  private readonly locked = new Uint8Array(FOOT_COUNT);
  private readonly contactWeights = new Float64Array(FOOT_COUNT);
  private readonly lockPositions = new Float64Array(FOOT_COUNT * 3);
  private readonly lockDirections = new Float64Array(FOOT_COUNT * 3);
  private readonly candidatePositions = new Float64Array(FOOT_COUNT * 3);
  private readonly candidatePoles = new Float64Array(FOOT_COUNT * 3);
  private readonly finalPositions = new Float64Array(FOOT_COUNT * 3);
  private readonly desiredDirections = new Float64Array(FOOT_COUNT * 3);
  private pelvisCorrection = 0;

  constructor(
    private readonly forwardKinematics: VanguardForwardKinematics,
    private readonly ikSolver: VanguardTwoBoneIkSolver,
  ) {}

  /** 根据本帧步态目标更新两个独立支撑状态并完成腿部约束。 */
  public solve(
    localPositions: Float32Array,
    localRotations: Float32Array,
    matrices: Float32Array,
    targets: Readonly<MutableVanguardLimbTargets>,
    movementRight: number,
    movementForward: number,
    locomotionBlend: number,
    deltaTime: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    this.writeWorldTargets(targets, transform);
    this.writeDesiredFootDirections(
      targets,
      movementRight,
      movementForward,
      transform,
    );
    this.updateContact(
      LEFT_FOOT,
      targets.leftContactWeight,
      deltaTime,
      transform.positionY + VANGUARD_ANATOMY.ankleY * transform.scale,
    );
    this.updateContact(
      RIGHT_FOOT,
      targets.rightContactWeight,
      deltaTime,
      transform.positionY + VANGUARD_ANATOMY.ankleY * transform.scale,
    );
    this.writeFinalTarget(LEFT_FOOT);
    this.writeFinalTarget(RIGHT_FOOT);
    this.solvePelvis(
      localPositions,
      localRotations,
      matrices,
      deltaTime,
      transform,
    );
    const legWeight = 0.24 + clamp01(locomotionBlend) * 0.76;
    this.solveLeg(
      localPositions,
      localRotations,
      matrices,
      LEFT_FOOT,
      VanguardBone.LeftThigh,
      VanguardBone.LeftShin,
      VanguardBone.LeftFoot,
      legWeight,
      transform,
    );
    this.solveLeg(
      localPositions,
      localRotations,
      matrices,
      RIGHT_FOOT,
      VanguardBone.RightThigh,
      VanguardBone.RightShin,
      VanguardBone.RightFoot,
      legWeight,
      transform,
    );
    this.orientFoot(
      localPositions,
      localRotations,
      matrices,
      LEFT_FOOT,
      VanguardBone.LeftFoot,
      legWeight,
      transform,
    );
    this.orientFoot(
      localPositions,
      localRotations,
      matrices,
      RIGHT_FOOT,
      VanguardBone.RightFoot,
      legWeight,
      transform,
    );
  }

  /** 复制单脚当前接触状态，不暴露内部可写 TypedArray。 */
  public writeContactState(
    left: boolean,
    result: MutableVanguardFootContactState,
  ): void {
    const foot = left ? LEFT_FOOT : RIGHT_FOOT;
    const offset = foot * 3;
    result.contactWeight = this.contactWeights[foot] ?? 0;
    result.locked = (this.locked[foot] ?? 0) !== 0;
    result.worldX = this.lockPositions[offset] ?? 0;
    result.worldY = this.lockPositions[offset + 1] ?? 0;
    result.worldZ = this.lockPositions[offset + 2] ?? 0;
  }

  private writeWorldTargets(
    targets: Readonly<MutableVanguardLimbTargets>,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    this.modelPointToWorld(
      LEFT_FOOT,
      targets.leftAnkleX,
      targets.leftAnkleY,
      targets.leftAnkleZ,
      this.candidatePositions,
      transform,
    );
    this.modelPointToWorld(
      RIGHT_FOOT,
      targets.rightAnkleX,
      targets.rightAnkleY,
      targets.rightAnkleZ,
      this.candidatePositions,
      transform,
    );
    this.modelPointToWorld(
      LEFT_FOOT,
      targets.leftKneeX,
      targets.leftKneeY,
      targets.leftKneeZ,
      this.candidatePoles,
      transform,
    );
    this.modelPointToWorld(
      RIGHT_FOOT,
      targets.rightKneeX,
      targets.rightKneeY,
      targets.rightKneeZ,
      this.candidatePoles,
      transform,
    );
  }

  private writeDesiredFootDirections(
    targets: Readonly<MutableVanguardLimbTargets>,
    movementRight: number,
    movementForward: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    const movementLength = Math.hypot(movementRight, movementForward);
    const localRight = movementLength > 0.000001 ? movementRight / movementLength : 0;
    const localForward = movementLength > 0.000001 ? movementForward / movementLength : 1;
    this.writeFootDirection(LEFT_FOOT, localRight, localForward, targets.leftFootPitch, transform);
    this.writeFootDirection(
      RIGHT_FOOT,
      localRight,
      localForward,
      targets.rightFootPitch,
      transform,
    );
  }

  private writeFootDirection(
    foot: number,
    localRight: number,
    localForward: number,
    footPitch: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    const offset = foot * 3;
    const headingCosine = Math.cos(transform.heading);
    const headingSine = Math.sin(transform.heading);
    const planarScale = Math.cos(footPitch);
    const planarRight = localRight * planarScale;
    const planarForward = localForward * planarScale;
    this.desiredDirections[offset] = planarRight * headingCosine
      + planarForward * headingSine;
    this.desiredDirections[offset + 1] = Math.sin(footPitch);
    this.desiredDirections[offset + 2] = -planarRight * headingSine
      + planarForward * headingCosine;
  }

  private updateContact(
    foot: number,
    desiredWeight: number,
    deltaTime: number,
    groundAnkleY: number,
  ): void {
    const offset = foot * 3;
    const clampedDesired = clamp01(desiredWeight);
    const currentWeight = this.contactWeights[foot] ?? 0;
    const blend = 1 - Math.exp(-38 * Math.max(0, deltaTime));
    const nextWeight = currentWeight + (clampedDesired - currentWeight) * blend;
    this.contactWeights[foot] = nextWeight;
    if ((this.locked[foot] ?? 0) === 0
      && clampedDesired >= CONTACT_ESTABLISH_THRESHOLD) {
      this.locked[foot] = 1;
      this.lockPositions[offset] = this.candidatePositions[offset] ?? 0;
      this.lockPositions[offset + 1] = groundAnkleY;
      this.lockPositions[offset + 2] = this.candidatePositions[offset + 2] ?? 0;
      this.lockDirections[offset] = this.desiredDirections[offset] ?? 0;
      this.lockDirections[offset + 1] = 0;
      this.lockDirections[offset + 2] = this.desiredDirections[offset + 2] ?? 1;
    }
    if ((this.locked[foot] ?? 0) !== 0
      && clampedDesired <= CONTACT_RELEASE_THRESHOLD
      && nextWeight <= 0.08) {
      this.locked[foot] = 0;
    }
  }

  private writeFinalTarget(foot: number): void {
    const offset = foot * 3;
    const contactWeight = (this.locked[foot] ?? 0) !== 0
      ? this.contactWeights[foot] ?? 0
      : 0;
    for (let axis = 0; axis < 3; axis++) {
      const candidate = this.candidatePositions[offset + axis] ?? 0;
      const locked = this.lockPositions[offset + axis] ?? candidate;
      this.finalPositions[offset + axis] = candidate + (locked - candidate) * contactWeight;
      const desiredDirection = this.desiredDirections[offset + axis] ?? 0;
      const lockDirection = this.lockDirections[offset + axis] ?? desiredDirection;
      this.desiredDirections[offset + axis] = desiredDirection
        + (lockDirection - desiredDirection) * contactWeight;
    }
  }

  private solvePelvis(
    localPositions: Float32Array,
    localRotations: Float32Array,
    matrices: Float32Array,
    deltaTime: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    let desiredCorrection = 0;
    desiredCorrection = Math.min(
      desiredCorrection,
      this.calculatePelvisCorrection(
        matrices,
        VanguardBone.LeftThigh,
        VanguardBone.LeftShin,
        VanguardBone.LeftFoot,
        LEFT_FOOT,
      ),
    );
    desiredCorrection = Math.min(
      desiredCorrection,
      this.calculatePelvisCorrection(
        matrices,
        VanguardBone.RightThigh,
        VanguardBone.RightShin,
        VanguardBone.RightFoot,
        RIGHT_FOOT,
      ),
    );
    const blend = 1 - Math.exp(-PELVIS_SHARPNESS * Math.max(0, deltaTime));
    this.pelvisCorrection += (desiredCorrection - this.pelvisCorrection) * blend;
    const pelvisPositionOffset = VanguardBone.Pelvis * VANGUARD_LOCAL_POSITION_COMPONENTS;
    localPositions[pelvisPositionOffset + 1] = (
      localPositions[pelvisPositionOffset + 1] ?? 0
    ) + this.pelvisCorrection / transform.scale;
    this.forwardKinematics.writeWorldPose(
      localPositions,
      localRotations,
      matrices,
      0,
      transform,
    );
  }

  private calculatePelvisCorrection(
    matrices: Float32Array,
    thigh: VanguardBone,
    shin: VanguardBone,
    foot: VanguardBone,
    footIndex: number,
  ): number {
    const thighOffset = thigh * VANGUARD_BONE_MATRIX_COMPONENTS;
    const shinOffset = shin * VANGUARD_BONE_MATRIX_COMPONENTS;
    const footOffset = foot * VANGUARD_BONE_MATRIX_COMPONENTS;
    const targetOffset = footIndex * 3;
    const hipX = matrices[thighOffset + 9] ?? 0;
    const hipY = matrices[thighOffset + 10] ?? 0;
    const hipZ = matrices[thighOffset + 11] ?? 0;
    const upperLength = distanceBetweenMatrices(matrices, thighOffset, shinOffset);
    const lowerLength = distanceBetweenMatrices(matrices, shinOffset, footOffset);
    const maximumReach = (upperLength + lowerLength) * 0.975;
    const targetX = this.finalPositions[targetOffset] ?? 0;
    const targetY = this.finalPositions[targetOffset + 1] ?? 0;
    const targetZ = this.finalPositions[targetOffset + 2] ?? 0;
    const planarDistance = Math.hypot(targetX - hipX, targetZ - hipZ);
    const maximumVerticalDistance = Math.sqrt(Math.max(
      0,
      maximumReach * maximumReach - planarDistance * planarDistance,
    ));
    const maximumHipY = targetY + maximumVerticalDistance;
    const contactWeight = this.contactWeights[footIndex] ?? 0;
    return Math.min(0, maximumHipY - hipY) * contactWeight;
  }

  private solveLeg(
    localPositions: Float32Array,
    localRotations: Float32Array,
    matrices: Float32Array,
    footIndex: number,
    thigh: VanguardBone,
    shin: VanguardBone,
    foot: VanguardBone,
    weight: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    const targetOffset = footIndex * 3;
    this.ikSolver.solve(
      localPositions,
      localRotations,
      matrices,
      0,
      thigh,
      shin,
      foot,
      this.finalPositions[targetOffset] ?? 0,
      this.finalPositions[targetOffset + 1] ?? 0,
      this.finalPositions[targetOffset + 2] ?? 0,
      this.candidatePoles[targetOffset] ?? 0,
      this.candidatePoles[targetOffset + 1] ?? 0,
      this.candidatePoles[targetOffset + 2] ?? 0,
      weight,
      transform,
    );
  }

  private orientFoot(
    localPositions: Float32Array,
    localRotations: Float32Array,
    matrices: Float32Array,
    footIndex: number,
    bone: VanguardBone,
    weight: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    const offset = footIndex * 3;
    this.ikSolver.alignBoneYAxis(
      localPositions,
      localRotations,
      matrices,
      0,
      bone,
      this.desiredDirections[offset] ?? 0,
      this.desiredDirections[offset + 1] ?? 0,
      this.desiredDirections[offset + 2] ?? 1,
      weight,
      transform,
    );
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

function distanceBetweenMatrices(
  matrices: Float32Array,
  fromOffset: number,
  toOffset: number,
): number {
  return Math.hypot(
    (matrices[toOffset + 9] ?? 0) - (matrices[fromOffset + 9] ?? 0),
    (matrices[toOffset + 10] ?? 0) - (matrices[fromOffset + 10] ?? 0),
    (matrices[toOffset + 11] ?? 0) - (matrices[fromOffset + 11] ?? 0),
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
