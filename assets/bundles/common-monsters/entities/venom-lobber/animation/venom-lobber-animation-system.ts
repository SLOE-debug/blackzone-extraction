import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { VenomLobberAction } from '../model/venom-lobber-action';
import { type VenomLobberState } from '../model/venom-lobber-state';
import { type VenomLobberData } from '../model/venom-lobber-schema';
import {
  VENOM_LOBBER_DEATH_SECONDS,
  VENOM_LOBBER_DESPAWN_SECONDS,
  VENOM_LOBBER_SPAWN_SECONDS,
} from '../model/venom-lobber-lifecycle';
import {
  calculateVenomLobberSpawnLandingBob,
  calculateVenomLobberSpawnRootElevation,
  calculateVenomLobberSpawnRootForward,
  calculateVenomLobberSpawnRootPitch,
} from './venom-lobber-spawn-pose';

/** 从动作、速度和施法时间派生身体起伏、尾刺蓄力与毒囊脉冲。 */
export class VenomLobberAnimationSystem implements EntitySystem<VenomLobberState, number> {
  public update(state: VenomLobberState, deltaTime: number): void {
    const { vitality, behavior, combat, motion, animation } = state.data;
    for (let index = 0; index < state.count; index++) {
      const lifecycle = vitality.state[index] as MonsterLifecycleState;
      if (lifecycle === MonsterLifecycleState.Spawning) {
        const stateTime = vitality.stateTime[index] ?? 0;
        const progress = clamp01(stateTime / VENOM_LOBBER_SPAWN_SECONDS);
        writeSpawnRootPose(animation, index, stateTime);
        animation.tailCharge[index] = 1 - smoothStep(clamp01((stateTime - 0.12) / 0.78));
        const landingPulse = stateTime >= 1.35
          ? Math.sin(clamp01((stateTime - 1.35) / 0.25) * Math.PI) * 0.58
          : 0;
        animation.sacPulse[index] = stateTime < 0.25
          ? 0.08 + Math.sin(progress * Math.PI * 4) * 0.04
          : landingPulse;
        animation.bodyBob[index] = calculateVenomLobberSpawnLandingBob(stateTime);
        continue;
      }
      animation.spawnRootForward[index] = 0;
      animation.spawnRootElevation[index] = 0;
      animation.spawnRootPitch[index] = 0;
      if (lifecycle === MonsterLifecycleState.Dying) {
        const stateTime = vitality.stateTime[index] ?? 0;
        const progress = clamp01(stateTime / VENOM_LOBBER_DEATH_SECONDS);
        animation.tailCharge[index] = -smoothStep(Math.min(1, stateTime / 0.18)) * 0.55;
        animation.sacPulse[index] = Math.abs(Math.sin(
          Math.min(stateTime, 0.68) / 0.68 * Math.PI * 2,
        )) * (1 - progress) * 0.34;
        animation.bodyBob[index] = 0;
        continue;
      }
      if (lifecycle === MonsterLifecycleState.Despawning) {
        const progress = clamp01((vitality.stateTime[index] ?? 0)
          / VENOM_LOBBER_DESPAWN_SECONDS);
        animation.tailCharge[index] = -smoothStep(progress) * 0.48;
        animation.sacPulse[index] = 0;
        animation.bodyBob[index] = 0;
        continue;
      }
      if (lifecycle !== MonsterLifecycleState.Alive) {
        animation.tailCharge[index] = 0;
        animation.sacPulse[index] = 0;
        animation.bodyBob[index] = 0;
        continue;
      }
      const speed = Math.abs(motion.currentSpeed[index] ?? 0);
      const phase = animation.gaitPhase[index] ?? 0;
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

function writeSpawnRootPose(
  animation: VenomLobberData['animation'],
  index: number,
  stateTime: number,
): void {
  animation.spawnRootForward[index] = calculateVenomLobberSpawnRootForward(stateTime);
  animation.spawnRootElevation[index] = calculateVenomLobberSpawnRootElevation(stateTime);
  animation.spawnRootPitch[index] = calculateVenomLobberSpawnRootPitch(stateTime);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

function smoothStep(value: number): number {
  return value * value * (3 - value * 2);
}
