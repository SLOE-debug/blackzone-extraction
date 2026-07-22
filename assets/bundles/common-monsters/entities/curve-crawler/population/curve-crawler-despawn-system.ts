import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  advanceMonsterLifecycleTime,
  transitionMonsterLifecycle,
} from '../../../../../core/monsters/monster-lifecycle-state-machine';
import { EntityRenderDirty } from '../../../../../core/rendering/dynamic-entities/entity-render-dirty';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

export const CURVE_CRAWLER_DESPAWN_SECONDS = 0.45;

/** 播放收腿、下沉与裂缝闭合，并在演出完成后释放槽位。 */
export class CurveCrawlerDespawnSystem {
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { vitality, intent, motion, animation, combat } = state.data;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState)
        !== MonsterLifecycleState.Despawning) {
        continue;
      }
      motion.currentSpeed[index] = 0;
      intent.targetSpeed[index] = 0;
      combat.engaged[index] = 0;
      combat.attackTime[index] = 0;
      const progress = Math.min(
        1,
        advanceMonsterLifecycleTime(vitality, index, deltaTime)
          / CURVE_CRAWLER_DESPAWN_SECONDS,
      );
      const smooth = progress * progress * (3 - 2 * progress);
      animation.emergenceLegScale[index] = 1 - smooth;
      animation.emergenceBodyScale[index] = 1 - smooth * 0.72;
      animation.surfaceCollapse[index] = smooth;
      animation.crackVisibility[index] = 1 - smooth;
      state.renderChanges.mark(index, EntityRenderDirty.Color);
      if (progress >= 1) {
        transitionMonsterLifecycle(vitality, index, MonsterLifecycleState.Dormant);
      }
    }
  }
}
