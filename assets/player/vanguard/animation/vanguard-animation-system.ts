import { type EntitySystem } from '../../../core/entities/entity-system';
import { damp, TAU, wrapAngle } from '../../../core/math/scalar';
import { VanguardAction } from '../model/vanguard-action';
import { VANGUARD_CONFIG } from '../model/vanguard-config';
import { type VanguardState } from '../model/vanguard-state';
import { VanguardWeaponAction } from '../model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import { writeVanguardPoseMatrices } from './vanguard-pose';
import {
  type VanguardWeaponAnimationPoseState,
  updateVanguardWeaponAnimationState,
  VANGUARD_WEAPON_ANIMATION_REST_STATE,
  writeVanguardWeaponAnimationPoseState,
} from './vanguard-weapon-animation-state';
import { createVanguardTwoHandIkWorkspace } from './vanguard-two-hand-heavy-pose';
import {
  createVanguardTwoHandWeaponTrajectoryPose,
  writeVanguardTwoHandWeaponTrajectory,
} from './vanguard-two-hand-weapon-trajectory';
import {
  createVanguardGaitPoseState,
  updateVanguardGaitState,
  writeVanguardGaitPoseState,
} from './vanguard-gait-state';

const IDLE_CYCLE_SECONDS = 6.4;

/** 负责主角待机细节、脚底锁定步态与武器姿势混合。 */
export class VanguardAnimationSystem implements EntitySystem<VanguardState, number> {
  private readonly weaponPoseState: VanguardWeaponAnimationPoseState = {
    ...VANGUARD_WEAPON_ANIMATION_REST_STATE,
  };
  private readonly twoHandIkWorkspace = createVanguardTwoHandIkWorkspace();
  private readonly weaponTrajectory = createVanguardTwoHandWeaponTrajectoryPose();
  private readonly gaitPose = createVanguardGaitPoseState();

  /** 在渲染器创建前写入完整绑定姿态。 */
  public initialize(state: VanguardState): void {
    for (let index = 0; index < state.count; index++) {
      updateVanguardGaitState(state.data, index, 0);
      this.writePose(state, index);
    }
  }

  /** 推进稳定待机循环、按真实速度推进步态并刷新全部骨骼矩阵。 */
  public update(state: VanguardState, deltaTime: number): void {
    const { intent, motion, animation } = state.data;

    for (let index = 0; index < state.count; index++) {
      const action = intent.action[index] as VanguardAction;
      if (action !== VanguardAction.Idle) {
        throw new Error(`主角动作未实现：${action}`);
      }
      animation.idlePhase[index] = wrapAngle(
        (animation.idlePhase[index] ?? 0)
          + deltaTime / IDLE_CYCLE_SECONDS * TAU,
      );
      const speed = motion.speed[index] ?? 0;
      animation.locomotionPhase[index] = wrapAngle(
        (animation.locomotionPhase[index] ?? 0)
          + speed * VANGUARD_CONFIG.locomotionCyclesPerMeter * TAU * deltaTime,
      );
      animation.locomotionBlend[index] = damp(
        animation.locomotionBlend[index] ?? 0,
        Math.min(1, speed / VANGUARD_CONFIG.maximumMoveSpeed),
        speed > 0.05 ? 13 : 18,
        deltaTime,
      );
      updateVanguardGaitState(state.data, index, deltaTime);
      const requestedWeaponPose = intent.weaponPose[index] as VanguardWeaponPose;
      const currentWeaponPose = animation.weaponPose[index] as VanguardWeaponPose;
      if (requestedWeaponPose !== VanguardWeaponPose.Unarmed
        && requestedWeaponPose !== currentWeaponPose) {
        animation.weaponPose[index] = requestedWeaponPose;
        animation.weaponStanceBlend[index] = 0;
      }
      const weaponReady = requestedWeaponPose !== VanguardWeaponPose.Unarmed;
      animation.weaponStanceBlend[index] = damp(
        animation.weaponStanceBlend[index] ?? 0,
        weaponReady ? 1 : 0,
        weaponReady ? 18 : 14,
        deltaTime,
      );
      if (!weaponReady && (animation.weaponStanceBlend[index] ?? 0) <= 0.01) {
        animation.weaponPose[index] = VanguardWeaponPose.Unarmed;
      }
      writeVanguardWeaponAnimationPoseState(state.data, index, this.weaponPoseState);
      this.sampleWeaponTrajectory(state, index);
      updateVanguardWeaponAnimationState(
        state.data,
        index,
        deltaTime,
        this.weaponTrajectory,
      );
      this.writePose(state, index);
    }
  }

  /** 直接把角色局部关节点写成世界空间骨段矩阵。 */
  private writePose(state: VanguardState, index: number): void {
    const { transform, morphology, intent, animation, pose } = state.data;
    writeVanguardWeaponAnimationPoseState(state.data, index, this.weaponPoseState);
    writeVanguardGaitPoseState(state.data, index, this.gaitPose);
    this.sampleWeaponTrajectory(state, index);
    writeVanguardPoseMatrices(
      pose.boneMatrices,
      index,
      transform.x[index] ?? 0,
      transform.y[index] ?? 0,
      transform.z[index] ?? 0,
      transform.heading[index] ?? 0,
      morphology.scale[index] ?? 1,
      animation.idlePhase[index] ?? 0,
      animation.locomotionPhase[index] ?? 0,
      animation.locomotionBlend[index] ?? 0,
      Math.max(-1, Math.min(1,
        (state.data.motion.locomotionForward[index] ?? 0) / VANGUARD_CONFIG.maximumMoveSpeed)),
      Math.max(-1, Math.min(1,
        (state.data.motion.locomotionRight[index] ?? 0) / VANGUARD_CONFIG.maximumMoveSpeed)),
      animation.weaponPose[index] as VanguardWeaponPose,
      animation.weaponStanceBlend[index] ?? 0,
      intent.weaponAction[index] as VanguardWeaponAction,
      intent.weaponActionProgress[index] ?? 0,
      (intent.weaponActionSide[index] ?? 0) as -1 | 0 | 1,
      this.weaponPoseState,
      this.twoHandIkWorkspace,
      this.weaponTrajectory,
      this.gaitPose,
    );
  }

  /** 把当前离散动作采样为后续阻尼与 IK 共用的完整目标。 */
  private sampleWeaponTrajectory(state: VanguardState, index: number): void {
    const intent = state.data.intent;
    writeVanguardTwoHandWeaponTrajectory(
      this.weaponTrajectory,
      intent.weaponAction[index] as VanguardWeaponAction,
      intent.weaponActionProgress[index] ?? 0,
      (intent.weaponActionSide[index] ?? 0) as -1 | 0 | 1,
      this.weaponPoseState.hammerLag,
    );
  }
}
