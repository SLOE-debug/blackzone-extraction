import { VanguardBone } from '../model/vanguard-bone';
import {
  invertQuaternion,
  multiplyQuaternions,
  normalizeQuaternion,
  VANGUARD_QUATERNION_COMPONENTS,
  writeQuaternionRotationVector,
  writeRotationVectorQuaternion,
} from '../rigging/vanguard-pose-math';
import { VANGUARD_LOCAL_POSITION_COMPONENTS } from '../rigging/vanguard-rig';

const POSITION_SHARPNESS = 18;
const ROTATION_SHARPNESS = 16;
const MAXIMUM_ROTATION_STEP = 0.7;

/**
 * 在局部 Pose 上保留平移速度和旋转向量速度。
 *
 * IK 与脚锁在本层之后执行，因此稳定接触目标不会被普通姿态平滑重新拖动。
 */
export class VanguardPoseInertializer {
  private readonly currentPositions = new Float64Array(
    VanguardBone.Count * VANGUARD_LOCAL_POSITION_COMPONENTS,
  );
  private readonly positionVelocities = new Float64Array(
    VanguardBone.Count * VANGUARD_LOCAL_POSITION_COMPONENTS,
  );
  private readonly currentRotations = new Float64Array(
    VanguardBone.Count * VANGUARD_QUATERNION_COMPONENTS,
  );
  private readonly angularVelocities = new Float64Array(
    VanguardBone.Count * VANGUARD_LOCAL_POSITION_COMPONENTS,
  );
  private readonly inverseCurrent = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly rotationError = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly rotationVector = new Float64Array(VANGUARD_LOCAL_POSITION_COMPONENTS);
  private readonly rotationStep = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private initialized = false;

  /** 首帧直接采用目标，避免从零四元数或世界原点产生启动冲击。 */
  public initialize(
    targetPositions: Float32Array | Float64Array,
    targetRotations: Float32Array | Float64Array,
    outputPositions: Float32Array,
    outputRotations: Float32Array,
  ): void {
    this.copyPose(targetPositions, targetRotations);
    this.positionVelocities.fill(0);
    this.angularVelocities.fill(0);
    this.writeOutput(outputPositions, outputRotations);
    this.initialized = true;
  }

  /** 以临界阻尼连续追踪本帧局部目标，并把结果写入运行时 Pose。 */
  public update(
    targetPositions: Float32Array | Float64Array,
    targetRotations: Float32Array | Float64Array,
    outputPositions: Float32Array,
    outputRotations: Float32Array,
    deltaTime: number,
  ): void {
    if (!this.initialized) {
      this.initialize(targetPositions, targetRotations, outputPositions, outputRotations);
      return;
    }
    const safeDeltaTime = Math.max(0, deltaTime);
    this.updatePositions(targetPositions, safeDeltaTime);
    this.updateRotations(targetRotations, safeDeltaTime);
    this.writeOutput(outputPositions, outputRotations);
  }

  private updatePositions(
    targets: Float32Array | Float64Array,
    deltaTime: number,
  ): void {
    const decay = Math.exp(-POSITION_SHARPNESS * deltaTime);
    for (let component = 0; component < this.currentPositions.length; component++) {
      const current = this.currentPositions[component] ?? 0;
      const target = targets[component] ?? 0;
      const velocity = this.positionVelocities[component] ?? 0;
      const displacement = current - target;
      const coupledVelocity = velocity + POSITION_SHARPNESS * displacement;
      this.currentPositions[component] = target
        + (displacement + coupledVelocity * deltaTime) * decay;
      this.positionVelocities[component] = (
        velocity - POSITION_SHARPNESS * coupledVelocity * deltaTime
      ) * decay;
    }
  }

  private updateRotations(
    targets: Float32Array | Float64Array,
    deltaTime: number,
  ): void {
    const decay = Math.exp(-ROTATION_SHARPNESS * deltaTime);
    for (let bone = 0; bone < VanguardBone.Count; bone++) {
      const rotationOffset = bone * VANGUARD_QUATERNION_COMPONENTS;
      const velocityOffset = bone * VANGUARD_LOCAL_POSITION_COMPONENTS;
      invertQuaternion(this.inverseCurrent, 0, this.currentRotations, rotationOffset);
      multiplyQuaternions(
        this.rotationError,
        0,
        targets,
        rotationOffset,
        this.inverseCurrent,
        0,
      );
      writeQuaternionRotationVector(this.rotationVector, 0, this.rotationError, 0);
      let stepX = 0;
      let stepY = 0;
      let stepZ = 0;
      for (let axis = 0; axis < VANGUARD_LOCAL_POSITION_COMPONENTS; axis++) {
        const error = this.rotationVector[axis] ?? 0;
        const velocity = this.angularVelocities[velocityOffset + axis] ?? 0;
        const coupledVelocity = velocity - ROTATION_SHARPNESS * error;
        const remainingError = (-error + coupledVelocity * deltaTime) * decay;
        const step = error + remainingError;
        if (axis === 0) stepX = step;
        if (axis === 1) stepY = step;
        if (axis === 2) stepZ = step;
        this.angularVelocities[velocityOffset + axis] = (
          velocity - ROTATION_SHARPNESS * coupledVelocity * deltaTime
        ) * decay;
      }
      const stepLength = Math.hypot(stepX, stepY, stepZ);
      if (stepLength > MAXIMUM_ROTATION_STEP) {
        const scale = MAXIMUM_ROTATION_STEP / stepLength;
        stepX *= scale;
        stepY *= scale;
        stepZ *= scale;
      }
      writeRotationVectorQuaternion(this.rotationStep, 0, stepX, stepY, stepZ);
      multiplyQuaternions(
        this.currentRotations,
        rotationOffset,
        this.rotationStep,
        0,
        this.currentRotations,
        rotationOffset,
      );
      normalizeQuaternion(this.currentRotations, rotationOffset);
    }
  }

  private copyPose(
    positions: Float32Array | Float64Array,
    rotations: Float32Array | Float64Array,
  ): void {
    for (let component = 0; component < this.currentPositions.length; component++) {
      this.currentPositions[component] = positions[component] ?? 0;
    }
    for (let component = 0; component < this.currentRotations.length; component++) {
      this.currentRotations[component] = rotations[component] ?? 0;
    }
  }

  private writeOutput(
    positions: Float32Array,
    rotations: Float32Array,
  ): void {
    for (let component = 0; component < this.currentPositions.length; component++) {
      positions[component] = this.currentPositions[component] ?? 0;
    }
    for (let component = 0; component < this.currentRotations.length; component++) {
      rotations[component] = this.currentRotations[component] ?? 0;
    }
  }
}
