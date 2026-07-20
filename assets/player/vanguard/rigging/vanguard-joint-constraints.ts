import { VanguardBone } from '../model/vanguard-bone';
import {
  invertQuaternion,
  multiplyQuaternions,
  normalizeQuaternion,
  VANGUARD_QUATERNION_COMPONENTS,
  writeAxisAngleQuaternion,
  writeIdentityQuaternion,
} from './vanguard-pose-math';
import {
  VANGUARD_BIND_LOCAL_ROTATIONS,
  VANGUARD_JOINT_LIMITS,
} from './vanguard-rig';

const EPSILON = 0.000001;

/** 将局部关节旋转限制在绑定姿态附近的摆动锥与骨轴扭转范围内。 */
export class VanguardJointConstraintSolver {
  private readonly bindRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly inverseBindRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly relativeRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly twistRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly inverseTwistRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly swingRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly constrainedSwing = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly constrainedTwist = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly constrainedRelative = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);

  /** 原地约束一个实体的完整局部旋转数组。 */
  public constrain(localRotations: Float32Array, entityIndex: number): void {
    const entityOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_QUATERNION_COMPONENTS;
    for (let bone = VanguardBone.VisualRoot; bone < VanguardBone.Count; bone++) {
      const limit = VANGUARD_JOINT_LIMITS[bone];
      if (limit === undefined) {
        throw new Error(`主角关节缺少活动范围：${bone}`);
      }
      const rotationOffset = entityOffset + bone * VANGUARD_QUATERNION_COMPONENTS;
      const bindOffset = bone * VANGUARD_QUATERNION_COMPONENTS;
      this.bindRotation[0] = VANGUARD_BIND_LOCAL_ROTATIONS[bindOffset] ?? 0;
      this.bindRotation[1] = VANGUARD_BIND_LOCAL_ROTATIONS[bindOffset + 1] ?? 0;
      this.bindRotation[2] = VANGUARD_BIND_LOCAL_ROTATIONS[bindOffset + 2] ?? 0;
      this.bindRotation[3] = VANGUARD_BIND_LOCAL_ROTATIONS[bindOffset + 3] ?? 1;
      invertQuaternion(this.inverseBindRotation, 0, this.bindRotation, 0);
      multiplyQuaternions(
        this.relativeRotation,
        0,
        this.inverseBindRotation,
        0,
        localRotations,
        rotationOffset,
      );
      this.writeTwist(this.relativeRotation);
      invertQuaternion(this.inverseTwistRotation, 0, this.twistRotation, 0);
      multiplyQuaternions(
        this.swingRotation,
        0,
        this.relativeRotation,
        0,
        this.inverseTwistRotation,
        0,
      );
      this.writeConstrainedSwing(limit.maximumSwing);
      this.writeConstrainedTwist(limit.minimumTwist, limit.maximumTwist);
      multiplyQuaternions(
        this.constrainedRelative,
        0,
        this.constrainedSwing,
        0,
        this.constrainedTwist,
        0,
      );
      multiplyQuaternions(
        localRotations,
        rotationOffset,
        this.bindRotation,
        0,
        this.constrainedRelative,
        0,
      );
    }
  }

  private writeTwist(relative: Float64Array): void {
    this.twistRotation[0] = 0;
    this.twistRotation[1] = relative[1] ?? 0;
    this.twistRotation[2] = 0;
    this.twistRotation[3] = relative[3] ?? 1;
    if (Math.hypot(this.twistRotation[1] ?? 0, this.twistRotation[3] ?? 1) <= EPSILON) {
      writeIdentityQuaternion(this.twistRotation, 0);
      return;
    }
    normalizeQuaternion(this.twistRotation, 0);
  }

  private writeConstrainedSwing(maximumSwing: number): void {
    let swingX = this.swingRotation[0] ?? 0;
    let swingY = this.swingRotation[1] ?? 0;
    let swingZ = this.swingRotation[2] ?? 0;
    let swingW = this.swingRotation[3] ?? 1;
    if (swingW < 0) {
      swingX = -swingX;
      swingY = -swingY;
      swingZ = -swingZ;
      swingW = -swingW;
    }
    const sineHalfAngle = Math.hypot(swingX, swingY, swingZ);
    if (sineHalfAngle <= EPSILON) {
      writeIdentityQuaternion(this.constrainedSwing, 0);
      return;
    }
    const angle = Math.min(
      maximumSwing,
      2 * Math.atan2(sineHalfAngle, Math.max(0, swingW)),
    );
    writeAxisAngleQuaternion(
      this.constrainedSwing,
      0,
      swingX / sineHalfAngle,
      swingY / sineHalfAngle,
      swingZ / sineHalfAngle,
      angle,
    );
  }

  private writeConstrainedTwist(minimumTwist: number, maximumTwist: number): void {
    const rawAngle = 2 * Math.atan2(
      this.twistRotation[1] ?? 0,
      this.twistRotation[3] ?? 1,
    );
    const angle = Math.max(minimumTwist, Math.min(maximumTwist, wrapAngle(rawAngle)));
    writeAxisAngleQuaternion(this.constrainedTwist, 0, 0, 1, 0, angle);
  }
}

function wrapAngle(value: number): number {
  const wrapped = (value + Math.PI) % (Math.PI * 2);
  return (wrapped < 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI;
}
