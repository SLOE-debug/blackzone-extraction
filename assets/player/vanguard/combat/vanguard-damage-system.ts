import { type EntitySystem } from '../../../core/entities/entity-system';
import {
  VANGUARD_HIT_FLASH_DURATION,
  VanguardLifePhase,
} from '../model/vanguard-life';
import { type VanguardState } from '../model/vanguard-state';

/** 独立处理主角伤害、生命阶段和短时受击闪烁。 */
export class VanguardDamageSystem implements EntitySystem<VanguardState, number> {
  /** 推进受击计时，并把剩余时间转换为连续闪烁强度。 */
  public update(state: VanguardState, deltaTime: number): void {
    const { vitality, animation } = state.data;
    for (let index = 0; index < state.count; index++) {
      const hitTime = Math.max(0, (vitality.hitTime[index] ?? 0) - deltaTime);
      vitality.hitTime[index] = hitTime;
      animation.hitFlash[index] = Math.min(1, hitTime / VANGUARD_HIT_FLASH_DURATION);
    }
  }

  /**
   * 对仍存活的主角施加伤害。
   *
   * @returns 本次伤害是否让主角生命值归零。
   */
  public damage(state: VanguardState, amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('主角伤害值必须是有限正数。');
    }
    const { vitality, animation } = state.data;
    if ((vitality.phase[0] as VanguardLifePhase) !== VanguardLifePhase.Alive) {
      return false;
    }
    const remainingHealth = Math.max(0, (vitality.health[0] ?? 0) - amount);
    vitality.health[0] = remainingHealth;
    vitality.hitTime[0] = VANGUARD_HIT_FLASH_DURATION;
    animation.hitFlash[0] = 1;
    if (remainingHealth > 0) {
      return false;
    }
    vitality.phase[0] = VanguardLifePhase.Defeated;
    return true;
  }
}
