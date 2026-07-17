import { type EntitySystem } from '../../../core/entities/entity-system';
import { TAU, wrapAngle } from '../../../core/math/scalar';
import { VanguardAction } from '../model/vanguard-action';
import { type VanguardState } from '../model/vanguard-state';
import { writeVanguardPoseMatrices } from './vanguard-pose';

const IDLE_CYCLE_SECONDS = 6.4;

/** 负责正面英雄站姿、呼吸、轻微观察和持剑手摆动。 */
export class VanguardAnimationSystem implements EntitySystem<VanguardState, number> {
  /** 在渲染器创建前写入完整绑定姿态。 */
  public initialize(state: VanguardState): void {
    for (let index = 0; index < state.count; index++) {
      this.writePose(state, index);
    }
  }

  /** 推进稳定待机循环并刷新全部骨骼矩阵。 */
  public update(state: VanguardState, deltaTime: number): void {
    const { intent, animation } = state.data;

    for (let index = 0; index < state.count; index++) {
      const action = intent.action[index] as VanguardAction;
      if (action !== VanguardAction.ShrugAndTurnHead) {
        throw new Error(`主角动作未实现：${action}`);
      }
      animation.idlePhase[index] = wrapAngle(
        (animation.idlePhase[index] ?? 0)
          + deltaTime / IDLE_CYCLE_SECONDS * TAU,
      );
      this.writePose(state, index);
    }
  }

  /** 根据实体变换与待机相位写入世界空间骨骼矩阵。 */
  private writePose(state: VanguardState, index: number): void {
    const { transform, morphology, animation, pose } = state.data;
    writeVanguardPoseMatrices(
      pose.boneMatrices,
      index,
      transform.x[index] ?? 0,
      transform.y[index] ?? 0,
      transform.z[index] ?? 0,
      transform.heading[index] ?? 0,
      morphology.scale[index] ?? 1,
      animation.idlePhase[index] ?? 0,
    );
  }
}
