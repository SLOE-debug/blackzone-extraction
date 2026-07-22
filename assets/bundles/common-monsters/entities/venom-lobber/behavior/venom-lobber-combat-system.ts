import { type PlanarMonsterCombatTarget } from '../../../../../core/contracts/monster-combat';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { nextRandom, randomRange } from '../../../../../core/math/xorshift32';
import { VenomLobberAction } from '../model/venom-lobber-action';
import { type VenomLobberCombatOptions } from '../model/venom-lobber-combat-options';
import { type VenomLobberState } from '../model/venom-lobber-state';
import {
  type MutableVenomLobberTailSocket,
  writeVenomLobberTailSocket,
} from '../model/venom-lobber-tail-socket';
import { VenomBombSystem } from './venom-bomb-system';

const CAST_TURN_RATE = 7.5;
const ROAM_TURN_RATE = 1.9;

/** 负责感知、保持投掷距离、尾刺蓄力和无分配毒弹生成。 */
export class VenomLobberCombatSystem {
  public readonly effects: VenomBombSystem;
  private targetActive = false;
  private targetX = 0;
  private targetY = 0;
  private targetCollisionRadius = 0;
  private pendingMeleeDamage = 0;
  private readonly tailSocket: MutableVenomLobberTailSocket = { x: 0, y: 0 };

  constructor(
    populationCapacity: number,
    private readonly options: Readonly<VenomLobberCombatOptions>,
  ) {
    this.effects = new VenomBombSystem(populationCapacity, options);
  }

  public synchronizeTarget(target: Readonly<PlanarMonsterCombatTarget>): void {
    if (!Number.isFinite(target.x)
      || !Number.isFinite(target.y)
      || !Number.isFinite(target.collisionRadius)
      || target.collisionRadius < 0) {
      throw new Error('Venom Lobber 战斗目标必须使用有限坐标和非负半径。');
    }
    this.targetX = target.x;
    this.targetY = target.y;
    this.targetCollisionRadius = target.collisionRadius;
    this.targetActive = true;
  }

  /** 取消尚未释放的施法；已经在途的毒弹和酸池继续完成生命周期。 */
  public clearTarget(state: VenomLobberState): void {
    this.targetActive = false;
    for (let index = 0; index < state.count; index++) {
      this.disengage(state, index);
    }
  }

  public update(state: VenomLobberState, deltaTime: number): void {
    this.pendingMeleeDamage = 0;
    const { identity, transform, morphology, vitality, behavior, combat, intent } = state.data;
    for (let index = 0; index < state.count; index++) {
      combat.castCooldown[index] = Math.max(
        0,
        (combat.castCooldown[index] ?? 0) - deltaTime,
      );
      combat.meleeCooldown[index] = Math.max(
        0,
        (combat.meleeCooldown[index] ?? 0) - deltaTime,
      );
      combat.attackLock[index] = Math.max(0, (combat.attackLock[index] ?? 0) - deltaTime);
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        this.disengage(state, index);
        continue;
      }
      if (!this.targetActive) {
        this.roam(state, index, deltaTime);
        continue;
      }
      if ((combat.attackLock[index] ?? 0) > 0) {
        this.roam(state, index, deltaTime);
        continue;
      }
      const deltaX = this.targetX - (transform.x[index] ?? 0);
      const deltaY = this.targetY - (transform.y[index] ?? 0);
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const engaged = (combat.engaged[index] ?? 0) !== 0;
      if (!engaged
        && distanceSquared <= this.options.detectionRadius * this.options.detectionRadius) {
        combat.engaged[index] = 1;
      } else if (engaged
        && distanceSquared > this.options.disengageRadius * this.options.disengageRadius) {
        this.disengage(state, index);
        this.roam(state, index, deltaTime);
        continue;
      } else if (!engaged) {
        this.roam(state, index, deltaTime);
        continue;
      }

      const action = behavior.action[index] as VenomLobberAction;
      if (action === VenomLobberAction.MeleeWindup) {
        this.updateMeleeWindup(state, index, deltaTime, distanceSquared);
        continue;
      }
      if (action === VenomLobberAction.MeleeRecover) {
        this.updateMeleeRecovery(state, index, deltaTime);
        continue;
      }
      if (action === VenomLobberAction.Cast) {
        this.updateCast(state, index, deltaTime);
        continue;
      }
      if (action === VenomLobberAction.Recover) {
        this.updateRecovery(state, index, deltaTime);
        continue;
      }
      transform.targetHeading[index] = Math.atan2(deltaY, deltaX);
      const meleeContactRange = this.options.meleeRange + this.targetCollisionRadius;
      if (distanceSquared <= meleeContactRange * meleeContactRange) {
        if ((combat.meleeCooldown[index] ?? 0) <= 0) {
          this.startMelee(state, index);
        } else {
          behavior.action[index] = VenomLobberAction.Retreat;
          transform.targetHeading[index] = Math.atan2(-deltaY, -deltaX);
          intent.targetSpeed[index] = (morphology.cruiseSpeed[index] ?? 0) * 0.72;
          intent.turnRate[index] = 5.2;
        }
        continue;
      }
      if (distanceSquared
        > this.options.preferredMaximumRange * this.options.preferredMaximumRange) {
        behavior.action[index] = VenomLobberAction.Approach;
        intent.targetSpeed[index] = (morphology.cruiseSpeed[index] ?? 0)
          * this.options.pursuitSpeedMultiplier;
        intent.turnRate[index] = 3.8;
        continue;
      }
      if (distanceSquared
        < this.options.preferredMinimumRange * this.options.preferredMinimumRange) {
        behavior.action[index] = VenomLobberAction.Retreat;
        transform.targetHeading[index] = Math.atan2(-deltaY, -deltaX);
        intent.targetSpeed[index] = (morphology.cruiseSpeed[index] ?? 0)
          * this.options.retreatSpeedMultiplier;
        intent.turnRate[index] = 4.5;
        continue;
      }
      if ((combat.castCooldown[index] ?? 0) <= 0) {
        this.startCast(state, index);
        continue;
      }
      const strafeDirection = ((identity.appearanceSeed[index] ?? 0) & 1) === 0 ? 1 : -1;
      behavior.action[index] = VenomLobberAction.Strafe;
      transform.targetHeading[index] = (transform.targetHeading[index] ?? 0)
        + strafeDirection * Math.PI * 0.5;
      intent.targetSpeed[index] = (morphology.cruiseSpeed[index] ?? 0) * 0.58;
      intent.turnRate[index] = 3.4;
    }
    this.effects.update(
      deltaTime,
      this.targetActive,
      this.targetX,
      this.targetY,
      this.targetCollisionRadius,
    );
  }

  public consumeDamage(): number {
    const damage = this.effects.consumeDamage() + this.pendingMeleeDamage;
    this.pendingMeleeDamage = 0;
    return damage;
  }

  public get movementMultiplier(): number {
    return this.effects.movementMultiplier;
  }

  private startCast(state: VenomLobberState, index: number): void {
    const { behavior, combat, intent } = state.data;
    behavior.action[index] = VenomLobberAction.Cast;
    behavior.actionTime[index] = this.options.castWindupSeconds;
    combat.castTime[index] = 0;
    combat.projectileReleased[index] = 0;
    intent.targetSpeed[index] = 0;
    intent.turnRate[index] = CAST_TURN_RATE;
  }

  /** 进入带短距离扑击的近战前摇，命中只会在本次动作中结算一次。 */
  private startMelee(state: VenomLobberState, index: number): void {
    const { behavior, combat, intent, morphology } = state.data;
    behavior.action[index] = VenomLobberAction.MeleeWindup;
    behavior.actionTime[index] = this.options.meleeWindupSeconds;
    combat.meleeTime[index] = 0;
    combat.meleeHitApplied[index] = 0;
    intent.targetSpeed[index] = (morphology.cruiseSpeed[index] ?? 0)
      * this.options.meleeLungeSpeedMultiplier;
    intent.turnRate[index] = 8.5;
  }

  /** 推进扑击并在动作峰值重新检查距离，避免隔空锁定伤害。 */
  private updateMeleeWindup(
    state: VenomLobberState,
    index: number,
    deltaTime: number,
    distanceSquared: number,
  ): void {
    const { transform, morphology, behavior, combat, intent } = state.data;
    const elapsed = (combat.meleeTime[index] ?? 0) + deltaTime;
    combat.meleeTime[index] = elapsed;
    transform.targetHeading[index] = Math.atan2(
      this.targetY - (transform.y[index] ?? 0),
      this.targetX - (transform.x[index] ?? 0),
    );
    const progress = Math.min(1, elapsed / this.options.meleeWindupSeconds);
    intent.targetSpeed[index] = progress < 0.54
      ? (morphology.cruiseSpeed[index] ?? 0) * this.options.meleeLungeSpeedMultiplier
      : 0;
    intent.turnRate[index] = 8.5;
    if ((combat.meleeHitApplied[index] ?? 0) === 0 && progress >= 0.62) {
      combat.meleeHitApplied[index] = 1;
      const hitRange = this.options.meleeRange + this.targetCollisionRadius + 0.7;
      if (distanceSquared <= hitRange * hitRange) {
        this.pendingMeleeDamage += this.options.meleeDamage;
      }
    }
    if (elapsed < this.options.meleeWindupSeconds) {
      return;
    }
    behavior.action[index] = VenomLobberAction.MeleeRecover;
    behavior.actionTime[index] = this.options.meleeRecoverySeconds;
    combat.meleeTime[index] = 0;
    intent.targetSpeed[index] = 0;
  }

  /** 收回前肢与螯口，结束后再允许下一次近战扑击。 */
  private updateMeleeRecovery(
    state: VenomLobberState,
    index: number,
    deltaTime: number,
  ): void {
    const { behavior, combat, intent } = state.data;
    const remaining = Math.max(0, (behavior.actionTime[index] ?? 0) - deltaTime);
    behavior.actionTime[index] = remaining;
    intent.targetSpeed[index] = 0;
    intent.turnRate[index] = 6.5;
    if (remaining > 0) {
      return;
    }
    behavior.action[index] = VenomLobberAction.Roam;
    combat.meleeCooldown[index] = this.options.meleeCooldownSeconds;
    combat.meleeHitApplied[index] = 0;
  }

  private updateCast(state: VenomLobberState, index: number, deltaTime: number): void {
    const { identity, transform, morphology, behavior, combat, intent } = state.data;
    const elapsed = (combat.castTime[index] ?? 0) + deltaTime;
    combat.castTime[index] = elapsed;
    transform.targetHeading[index] = Math.atan2(
      this.targetY - (transform.y[index] ?? 0),
      this.targetX - (transform.x[index] ?? 0),
    );
    intent.targetSpeed[index] = 0;
    intent.turnRate[index] = CAST_TURN_RATE;
    const releaseTime = this.options.castWindupSeconds * 0.68;
    if ((combat.projectileReleased[index] ?? 0) === 0 && elapsed >= releaseTime) {
      const scatterAngle = randomRange(identity.randomState, index, -Math.PI, Math.PI);
      const scatterRadius = Math.sqrt(nextRandom(identity.randomState, index))
        * (morphology.scatterRadius[index] ?? 0);
      const heading = transform.heading[index] ?? 0;
      const scale = morphology.scale[index] ?? 1;
      writeVenomLobberTailSocket(
        this.tailSocket,
        transform.x[index] ?? 0,
        transform.y[index] ?? 0,
        heading,
        scale,
        state.data.animation.tailCharge[index] ?? 0,
      );
      const launched = this.effects.spawn(
        this.tailSocket.x,
        this.tailSocket.y,
        this.targetX + Math.cos(scatterAngle) * scatterRadius,
        this.targetY + Math.sin(scatterAngle) * scatterRadius,
        morphology.arcHeight[index] ?? 20,
        this.options.projectileStartElevation * scale,
      );
      combat.projectileReleased[index] = launched ? 1 : 0;
    }
    if (elapsed < this.options.castWindupSeconds) {
      return;
    }
    behavior.action[index] = VenomLobberAction.Recover;
    behavior.actionTime[index] = this.options.castRecoverySeconds;
    combat.castTime[index] = 0;
  }

  private updateRecovery(
    state: VenomLobberState,
    index: number,
    deltaTime: number,
  ): void {
    const { identity, behavior, combat, intent } = state.data;
    const remaining = Math.max(0, (behavior.actionTime[index] ?? 0) - deltaTime);
    behavior.actionTime[index] = remaining;
    intent.targetSpeed[index] = 0;
    intent.turnRate[index] = CAST_TURN_RATE;
    if (remaining > 0) {
      return;
    }
    behavior.action[index] = VenomLobberAction.Roam;
    combat.castCooldown[index] = randomRange(
      identity.randomState,
      index,
      this.options.minimumCooldownSeconds,
      this.options.maximumCooldownSeconds,
    );
    combat.projectileReleased[index] = 0;
    combat.meleeTime[index] = 0;
    combat.meleeHitApplied[index] = 0;
  }

  private roam(state: VenomLobberState, index: number, deltaTime: number): void {
    const { identity, transform, morphology, behavior, intent } = state.data;
    behavior.action[index] = VenomLobberAction.Roam;
    behavior.nextTurnTime[index] = (behavior.nextTurnTime[index] ?? 0) - deltaTime;
    if ((behavior.nextTurnTime[index] ?? 0) <= 0) {
      transform.targetHeading[index] = (transform.targetHeading[index] ?? 0)
        + randomRange(identity.randomState, index, -0.85, 0.85);
      behavior.nextTurnTime[index] = randomRange(identity.randomState, index, 1.1, 3.8);
    }
    intent.targetSpeed[index] = (morphology.cruiseSpeed[index] ?? 0) * 0.42;
    intent.turnRate[index] = ROAM_TURN_RATE;
  }

  private disengage(state: VenomLobberState, index: number): void {
    const { behavior, combat, intent } = state.data;
    combat.engaged[index] = 0;
    combat.castTime[index] = 0;
    combat.projectileReleased[index] = 0;
    combat.meleeTime[index] = 0;
    combat.meleeHitApplied[index] = 0;
    behavior.action[index] = VenomLobberAction.Roam;
    behavior.actionTime[index] = 0;
    intent.targetSpeed[index] = 0;
  }
}
