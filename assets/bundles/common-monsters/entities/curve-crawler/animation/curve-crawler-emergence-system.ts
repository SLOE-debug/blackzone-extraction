import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { CURVE_CRAWLER_EMERGENCE_TIMING } from '../model/curve-crawler-emergence';
import { CurveCrawlerLifePhase } from '../model/curve-crawler-life';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 推进地裂、蛋壳生长、突起爆裂和蜘蛛四肢生长的出生时间轴。 */
export class CurveCrawlerEmergenceSystem implements EntitySystem<CurveCrawlerState, number> {
  /** 只推进处于出生阶段的自主实体。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { vitality } = state.data;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.phase[index] as CurveCrawlerLifePhase)
        !== CurveCrawlerLifePhase.Emerging) {
        continue;
      }
      const elapsed = (vitality.phaseTime[index] ?? 0) + deltaTime;
      vitality.phaseTime[index] = elapsed;
      this.evaluateTimeline(state, index, elapsed);
    }
  }

  /** 将单个实体的出生时间映射到固定的动态几何混合量。 */
  private evaluateTimeline(state: CurveCrawlerState, index: number, elapsed: number): void {
    const { vitality, animation } = state.data;
    const timing = CURVE_CRAWLER_EMERGENCE_TIMING;
    if (elapsed < 0) {
      hideEmergence(state, index);
      return;
    }

    const crackEnd = timing.crackSeconds;
    const eggGrowthEnd = crackEnd + timing.eggGrowthSeconds;
    const eggBulgeEnd = eggGrowthEnd + timing.eggBulgeSeconds;
    const eggBurstEnd = eggBulgeEnd + timing.eggBurstSeconds;
    const limbGrowthEnd = eggBurstEnd + timing.limbGrowthSeconds;

    if (elapsed < crackEnd) {
      const progress = smoothStep(elapsed / timing.crackSeconds);
      animation.crackSpread[index] = progress;
      animation.crackVisibility[index] = 1;
      return;
    }
    animation.crackSpread[index] = 1;

    if (elapsed < eggGrowthEnd) {
      const progress = smoothStep((elapsed - crackEnd) / timing.eggGrowthSeconds);
      animation.eggScale[index] = progress;
      return;
    }
    animation.eggScale[index] = 1;

    if (elapsed < eggBulgeEnd) {
      const progress = (elapsed - eggGrowthEnd) / timing.eggBulgeSeconds;
      const irregularPulse = 0.84 + Math.abs(Math.sin(progress * Math.PI * 3)) * 0.16;
      animation.eggBulge[index] = smoothStep(progress) * irregularPulse;
      return;
    }
    animation.eggBulge[index] = 1;

    if (elapsed < eggBurstEnd) {
      const progress = smoothStep((elapsed - eggBulgeEnd) / timing.eggBurstSeconds);
      animation.eggBurst[index] = progress;
      animation.emergenceBodyScale[index] = 0.1 * progress;
      return;
    }
    animation.eggBurst[index] = 1;

    if (elapsed < limbGrowthEnd) {
      const progress = (elapsed - eggBurstEnd) / timing.limbGrowthSeconds;
      animation.crackVisibility[index] = 1 - smoothStepBetween(0.52, 1, progress);
      animation.emergenceBodyScale[index] = 0.1 + smoothStep(progress) * 0.9;
      animation.emergenceLegScale[index] = smoothStepBetween(0.08, 1, progress);
      return;
    }

    vitality.phase[index] = CurveCrawlerLifePhase.Alive;
    vitality.phaseTime[index] = 0;
    animation.crackSpread[index] = 0;
    animation.crackVisibility[index] = 0;
    animation.eggScale[index] = 0;
    animation.eggBulge[index] = 0;
    animation.eggBurst[index] = 1;
    animation.emergenceBodyScale[index] = 1;
    animation.emergenceLegScale[index] = 1;
  }
}

/** 将尚未开始的实体保持为零面积出生几何。 */
function hideEmergence(state: CurveCrawlerState, index: number): void {
  const { animation } = state.data;
  animation.crackSpread[index] = 0;
  animation.crackVisibility[index] = 0;
  animation.eggScale[index] = 0;
  animation.eggBulge[index] = 0;
  animation.eggBurst[index] = 0;
  animation.emergenceBodyScale[index] = 0;
  animation.emergenceLegScale[index] = 0;
}

/** 生成具有平滑起止速度的零到一插值。 */
function smoothStep(value: number): number {
  const amount = clamp01(value);
  return amount * amount * (3 - amount * 2);
}

/** 在指定边界之间生成平滑的零到一插值。 */
function smoothStepBetween(edge0: number, edge1: number, value: number): number {
  return smoothStep((value - edge0) / Math.max(edge1 - edge0, 0.000001));
}

/** 将数值约束到零到一之间。 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(value, 1));
}
