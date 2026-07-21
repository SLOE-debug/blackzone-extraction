import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { TAU } from '../../../../../core/math/scalar';
import { VenomLobberAction } from '../model/venom-lobber-action';
import { type VenomLobberState } from '../model/venom-lobber-state';

/** 从动作、速度和施法时间派生身体起伏、尾刺蓄力与毒囊脉冲。 */
export class VenomLobberAnimationSystem implements EntitySystem<VenomLobberState, number> {
  public update(state: VenomLobberState, deltaTime: number): void {
    const { vitality, behavior, combat, motion, animation } = state.data;
    for (let index = 0; index < state.count; index++) {
      const lifecycle = vitality.state[index] as MonsterLifecycleState;
      if (lifecycle !== MonsterLifecycleState.Alive) {
        animation.tailCharge[index] = 0;
        animation.sacPulse[index] = 0;
        animation.bodyBob[index] = 0;
        continue;
      }
      const speed = Math.abs(motion.currentSpeed[index] ?? 0);
      const phase = ((animation.gaitPhase[index] ?? 0) + deltaTime * (1.4 + speed * 0.32))
        % TAU;
      animation.gaitPhase[index] = phase;
      animation.bodyBob[index] = Math.sin(phase * 2) * Math.min(0.28, speed * 0.025);
      const action = behavior.action[index] as VenomLobberAction;
      const releaseTime = Math.max((behavior.actionTime[index] ?? 1) * 0.68, 0.01);
      const chargeProgress = action === VenomLobberAction.Cast
        && (combat.projectileReleased[index] ?? 0) === 0
        ? Math.min(1, (combat.castTime[index] ?? 0) / releaseTime)
        : 0;
      const smoothCharge = chargeProgress * chargeProgress * (3 - chargeProgress * 2);
      animation.tailCharge[index] = chargeProgress > 0
        ? smoothCharge
        : Math.max(0, (animation.tailCharge[index] ?? 0) - deltaTime * 7.5);
      animation.sacPulse[index] = 0.18 + (animation.tailCharge[index] ?? 0) * 0.82;
    }
  }
}
