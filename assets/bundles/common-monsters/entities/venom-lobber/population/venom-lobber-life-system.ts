import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  advanceMonsterLifecycleTime,
  transitionMonsterLifecycle,
} from '../../../../../core/monsters/monster-lifecycle-state-machine';
import { type VenomLobberState } from '../model/venom-lobber-state';
import { type VenomBombSystem } from '../behavior/venom-bomb-system';
import {
  VENOM_LOBBER_DEATH_SECONDS,
  VENOM_LOBBER_DEATH_RESIDUE_START_SECONDS,
  VENOM_LOBBER_DESPAWN_SECONDS,
  VENOM_LOBBER_SPAWN_SECONDS,
} from '../model/venom-lobber-lifecycle';

const HIT_FLASH_SECONDS = 0.18;

/** 管理 Venom Lobber 的出生、受击与死亡完成状态。 */
export class VenomLobberLifeSystem {
  constructor(private readonly effects: VenomBombSystem) {}

  public update(state: VenomLobberState, deltaTime: number): void {
    const { vitality, animation, motion, intent, combat } = state.data;
    for (let index = 0; index < state.count; index++) {
      const hitTime = Math.max(0, (vitality.hitTime[index] ?? 0) - deltaTime);
      vitality.hitTime[index] = hitTime;
      vitality.timeSinceHit[index] = (vitality.timeSinceHit[index] ?? 0) + deltaTime;
      animation.hitFlash[index] = Math.min(1, hitTime / HIT_FLASH_SECONDS);
      const lifecycle = vitality.state[index] as MonsterLifecycleState;
      if (lifecycle === MonsterLifecycleState.Spawning) {
        if (advanceMonsterLifecycleTime(vitality, index, deltaTime)
          >= VENOM_LOBBER_SPAWN_SECONDS) {
          transitionMonsterLifecycle(vitality, index, MonsterLifecycleState.Alive);
        }
      } else if (lifecycle === MonsterLifecycleState.Dying) {
        const stateTime = advanceMonsterLifecycleTime(vitality, index, deltaTime);
        if (stateTime >= VENOM_LOBBER_DEATH_RESIDUE_START_SECONDS
          && (vitality.deathEffectSpawned[index] ?? 0) === 0) {
          const { transform, morphology } = state.data;
          this.effects.deaths.spawn(
            index,
            transform.x[index] ?? 0,
            transform.y[index] ?? 0,
            morphology.scale[index] ?? 1,
          );
          vitality.deathEffectSpawned[index] = 1;
        }
        motion.currentSpeed[index] = 0;
        intent.targetSpeed[index] = 0;
        combat.engaged[index] = 0;
        if (stateTime >= VENOM_LOBBER_DEATH_SECONDS) {
          transitionMonsterLifecycle(vitality, index, MonsterLifecycleState.DeathComplete);
        }
      } else if (lifecycle === MonsterLifecycleState.Despawning) {
        motion.currentSpeed[index] = 0;
        intent.targetSpeed[index] = 0;
        combat.engaged[index] = 0;
        combat.castTime[index] = 0;
        combat.meleeTime[index] = 0;
        if (advanceMonsterLifecycleTime(vitality, index, deltaTime)
          >= VENOM_LOBBER_DESPAWN_SECONDS) {
          transitionMonsterLifecycle(vitality, index, MonsterLifecycleState.Dormant);
        }
      }
    }
  }

  /** 对稳定实体标识施加伤害，并在生命耗尽时开始死亡收拢。 */
  public damage(state: VenomLobberState, entityId: number, amount: number): void {
    if (!Number.isInteger(entityId)
      || entityId < 0
      || entityId >= state.count
      || !Number.isFinite(amount)
      || amount <= 0) {
      throw new Error('Venom Lobber 伤害目标与数值无效。');
    }
    const { vitality, combat, intent } = state.data;
    if ((vitality.state[entityId] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
      return;
    }
    const health = Math.max(0, (vitality.health[entityId] ?? 0) - amount);
    vitality.health[entityId] = health;
    vitality.hitTime[entityId] = HIT_FLASH_SECONDS;
    vitality.timeSinceHit[entityId] = 0;
    if (health > 0) {
      return;
    }
    transitionMonsterLifecycle(vitality, entityId, MonsterLifecycleState.Dying);
    vitality.deathEffectSpawned[entityId] = 0;
    combat.engaged[entityId] = 0;
    combat.castTime[entityId] = 0;
    combat.projectileReleased[entityId] = 0;
    combat.meleeTime[entityId] = 0;
    combat.meleeHitApplied[entityId] = 0;
    intent.targetSpeed[entityId] = 0;
  }
}
