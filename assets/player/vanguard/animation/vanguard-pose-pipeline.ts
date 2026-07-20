import { wrapAngle } from '../../../core/math/scalar';
import { VanguardBone } from '../model/vanguard-bone';
import { VANGUARD_CONFIG } from '../model/vanguard-config';
import { type VanguardState } from '../model/vanguard-state';
import { VanguardWeaponAction } from '../model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import { VanguardForwardKinematics, type VanguardRigTransform } from '../rigging/vanguard-forward-kinematics';
import { VanguardJointConstraintSolver } from '../rigging/vanguard-joint-constraints';
import { VANGUARD_QUATERNION_COMPONENTS } from '../rigging/vanguard-pose-math';
import { VANGUARD_LOCAL_POSITION_COMPONENTS } from '../rigging/vanguard-rig';
import { VanguardTwoBoneIkSolver } from '../rigging/vanguard-two-bone-ik';
import { VanguardArmConstraintSolver } from './vanguard-arm-constraint-solver';
import {
  VanguardFootPlantSolver,
  type MutableVanguardFootContactState,
} from './vanguard-foot-plant-solver';
import {
  VanguardLocomotionPose,
  type VanguardLocomotionPoseInput,
} from './vanguard-locomotion-pose';
import { VanguardPoseInertializer } from './vanguard-pose-inertializer';
import { VanguardWeaponPoseLayer } from './vanguard-weapon-pose-layer';

const DIRECTION_EPSILON = 0.0001;

interface MutableVanguardLocomotionPoseInput extends VanguardLocomotionPoseInput {
  idlePhase: number;
  locomotionPhase: number;
  locomotionBlend: number;
  movementRight: number;
  movementForward: number;
  accelerationRight: number;
  accelerationForward: number;
  aimYaw: number;
  aimPitch: number;
}

interface MutableVanguardRigTransform extends VanguardRigTransform {
  positionX: number;
  positionY: number;
  positionZ: number;
  heading: number;
  scale: number;
}

/**
 * 主角唯一 Pose Pipeline。
 *
 * 顺序固定为基础移动与持枪目标、局部惯性化、后坐 Additive、脚锁与腿 IK、双臂 IK、
 * 关节限制和最终 FK，防止多个系统轮流覆盖同一组世界矩阵。
 */
export class VanguardPosePipeline {
  private readonly targetPositions = new Float64Array(
    VanguardBone.Count * VANGUARD_LOCAL_POSITION_COMPONENTS,
  );
  private readonly targetRotations = new Float64Array(
    VanguardBone.Count * VANGUARD_QUATERNION_COMPONENTS,
  );
  private readonly locomotion = new VanguardLocomotionPose();
  private readonly weapon = new VanguardWeaponPoseLayer();
  private readonly inertializer = new VanguardPoseInertializer();
  private readonly forwardKinematics = new VanguardForwardKinematics();
  private readonly ikSolver = new VanguardTwoBoneIkSolver(this.forwardKinematics);
  private readonly feet = new VanguardFootPlantSolver(
    this.forwardKinematics,
    this.ikSolver,
  );
  private readonly arms = new VanguardArmConstraintSolver(this.ikSolver);
  private readonly jointConstraints = new VanguardJointConstraintSolver();
  private readonly locomotionInput: MutableVanguardLocomotionPoseInput = {
    idlePhase: 0,
    locomotionPhase: 0,
    locomotionBlend: 0,
    movementRight: 0,
    movementForward: 1,
    accelerationRight: 0,
    accelerationForward: 0,
    aimYaw: 0,
    aimPitch: 0,
  };
  private readonly rigTransform: MutableVanguardRigTransform = {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    heading: 0,
    scale: 1,
  };
  private previousVelocityX = 0;
  private previousVelocityZ = 0;

  /** 首帧直接采用目标局部 Pose，再执行全部约束。 */
  public initialize(state: VanguardState): void {
    this.previousVelocityX = state.data.motion.velocityX[0] ?? 0;
    this.previousVelocityZ = state.data.motion.velocityZ[0] ?? 0;
    this.evaluate(state, 0, true);
  }

  /** 用本帧实际位移速度驱动惯性、接触与完整姿态约束。 */
  public update(state: VanguardState, deltaTime: number): void {
    this.evaluate(state, deltaTime, false);
  }

  /** 复制当前支撑脚状态，便于验证世界锁定是否成立。 */
  public writeFootContactState(
    left: boolean,
    result: MutableVanguardFootContactState,
  ): void {
    this.feet.writeContactState(left, result);
  }

  private evaluate(state: VanguardState, deltaTime: number, snap: boolean): void {
    if (state.count !== 1) {
      throw new Error('当前主角 Pose Pipeline 只接受单实体角色表。');
    }
    const { transform, morphology, motion, intent, animation, pose } = state.data;
    const heading = transform.heading[0] ?? 0;
    const velocityX = motion.velocityX[0] ?? 0;
    const velocityZ = motion.velocityZ[0] ?? 0;
    const speed = motion.speed[0] ?? 0;
    const inverseSpeed = speed > DIRECTION_EPSILON ? 1 / speed : 0;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
    const safeDeltaTime = Math.max(deltaTime, 1 / 240);
    const accelerationX = snap ? 0 : (velocityX - this.previousVelocityX) / safeDeltaTime;
    const accelerationZ = snap ? 0 : (velocityZ - this.previousVelocityZ) / safeDeltaTime;
    this.previousVelocityX = velocityX;
    this.previousVelocityZ = velocityZ;
    const input = this.locomotionInput;
    input.idlePhase = animation.idlePhase[0] ?? 0;
    input.locomotionPhase = animation.locomotionPhase[0] ?? 0;
    input.locomotionBlend = animation.locomotionBlend[0] ?? 0;
    input.movementRight = speed > DIRECTION_EPSILON
      ? (velocityX * headingCosine - velocityZ * headingSine) * inverseSpeed
      : 0;
    input.movementForward = speed > DIRECTION_EPSILON
      ? (velocityX * headingSine + velocityZ * headingCosine) * inverseSpeed
      : 1;
    input.accelerationRight = (
      accelerationX * headingCosine - accelerationZ * headingSine
    ) / VANGUARD_CONFIG.acceleration;
    input.accelerationForward = (
      accelerationX * headingSine + accelerationZ * headingCosine
    ) / VANGUARD_CONFIG.acceleration;
    const aiming = (intent.aiming[0] ?? 0) !== 0;
    const aimHeading = aiming
      ? Math.atan2(intent.aimX[0] ?? 0, intent.aimZ[0] ?? 1)
      : heading;
    input.aimYaw = Math.max(-1.25, Math.min(1.25, wrapAngle(aimHeading - heading)));
    input.aimPitch = aiming ? intent.aimPitch[0] ?? 0 : 0;
    this.locomotion.write(this.targetPositions, this.targetRotations, input);

    const weaponPose = animation.weaponPose[0] as VanguardWeaponPose;
    const weaponAction = intent.weaponAction[0] as VanguardWeaponAction;
    this.weapon.writeTargetPose(
      this.targetPositions,
      this.targetRotations,
      weaponPose,
      animation.weaponStanceBlend[0] ?? 0,
      input.locomotionBlend,
      input.aimYaw,
      input.aimPitch,
      input.accelerationRight,
      input.accelerationForward,
      weaponAction,
      intent.weaponActionProgress[0] ?? 0,
      deltaTime,
    );
    if (snap) {
      this.inertializer.initialize(
        this.targetPositions,
        this.targetRotations,
        pose.localPositions,
        pose.localRotations,
      );
    } else {
      this.inertializer.update(
        this.targetPositions,
        this.targetRotations,
        pose.localPositions,
        pose.localRotations,
        deltaTime,
      );
    }
    this.weapon.applyRecoilAdditive(pose.localPositions, pose.localRotations);

    const rigTransform = this.rigTransform;
    rigTransform.positionX = transform.x[0] ?? 0;
    rigTransform.positionY = transform.y[0] ?? 0;
    rigTransform.positionZ = transform.z[0] ?? 0;
    rigTransform.heading = heading;
    rigTransform.scale = morphology.scale[0] ?? 1;
    this.forwardKinematics.writeWorldPose(
      pose.localPositions,
      pose.localRotations,
      pose.boneMatrices,
      0,
      rigTransform,
    );
    this.feet.solve(
      pose.localPositions,
      pose.localRotations,
      pose.boneMatrices,
      this.locomotion.limbTargets,
      input.movementRight,
      input.movementForward,
      input.locomotionBlend,
      deltaTime,
      rigTransform,
    );
    this.arms.solve(
      pose.localPositions,
      pose.localRotations,
      pose.boneMatrices,
      this.locomotion.limbTargets,
      this.weapon.constraintTargets,
      rigTransform,
    );
    this.jointConstraints.constrain(pose.localRotations, 0);
    this.forwardKinematics.writeWorldPose(
      pose.localPositions,
      pose.localRotations,
      pose.boneMatrices,
      0,
      rigTransform,
    );
  }
}
