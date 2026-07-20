import { type EntitySystem } from '../../../core/entities/entity-system';
import { damp, TAU, wrapAngle } from '../../../core/math/scalar';
import { VanguardAction } from '../model/vanguard-action';
import { VANGUARD_CONFIG } from '../model/vanguard-config';
import { type VanguardState } from '../model/vanguard-state';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import { VanguardPosePipeline } from './vanguard-pose-pipeline';

const IDLE_CYCLE_SECONDS = 6.4;

/** 负责主角待机细节、移动步态与两者之间的连续混合。 */
export class VanguardAnimationSystem implements EntitySystem<VanguardState, number> {
  private readonly posePipeline = new VanguardPosePipeline();

  /** 在渲染器创建前写入完整绑定姿态。 */
  public initialize(state: VanguardState): void {
    this.posePipeline.initialize(state);
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
    }
    this.posePipeline.update(state, deltaTime);
  }
}
