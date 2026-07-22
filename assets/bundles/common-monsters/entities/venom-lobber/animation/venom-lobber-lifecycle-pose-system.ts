import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { type EntitySystem } from '../../../../../core/entities/entity-system';
import {
  VENOM_LOBBER_DEATH_SECONDS,
  VENOM_LOBBER_DESPAWN_SECONDS,
  VENOM_LOBBER_SPAWN_SECONDS,
} from '../model/venom-lobber-lifecycle';
import { type VenomLobberState } from '../model/venom-lobber-state';

const SPAWN_MOUND_SECONDS = 0.22;
const SPAWN_COCOON_OPEN_SECONDS = 0.52;
const SPAWN_BODY_EXPANDED_SECONDS = 1.1;
const DEATH_STAGGER_SECONDS = 0.18;
const DEATH_LEGS_COLLAPSED_SECONDS = 0.62;
const DEATH_SAC_DEFLATED_SECONDS = 1.05;

/**
 * 统一把出生、死亡与退场时间转换成渲染和六足共同消费的最终姿态。
 *
 * 其他系统不得再次从 `stateTime` 推导生命周期曲线。
 */
export class VenomLobberLifecyclePoseSystem
implements EntitySystem<VenomLobberState, number> {
  public update(state: VenomLobberState, deltaTime: number): void {
    if (!Number.isFinite(deltaTime)) {
      throw new Error('Venom Lobber 生命周期姿态帧时间必须是有限数值。');
    }
    const { vitality } = state.data;
    for (let index = 0; index < state.count; index++) {
      const lifecycle = vitality.state[index] as MonsterLifecycleState;
      const stateTime = vitality.stateTime[index] ?? 0;
      this.writeNeutralPose(state, index);
      switch (lifecycle) {
        case MonsterLifecycleState.Spawning:
          this.writeSpawnPose(state, index, stateTime);
          break;
        case MonsterLifecycleState.Dying:
          this.writeDeathPose(state, index, stateTime);
          break;
        case MonsterLifecycleState.Despawning:
          this.writeDespawnPose(state, index, stateTime);
          break;
        case MonsterLifecycleState.Dormant:
        case MonsterLifecycleState.DeathComplete:
          state.data.animation.lifecycleLegProgress[index] = 0;
          break;
        case MonsterLifecycleState.Alive:
          break;
      }
    }
  }

  private writeNeutralPose(state: VenomLobberState, index: number): void {
    const animation = state.data.animation;
    animation.rootForward[index] = 0;
    animation.rootElevation[index] = 0;
    animation.bodyCompression[index] = 1;
    animation.venomSacScale[index] = 1;
    animation.tailCurl[index] = 0;
    animation.cocoonOpen[index] = 0;
    animation.lifecycleLegProgress[index] = 1;
  }

  private writeSpawnPose(
    state: VenomLobberState,
    index: number,
    stateTime: number,
  ): void {
    const animation = state.data.animation;
    animation.lifecycleLegProgress[index] = 0;
    animation.venomSacScale[index] = 0.7;
    animation.tailCurl[index] = -0.9;
    animation.bodyCompression[index] = 0.22;
    if (stateTime < 0) {
      animation.rootElevation[index] = -12;
      animation.cocoonOpen[index] = -1;
      animation.sacPulse[index] = 0;
      return;
    }
    if (stateTime < SPAWN_MOUND_SECONDS) {
      animation.rootElevation[index] = -12;
      animation.cocoonOpen[index] = 0;
      animation.sacPulse[index] = 0;
      return;
    }
    if (stateTime < SPAWN_COCOON_OPEN_SECONDS) {
      const progress = smoothStep(normalizePhase(
        stateTime,
        SPAWN_MOUND_SECONDS,
        SPAWN_COCOON_OPEN_SECONDS,
      ));
      animation.rootElevation[index] = lerp(-1.6, -0.8, progress);
      animation.bodyCompression[index] = lerp(0.22, 0.32, progress);
      animation.tailCurl[index] = lerp(-0.9, -0.72, progress);
      animation.cocoonOpen[index] = progress;
      animation.sacPulse[index] = Math.sin(progress * Math.PI) * 0.12;
      return;
    }
    if (stateTime < SPAWN_BODY_EXPANDED_SECONDS) {
      const progress = smoothStep(normalizePhase(
        stateTime,
        SPAWN_COCOON_OPEN_SECONDS,
        SPAWN_BODY_EXPANDED_SECONDS,
      ));
      animation.rootElevation[index] = lerp(-0.8, 0, progress);
      animation.bodyCompression[index] = lerp(0.32, 1, progress);
      animation.tailCurl[index] = lerp(-0.72, -0.15, progress);
      animation.cocoonOpen[index] = 1;
      animation.lifecycleLegProgress[index] = progress;
      animation.sacPulse[index] = 0;
      return;
    }
    const settleProgress = smoothStep(normalizePhase(
      stateTime,
      SPAWN_BODY_EXPANDED_SECONDS,
      VENOM_LOBBER_SPAWN_SECONDS,
    ));
    animation.rootElevation[index] = -Math.sin(settleProgress * Math.PI) * 0.12;
    animation.bodyCompression[index] = 1;
    animation.venomSacScale[index] = lerp(0.7, 1, settleProgress);
    animation.tailCurl[index] = lerp(-0.15, 0, settleProgress);
    animation.cocoonOpen[index] = 1 - settleProgress;
    animation.lifecycleLegProgress[index] = 1;
    animation.sacPulse[index] = 0;
  }

  private writeDeathPose(
    state: VenomLobberState,
    index: number,
    stateTime: number,
  ): void {
    const animation = state.data.animation;
    animation.cocoonOpen[index] = 0;
    animation.sacPulse[index] = 0;
    if (stateTime < DEATH_STAGGER_SECONDS) {
      const progress = smoothStep(normalizePhase(stateTime, 0, DEATH_STAGGER_SECONDS));
      animation.rootForward[index] = -Math.sin(progress * Math.PI) * 0.14;
      animation.tailCurl[index] = lerp(0, -0.48, progress);
      return;
    }
    if (stateTime < DEATH_LEGS_COLLAPSED_SECONDS) {
      const progress = smoothStep(normalizePhase(
        stateTime,
        DEATH_STAGGER_SECONDS,
        DEATH_LEGS_COLLAPSED_SECONDS,
      ));
      animation.rootElevation[index] = lerp(0, -0.55, progress);
      animation.bodyCompression[index] = lerp(1, 0.88, progress);
      animation.tailCurl[index] = lerp(-0.48, -0.7, progress);
      animation.lifecycleLegProgress[index] = 1 - progress;
      return;
    }
    animation.rootElevation[index] = -0.55;
    animation.lifecycleLegProgress[index] = 0;
    if (stateTime < DEATH_SAC_DEFLATED_SECONDS) {
      const progress = smoothStep(normalizePhase(
        stateTime,
        DEATH_LEGS_COLLAPSED_SECONDS,
        DEATH_SAC_DEFLATED_SECONDS,
      ));
      animation.bodyCompression[index] = lerp(0.88, 0.78, progress);
      animation.venomSacScale[index] = lerp(1, 0.25, progress);
      animation.tailCurl[index] = lerp(-0.7, -1.08, progress);
      return;
    }
    const collapseProgress = smoothStep(normalizePhase(
      stateTime,
      DEATH_SAC_DEFLATED_SECONDS,
      VENOM_LOBBER_DEATH_SECONDS,
    ));
    animation.rootElevation[index] = -0.55 - collapseProgress * 0.35;
    animation.bodyCompression[index] = lerp(0.78, 0.35, collapseProgress);
    animation.venomSacScale[index] = 0.25;
    animation.tailCurl[index] = -1.08;
  }

  private writeDespawnPose(
    state: VenomLobberState,
    index: number,
    stateTime: number,
  ): void {
    const progress = smoothStep(normalizePhase(
      stateTime,
      0,
      VENOM_LOBBER_DESPAWN_SECONDS,
    ));
    const animation = state.data.animation;
    animation.rootElevation[index] = -progress * 2.4;
    animation.bodyCompression[index] = lerp(1, 0.62, progress);
    animation.tailCurl[index] = -progress * 0.48;
    animation.lifecycleLegProgress[index] = 1 - progress;
    animation.sacPulse[index] = 0;
  }
}

function normalizePhase(value: number, start: number, end: number): number {
  return Math.max(0, Math.min((value - start) / Math.max(end - start, 0.0001), 1));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function smoothStep(value: number): number {
  return value * value * (3 - value * 2);
}
