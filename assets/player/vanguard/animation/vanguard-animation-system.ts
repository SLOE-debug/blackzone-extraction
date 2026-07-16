import { type EntitySystem } from '../../../core/entities/entity-system';
import { damp, lerp, TAU, wrapAngle } from '../../../core/math/scalar';
import { VanguardAction } from '../model/vanguard-action';
import { VANGUARD_CONFIG } from '../model/vanguard-config';
import { VanguardJoint } from '../model/vanguard-schema';
import { type VanguardState } from '../model/vanguard-state';

/** 负责主角走路相位、身体起伏和双手持枪关节姿态。 */
export class VanguardAnimationSystem implements EntitySystem<VanguardState, number> {
  /** 在渲染器创建前写入完整初始姿态。 */
  public initialize(state: VanguardState): void {
    for (let index = 0; index < state.count; index++) {
      this.writePose(state, index);
    }
  }

  /** 推进主角基础走路循环并原地刷新全部关节点。 */
  public update(state: VanguardState, deltaTime: number): void {
    const { intent, motion, animation } = state.data;

    for (let index = 0; index < state.count; index++) {
      const action = intent.action[index] as VanguardAction;
      if (action !== VanguardAction.WalkWithHandgun) {
        throw new Error(`主角动作未实现：${action}`);
      }

      const currentSpeed = damp(
        motion.currentSpeed[index] ?? 0,
        intent.targetSpeed[index] ?? 0,
        5.5,
        deltaTime,
      );
      const weaponReady = damp(
        animation.weaponReady[index] ?? 0,
        intent.targetWeaponReady[index] ?? 0,
        9,
        deltaTime,
      );
      const phaseRate = currentSpeed / VANGUARD_CONFIG.strideDistance * TAU;
      const phase = wrapAngle((animation.phase[index] ?? 0) + phaseRate * deltaTime);

      motion.currentSpeed[index] = currentSpeed;
      animation.weaponReady[index] = weaponReady;
      animation.phase[index] = phase;
      animation.bodyBob[index] = Math.abs(Math.cos(phase)) * 0.034;
      this.writePose(state, index);
    }
  }

  /** 根据单个实体当前相位写入世界空间关节坐标。 */
  private writePose(state: VanguardState, index: number): void {
    const { transform, morphology, motion, animation } = state.data;
    const stature = morphology.statureScale[index] ?? 1;
    const shoulders = morphology.shoulderScale[index] ?? 1;
    const limbs = morphology.limbScale[index] ?? 1;
    const phase = animation.phase[index] ?? 0;
    const speedRatio = Math.min(
      (motion.currentSpeed[index] ?? 0) / VANGUARD_CONFIG.walkSpeed,
      1.2,
    );
    const weaponReady = animation.weaponReady[index] ?? 0;
    const bodyBob = (animation.bodyBob[index] ?? 0) * stature * speedRatio;
    const strideWave = Math.sin(phase) * speedRatio;
    const leftLift = Math.max(0, Math.cos(phase)) * speedRatio;
    const rightLift = Math.max(0, -Math.cos(phase)) * speedRatio;
    const heading = transform.heading[index] ?? 0;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
    const torsoForward = 0.02 + speedRatio * 0.015;
    const weaponBob = bodyBob * 0.68 + Math.sin(phase * 2) * 0.009 * speedRatio;

    this.setJoint(state, index, VanguardJoint.PelvisBottom, 0, 2.13 * stature + bodyBob, -0.015, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.PelvisTop, 0.012, 2.42 * stature + bodyBob, torsoForward * 0.25, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.ChestBottom, -0.008, 2.53 * stature + bodyBob, torsoForward, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.ChestTop, 0.018, 3.48 * stature + bodyBob, torsoForward * 1.65, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.Neck, -0.012, 3.63 * stature + bodyBob, torsoForward * 1.45, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.HeadJaw, 0.004, 3.73 * stature + bodyBob, 0.035, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.HeadBrow, -0.012, 4.08 * stature + bodyBob, 0.02, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.HeadTop, 0.018, 4.34 * stature + bodyBob, -0.015, headingCosine, headingSine);

    this.writeLegPose(
      state,
      index,
      true,
      strideWave,
      leftLift,
      stature,
      limbs,
      bodyBob,
      headingCosine,
      headingSine,
    );
    this.writeLegPose(
      state,
      index,
      false,
      -strideWave,
      rightLift,
      stature,
      limbs,
      bodyBob,
      headingCosine,
      headingSine,
    );

    const shoulderWidth = 0.74 * shoulders;
    const shoulderY = 3.38 * stature + bodyBob;
    const leftElbowX = lerp(-shoulderWidth * 1.01, -0.46 * shoulders, weaponReady);
    const leftElbowY = lerp(2.73 * stature, 3.07 * stature, weaponReady) + weaponBob;
    const leftElbowZ = lerp(-strideWave * 0.14, 0.26, weaponReady);
    const leftHandX = lerp(-shoulderWidth * 0.96, -0.11 * shoulders, weaponReady);
    const leftHandY = lerp(2.25 * stature, 2.96 * stature, weaponReady) + weaponBob;
    const leftHandZ = lerp(strideWave * 0.22, 0.63, weaponReady);
    const rightElbowX = lerp(shoulderWidth * 1.01, 0.47 * shoulders, weaponReady);
    const rightElbowY = lerp(2.75 * stature, 3.03 * stature, weaponReady) + weaponBob;
    const rightElbowZ = lerp(strideWave * 0.14, 0.24, weaponReady);
    const rightHandX = lerp(shoulderWidth * 0.96, 0.23 * shoulders, weaponReady);
    const rightHandY = lerp(2.27 * stature, 2.94 * stature, weaponReady) + weaponBob;
    const rightHandZ = lerp(-strideWave * 0.22, 0.64, weaponReady);

    this.setJoint(state, index, VanguardJoint.LeftShoulderInner, -0.48 * shoulders, shoulderY + 0.018, 0.05, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.LeftShoulder, -shoulderWidth, shoulderY, 0.035, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.LeftShoulderOuter, -0.96 * shoulders, shoulderY - 0.1, -0.005, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.LeftElbow, leftElbowX, leftElbowY, leftElbowZ, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.LeftHand, leftHandX, leftHandY, leftHandZ, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.LeftPalmEnd, -0.012 * shoulders, 2.93 * stature + weaponBob, 0.72, headingCosine, headingSine);

    this.setJoint(state, index, VanguardJoint.RightShoulderInner, 0.47 * shoulders, shoulderY, 0.045, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.RightShoulder, shoulderWidth, shoulderY - 0.015, 0.03, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.RightShoulderOuter, 0.98 * shoulders, shoulderY - 0.11, -0.012, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.RightElbow, rightElbowX, rightElbowY, rightElbowZ, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.RightHand, rightHandX, rightHandY, rightHandZ, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.RightPalmEnd, 0.13 * shoulders, 2.93 * stature + weaponBob, 0.73, headingCosine, headingSine);

    this.setJoint(state, index, VanguardJoint.ChestLeftBottom, -0.29 * shoulders, 2.86 * stature + bodyBob, 0.36, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.ChestLeftTop, -0.5 * shoulders, 3.4 * stature + bodyBob, 0.31, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.ChestRightBottom, 0.28 * shoulders, 2.85 * stature + bodyBob, 0.365, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.ChestRightTop, 0.51 * shoulders, 3.38 * stature + bodyBob, 0.3, headingCosine, headingSine);

    this.setJoint(state, index, VanguardJoint.PouchLeftBottom, -0.38, 2.55 * stature + bodyBob, 0.46, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.PouchLeftTop, -0.38, 2.9 * stature + bodyBob, 0.45, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.PouchCenterBottom, 0, 2.53 * stature + bodyBob, 0.48, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.PouchCenterTop, 0, 2.91 * stature + bodyBob, 0.47, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.PouchRightBottom, 0.38, 2.55 * stature + bodyBob, 0.455, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.PouchRightTop, 0.38, 2.89 * stature + bodyBob, 0.445, headingCosine, headingSine);

    this.setJoint(state, index, VanguardJoint.LeftHipPanelBottom, -0.42, 2.08 * stature + bodyBob, 0.2, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.LeftHipPanelTop, -0.47, 2.36 * stature + bodyBob, 0.17, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.RightHipPanelBottom, 0.42, 2.08 * stature + bodyBob, 0.195, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.RightHipPanelTop, 0.48, 2.35 * stature + bodyBob, 0.16, headingCosine, headingSine);

    this.setJoint(state, index, VanguardJoint.EyeInner, 0, 3.99 * stature + bodyBob, 0.31, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.EyeOuter, 0, 3.99 * stature + bodyBob, 0.45, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.LeftTempleLightBottom, -0.31, 3.93 * stature + bodyBob, 0.13, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.LeftTempleLightTop, -0.31, 4.22 * stature + bodyBob, 0.1, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.RightTempleLightBottom, 0.31, 3.93 * stature + bodyBob, 0.125, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.RightTempleLightTop, 0.31, 4.19 * stature + bodyBob, 0.095, headingCosine, headingSine);

    this.writeForearmLightPose(
      state,
      index,
      true,
      leftElbowX,
      leftElbowY,
      leftElbowZ,
      leftHandX,
      leftHandY,
      leftHandZ,
      headingCosine,
      headingSine,
    );
    this.writeForearmLightPose(
      state,
      index,
      false,
      rightElbowX,
      rightElbowY,
      rightElbowZ,
      rightHandX,
      rightHandY,
      rightHandZ,
      headingCosine,
      headingSine,
    );

    const weaponY = 2.94 * stature + weaponBob;
    this.setJoint(state, index, VanguardJoint.WeaponRear, 0.13 * shoulders, weaponY, 0.72, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.WeaponFront, 0.13 * shoulders, weaponY + 0.018, 1.31, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.WeaponMuzzle, 0.13 * shoulders, weaponY + 0.015, 1.48, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.WeaponGripBottom, 0.21 * shoulders, weaponY - 0.27, 0.59, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.AntennaBase, 0.27, 4.14 * stature + bodyBob, 0, headingCosine, headingSine);
    this.setJoint(state, index, VanguardJoint.AntennaTip, 0.31, 4.55 * stature + bodyBob, -0.025, headingCosine, headingSine);
  }

  /** 写入单侧腿部反相步态和前置膝甲关节。 */
  private writeLegPose(
    state: VanguardState,
    index: number,
    left: boolean,
    stride: number,
    lift: number,
    stature: number,
    limbs: number,
    bodyBob: number,
    headingCosine: number,
    headingSine: number,
  ): void {
    const side = left ? -1 : 1;
    const hipX = side * 0.34 * limbs;
    const kneeX = side * (0.35 + lift * 0.02) * limbs;
    const ankleX = side * (0.36 - lift * 0.015) * limbs;
    const hipZ = -stride * 0.045;
    const kneeZ = stride * 0.16;
    const ankleZ = stride * 0.42;
    const hip = left ? VanguardJoint.LeftHip : VanguardJoint.RightHip;
    const knee = left ? VanguardJoint.LeftKnee : VanguardJoint.RightKnee;
    const ankle = left ? VanguardJoint.LeftAnkle : VanguardJoint.RightAnkle;
    const toe = left ? VanguardJoint.LeftToe : VanguardJoint.RightToe;
    const plateBottom = left
      ? VanguardJoint.LeftKneePlateBottom
      : VanguardJoint.RightKneePlateBottom;
    const plateTop = left
      ? VanguardJoint.LeftKneePlateTop
      : VanguardJoint.RightKneePlateTop;
    const thighPlateBottom = left
      ? VanguardJoint.LeftThighPlateBottom
      : VanguardJoint.RightThighPlateBottom;
    const thighPlateTop = left
      ? VanguardJoint.LeftThighPlateTop
      : VanguardJoint.RightThighPlateTop;

    this.setJoint(state, index, hip, hipX, 2.13 * stature + bodyBob, hipZ, headingCosine, headingSine);
    this.setJoint(state, index, knee, kneeX, (1.18 + lift * 0.055) * stature, kneeZ, headingCosine, headingSine);
    this.setJoint(state, index, ankle, ankleX, (0.24 + lift * 0.16) * stature, ankleZ, headingCosine, headingSine);
    this.setJoint(state, index, toe, ankleX, (0.115 + lift * 0.12) * stature, 0.27 + stride * 0.43, headingCosine, headingSine);
    this.setJoint(state, index, plateBottom, kneeX, (1.05 + lift * 0.05) * stature, kneeZ + 0.17, headingCosine, headingSine);
    this.setJoint(state, index, plateTop, kneeX, (1.34 + lift * 0.05) * stature, kneeZ + 0.15, headingCosine, headingSine);
    this.setJoint(state, index, thighPlateBottom, kneeX, (1.42 + lift * 0.045) * stature, kneeZ + 0.15, headingCosine, headingSine);
    this.setJoint(state, index, thighPlateTop, hipX, 1.98 * stature + bodyBob, hipZ + 0.13, headingCosine, headingSine);
  }

  /** 把白色识别灯条贴合到当前前臂外侧。 */
  private writeForearmLightPose(
    state: VanguardState,
    index: number,
    left: boolean,
    elbowX: number,
    elbowY: number,
    elbowZ: number,
    handX: number,
    handY: number,
    handZ: number,
    headingCosine: number,
    headingSine: number,
  ): void {
    const bottom = left
      ? VanguardJoint.LeftForearmLightBottom
      : VanguardJoint.RightForearmLightBottom;
    const top = left
      ? VanguardJoint.LeftForearmLightTop
      : VanguardJoint.RightForearmLightTop;
    const sideOffset = left ? -0.035 : 0.035;
    this.setJoint(
      state,
      index,
      bottom,
      lerp(elbowX, handX, 0.72) + sideOffset,
      lerp(elbowY, handY, 0.72),
      lerp(elbowZ, handZ, 0.72) + 0.13,
      headingCosine,
      headingSine,
    );
    this.setJoint(
      state,
      index,
      top,
      lerp(elbowX, handX, 0.35) + sideOffset,
      lerp(elbowY, handY, 0.35),
      lerp(elbowZ, handZ, 0.35) + 0.14,
      headingCosine,
      headingSine,
    );
  }

  /** 把局部关节点旋转到世界坐标并写入 SoA 连续数组。 */
  private setJoint(
    state: VanguardState,
    entityIndex: number,
    joint: VanguardJoint,
    localX: number,
    localY: number,
    localZ: number,
    headingCosine: number,
    headingSine: number,
  ): void {
    const { transform, joints } = state.data;
    const offset = entityIndex * VanguardJoint.Count + joint;
    joints.x[offset] = (transform.x[entityIndex] ?? 0)
      + localX * headingCosine
      + localZ * headingSine;
    joints.y[offset] = (transform.y[entityIndex] ?? 0) + localY;
    joints.z[offset] = (transform.z[entityIndex] ?? 0)
      - localX * headingSine
      + localZ * headingCosine;
  }
}
