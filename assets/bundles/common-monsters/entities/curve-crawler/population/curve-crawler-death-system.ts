import { type EntitySystem } from '../../../../../core/entities/entity-system';
import {
  CURVE_CRAWLER_BURST_DURATION,
  CURVE_CRAWLER_LIQUID_DURATION,
  CurveCrawlerLifePhase,
} from '../model/curve-crawler-life';
import { CURVE_CRAWLER_FRAGMENT_COUNT } from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 独立处理致死阶段和各碎块的确定性飞散轨迹。 */
export class CurveCrawlerDeathSystem implements EntitySystem<CurveCrawlerState, number> {
  /** 推进爆裂、液化和消失阶段，并刷新全部碎块变换。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { vitality } = state.data;

    for (let index = 0; index < state.count; index++) {
      this.advancePhase(state, index, deltaTime);
      const phase = vitality.phase[index] as CurveCrawlerLifePhase;

      switch (phase) {
        case CurveCrawlerLifePhase.Emerging:
        case CurveCrawlerLifePhase.Alive:
          break;
        case CurveCrawlerLifePhase.Bursting:
          this.updateBursting(state, index);
          break;
        case CurveCrawlerLifePhase.Liquefying:
          this.updateLiquefying(state, index);
          break;
        case CurveCrawlerLifePhase.Gone:
          this.updateGone(state, index);
          break;
        default:
          throw new Error(`未知的 Curve Crawler 生命周期阶段：${phase}`);
      }
    }
  }

  /** 让指定实体进入死亡爆裂阶段并停止移动意图。 */
  public start(state: CurveCrawlerState, entityId: number): void {
    const { vitality, intent, motion, animation } = state.data;
    if ((vitality.phase[entityId] as CurveCrawlerLifePhase) !== CurveCrawlerLifePhase.Alive) {
      return;
    }

    vitality.phase[entityId] = CurveCrawlerLifePhase.Bursting;
    vitality.phaseTime[entityId] = 0;
    intent.targetSpeed[entityId] = 0;
    intent.targetCrouch[entityId] = 0;
    intent.targetBite[entityId] = 0;
    motion.currentSpeed[entityId] = 0;
    animation.biteAmount[entityId] = 0;
    animation.bodyPulse[entityId] = 0;
  }

  /** 推进单个实体的死亡阶段并保留跨阶段的剩余时间。 */
  private advancePhase(state: CurveCrawlerState, index: number, deltaTime: number): void {
    const { vitality } = state.data;
    const phase = vitality.phase[index] as CurveCrawlerLifePhase;
    if (phase === CurveCrawlerLifePhase.Emerging
      || phase === CurveCrawlerLifePhase.Alive
      || phase === CurveCrawlerLifePhase.Gone) {
      return;
    }

    const duration = phase === CurveCrawlerLifePhase.Bursting
      ? CURVE_CRAWLER_BURST_DURATION
      : CURVE_CRAWLER_LIQUID_DURATION;
    const nextTime = (vitality.phaseTime[index] ?? 0) + deltaTime;
    if (nextTime < duration) {
      vitality.phaseTime[index] = nextTime;
      return;
    }

    vitality.phase[index] = phase === CurveCrawlerLifePhase.Bursting
      ? CurveCrawlerLifePhase.Liquefying
      : CurveCrawlerLifePhase.Gone;
    vitality.phaseTime[index] = nextTime - duration;
  }

  /** 按独立方向、距离、抛物线高度和自转刷新全部碎块。 */
  private updateBursting(state: CurveCrawlerState, index: number): void {
    const { transform, vitality, death, animation } = state.data;
    const elapsedTime = vitality.phaseTime[index] ?? 0;
    const progress = clamp01(elapsedTime / CURVE_CRAWLER_BURST_DURATION);
    const travelProgress = 1 - (1 - progress) * (1 - progress);
    const heading = transform.heading[index] ?? 0;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
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
    const { vitality, animation } = state.data;
    const progress = clamp01((vitality.phaseTime[index] ?? 0) / CURVE_CRAWLER_LIQUID_DURATION);
    animation.surfaceCollapse[index] = 1;
    animation.liquidSpread[index] = 1;
    animation.liquidDrain[index] = smoothStep(0.2, 1, progress);
  }

  /** 将已经消失的实体保持在零面积渲染状态。 */
  private updateGone(state: CurveCrawlerState, index: number): void {
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
