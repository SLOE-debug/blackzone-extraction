import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  advanceMonsterLifecycleTime,
  transitionMonsterLifecycle,
} from '../../../../../core/monsters/monster-lifecycle-state-machine';
import {
  CURVE_CRAWLER_BURST_DURATION,
  CurveCrawlerDeathStage,
  CURVE_CRAWLER_LIQUID_DURATION,
} from '../model/curve-crawler-life';
import { CURVE_CRAWLER_FRAGMENT_COUNT } from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { EntityRenderDirty } from '../../../../../core/rendering/dynamic-entities/entity-render-dirty';

/** 独立处理致死阶段和各碎块的确定性飞散轨迹。 */
export class CurveCrawlerDeathSystem implements EntitySystem<CurveCrawlerState, number> {
  /** 推进爆裂、液化和消失阶段，并刷新全部碎块变换。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { vitality, death } = state.data;

    for (let index = 0; index < state.count; index++) {
      const lifecycleState = vitality.state[index] as MonsterLifecycleState;
      if (lifecycleState === MonsterLifecycleState.DeathComplete) {
        this.updateDeathComplete(state, index);
        continue;
      }
      if (lifecycleState !== MonsterLifecycleState.Dying) {
        continue;
      }
      this.advanceStage(state, index, deltaTime);
      if ((vitality.state[index] as MonsterLifecycleState)
        === MonsterLifecycleState.DeathComplete) {
        this.updateDeathComplete(state, index);
        state.renderChanges.mark(index, EntityRenderDirty.Color);
        continue;
      }

      switch (death.stage[index] as CurveCrawlerDeathStage) {
        case CurveCrawlerDeathStage.Bursting:
          this.updateBursting(state, index);
          break;
        case CurveCrawlerDeathStage.Liquefying:
          this.updateLiquefying(state, index);
          break;
        default:
          throw new Error(`未知的 Curve Crawler 死亡阶段：${death.stage[index]}`);
      }
      state.renderChanges.mark(
        index,
        EntityRenderDirty.Color,
      );
    }
  }

  /** 让指定实体进入死亡爆裂阶段并停止移动意图。 */
  public start(state: CurveCrawlerState, entityId: number): void {
    const { vitality, death, intent, motion, animation } = state.data;
    if ((vitality.state[entityId] as MonsterLifecycleState)
      !== MonsterLifecycleState.Alive) {
      return;
    }

    transitionMonsterLifecycle(vitality, entityId, MonsterLifecycleState.Dying);
    death.stage[entityId] = CurveCrawlerDeathStage.Bursting;
    death.stageTime[entityId] = 0;
    intent.targetSpeed[entityId] = 0;
    intent.targetCrouch[entityId] = 0;
    intent.targetBite[entityId] = 0;
    motion.currentSpeed[entityId] = 0;
    animation.biteAmount[entityId] = 0;
    animation.bodyPulse[entityId] = 0;
    state.renderChanges.mark(entityId, EntityRenderDirty.Color);
  }

  /** 推进具体死亡表现阶段，并在液化完成后提交通用死亡完成状态。 */
  private advanceStage(state: CurveCrawlerState, index: number, deltaTime: number): void {
    const { vitality, death } = state.data;
    advanceMonsterLifecycleTime(vitality, index, deltaTime);
    const stage = death.stage[index] as CurveCrawlerDeathStage;
    const duration = stage === CurveCrawlerDeathStage.Bursting
      ? CURVE_CRAWLER_BURST_DURATION
      : CURVE_CRAWLER_LIQUID_DURATION;
    const nextTime = (death.stageTime[index] ?? 0) + deltaTime;
    if (nextTime < duration) {
      death.stageTime[index] = nextTime;
      return;
    }

    if (stage === CurveCrawlerDeathStage.Bursting) {
      death.stage[index] = CurveCrawlerDeathStage.Liquefying;
      death.stageTime[index] = nextTime - duration;
      return;
    }
    death.stageTime[index] = 0;
    transitionMonsterLifecycle(vitality, index, MonsterLifecycleState.DeathComplete);
  }

  /** 按独立方向、距离、抛物线高度和自转刷新全部碎块。 */
  private updateBursting(state: CurveCrawlerState, index: number): void {
    const { transform, death, animation } = state.data;
    const elapsedTime = death.stageTime[index] ?? 0;
    const progress = clamp01(elapsedTime / CURVE_CRAWLER_BURST_DURATION);
    const travelProgress = 1 - (1 - progress) * (1 - progress);
    const headingCosine = transform.headingCosine[index] ?? 1;
    const headingSine = transform.headingSine[index] ?? 0;
    const fragmentOffset = index * CURVE_CRAWLER_FRAGMENT_COUNT;

    animation.surfaceCollapse[index] = smoothStep(0.72, 1, progress);
    animation.liquidSpread[index] = smoothStep(0.62, 1, progress);
    animation.liquidDrain[index] = 0;

    for (let fragment = 0; fragment < CURVE_CRAWLER_FRAGMENT_COUNT; fragment++) {
      const offset = fragmentOffset + fragment;
      const localDirectionX = death.fragmentDirectionX[offset] ?? 0;
      const localDirectionY = death.fragmentDirectionY[offset] ?? 0;
      const worldDirectionX = localDirectionX * headingCosine - localDirectionY * headingSine;
      const worldDirectionY = localDirectionX * headingSine + localDirectionY * headingCosine;
      const distance = (death.fragmentTravelDistance[offset] ?? 0) * travelProgress;
      animation.fragmentOffsetX[offset] = worldDirectionX * distance;
      animation.fragmentOffsetY[offset] = worldDirectionY * distance;
      animation.fragmentOffsetZ[offset] = (death.fragmentLiftHeight[offset] ?? 0)
        * 4 * progress * (1 - progress);
      animation.fragmentRotation[offset] = (death.fragmentSpinSpeed[offset] ?? 0) * elapsedTime;
    }
  }

  /** 隐藏碎块并推进液体向负 Y 方向收拢。 */
  private updateLiquefying(state: CurveCrawlerState, index: number): void {
    const { death, animation } = state.data;
    const progress = clamp01((death.stageTime[index] ?? 0) / CURVE_CRAWLER_LIQUID_DURATION);
    animation.surfaceCollapse[index] = 1;
    animation.liquidSpread[index] = 1;
    animation.liquidDrain[index] = smoothStep(0.2, 1, progress);
  }

  /** 将已经消失的实体保持在零面积渲染状态。 */
  private updateDeathComplete(state: CurveCrawlerState, index: number): void {
    const { animation } = state.data;
    animation.surfaceCollapse[index] = 1;
    animation.liquidSpread[index] = 1;
    animation.liquidDrain[index] = 1;
  }
}

/** 在指定边界之间生成平滑的零到一插值量。 */
function smoothStep(edge0: number, edge1: number, value: number): number {
  const amount = clamp01((value - edge0) / Math.max(edge1 - edge0, 0.000001));
  return amount * amount * (3 - amount * 2);
}

/** 将数值约束到零到一之间。 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(value, 1));
}
