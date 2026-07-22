import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { EntityTable } from '../../../../../core/entities/entity-table';
import { mixRandomSeed, randomRange } from '../../../../../core/math/xorshift32';
import { TAU } from '../../../../../core/math/scalar';
import { VenomLobberAction } from './venom-lobber-action';
import { type NormalizedVenomLobberOptions } from './venom-lobber-options';
import { VENOM_LOBBER_INITIAL_ATTACK_LOCK_SECONDS } from './venom-lobber-lifecycle';
import {
  VENOM_LOBBER_SCHEMA,
  type VenomLobberData,
  type VenomLobberTable,
} from './venom-lobber-schema';

export const VENOM_LOBBER_MAX_HEALTH = 240;

/** 聚合 Venom Lobber 固定容量 SoA 状态。 */
export class VenomLobberState {
  public readonly table: VenomLobberTable;
  public readonly data: VenomLobberData;

  constructor(options: Readonly<NormalizedVenomLobberOptions>) {
    this.table = new EntityTable(VENOM_LOBBER_SCHEMA, options.count);
    this.table.allocate(options.count);
    this.data = this.table.data;
    initializeState(this, options);
  }

  public get count(): number {
    return this.table.count;
  }
}

function initializeState(
  state: VenomLobberState,
  options: Readonly<NormalizedVenomLobberOptions>,
): void {
  const { identity, transform, morphology, vitality } = state.data;
  const { behavior, combat, intent, motion, animation } = state.data;
  for (let index = 0; index < state.count; index++) {
    identity.id[index] = index;
    identity.randomState[index] = mixRandomSeed(options.seed, index);
    identity.appearanceSeed[index] = mixRandomSeed(options.seed ^ 0x6c8e9cf, index);
    transform.x[index] = options.spawnArea.centerX;
    transform.y[index] = options.spawnArea.centerY;
    const heading = randomRange(identity.randomState, index, -Math.PI, Math.PI);
    transform.heading[index] = heading;
    transform.targetHeading[index] = heading;
    morphology.scale[index] = randomRange(identity.randomState, index, 0.9, 1.13);
    morphology.cruiseSpeed[index] = randomRange(identity.randomState, index, 5.2, 7.2);
    morphology.arcHeight[index] = randomRange(identity.randomState, index, 17, 28);
    morphology.scatterRadius[index] = randomRange(identity.randomState, index, 1.2, 3.5);
    vitality.health[index] = VENOM_LOBBER_MAX_HEALTH;
    vitality.state[index] = index < options.initialPopulationCount
      ? MonsterLifecycleState.Spawning
      : MonsterLifecycleState.Dormant;
    vitality.stateTime[index] = index < options.initialPopulationCount ? -index * 0.22 : 0;
    vitality.hitTime[index] = 0;
    vitality.timeSinceHit[index] = 1;
    vitality.deathEffectSpawned[index] = 0;
    behavior.action[index] = VenomLobberAction.Roam;
    behavior.actionTime[index] = 0;
    behavior.nextTurnTime[index] = randomRange(identity.randomState, index, 0.8, 3.2);
    combat.engaged[index] = 0;
    combat.castTime[index] = 0;
    combat.castCooldown[index] = randomRange(identity.randomState, index, 1.2, 4.5);
    combat.projectileReleased[index] = 0;
    combat.meleeTime[index] = 0;
    combat.meleeCooldown[index] = randomRange(identity.randomState, index, 0.2, 1.1);
    combat.meleeHitApplied[index] = 0;
    combat.attackLock[index] = VENOM_LOBBER_INITIAL_ATTACK_LOCK_SECONDS;
    intent.targetSpeed[index] = 0;
    intent.turnRate[index] = 2.6;
    motion.currentSpeed[index] = 0;
    animation.gaitPhase[index] = randomRange(identity.randomState, index, 0, TAU);
    animation.bodyBob[index] = 0;
    animation.tailCharge[index] = 0;
    animation.sacPulse[index] = 0;
    animation.hitFlash[index] = 0;
  }
}
