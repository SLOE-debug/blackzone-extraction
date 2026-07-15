import { type EntitySystem } from '../../../../../core/entities/entity-system';
import {
  CURVE_CRAWLER_HIT_FLASH_DURATION,
  CurveCrawlerLifePhase,
} from '../model/curve-crawler-life';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 独立处理伤害结算、受击计时和红色闪烁。 */
export class CurveCrawlerHitSystem implements EntitySystem<CurveCrawlerState, number> {
  /** 推进受击计时并刷新每个实体的闪红强度。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { vitality, animation } = state.data;

    for (let index = 0; index < state.count; index++) {
      const hitTime = Math.max(0, (vitality.hitTime[index] ?? 0) - deltaTime);
      vitality.hitTime[index] = hitTime;
      animation.hitFlash[index] = getHitFlash(hitTime);
    }
  }

  /**
   * 对指定实体施加伤害。
   *
   * @returns 本次伤害是否让存活实体的生命值归零。
   */
  public damage(state: CurveCrawlerState, entityId: number, amount: number): boolean {
    if (!Number.isInteger(entityId) || entityId < 0 || entityId >= state.count) {
      throw new Error(`Curve Crawler 实体标识超出范围：${entityId}`);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Curve Crawler 伤害值必须是有限正数。');
    }

    const { identity, vitality } = state.data;
    if ((identity.id[entityId] ?? -1) !== entityId) {
      throw new Error(`Curve Crawler 实体标识与稳定存储索引不一致：${entityId}`);
    }
    if ((vitality.phase[entityId] as CurveCrawlerLifePhase) !== CurveCrawlerLifePhase.Alive) {
      return false;
    }

    const remainingHealth = Math.max(0, (vitality.health[entityId] ?? 0) - amount);
    vitality.health[entityId] = remainingHealth;
    vitality.hitTime[entityId] = CURVE_CRAWLER_HIT_FLASH_DURATION;
    return remainingHealth <= 0;
  }
}

/** 根据剩余受击时间生成快速衰减的红色闪烁强度。 */
function getHitFlash(hitTime: number): number {
  if (hitTime <= 0) {
    return 0;
  }

  const remaining = clamp01(hitTime / CURVE_CRAWLER_HIT_FLASH_DURATION);
  const elapsed = 1 - remaining;
  return remaining * (0.35 + Math.abs(Math.sin(elapsed * Math.PI * 5)) * 0.65);
}

/** 将数值约束到零到一之间。 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(value, 1));
}
