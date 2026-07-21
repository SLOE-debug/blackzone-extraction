import {
  isMonsterLifecycleResident,
  MonsterLifecycleState,
} from '../../../../../core/contracts/monster-lifecycle';
import {
  MonsterPopulationActivationSystem,
  type MonsterPopulationActivationTarget,
} from '../../../../../core/monsters/monster-population-activation-system';
import { transitionMonsterLifecycle } from '../../../../../core/monsters/monster-lifecycle-state-machine';
import { randomRange } from '../../../../../core/math/xorshift32';
import { VenomLobberAction } from '../model/venom-lobber-action';
import {
  type VenomLobberRepopulationOptions,
  validateVenomLobberRepopulationOptions,
} from '../model/venom-lobber-repopulation-options';
import {
  VENOM_LOBBER_MAX_HEALTH,
  type VenomLobberState,
} from '../model/venom-lobber-state';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SPAWN_STAGGER_SECONDS = 0.34;

/** 在固定 SoA 容量中错峰激活并回收 Venom Lobber。 */
export class VenomLobberRepopulationSystem
implements MonsterPopulationActivationTarget<VenomLobberRepopulationOptions> {
  private readonly activation = new MonsterPopulationActivationSystem<
    VenomLobberRepopulationOptions
  >();
  private spawnSequence = 0;

  constructor(private readonly state: VenomLobberState) {}

  public get capacity(): number {
    return this.state.count;
  }

  public getLifecycleState(entityIndex: number): MonsterLifecycleState {
    return this.state.data.vitality.state[entityIndex] as MonsterLifecycleState;
  }

  public beginSpawning(
    entityIndex: number,
    options: Readonly<VenomLobberRepopulationOptions>,
    delaySeconds: number,
  ): void {
    const { identity, transform, vitality, behavior, combat, intent, motion, animation } =
      this.state.data;
    const angle = this.spawnSequence * GOLDEN_ANGLE
      + randomRange(identity.randomState, entityIndex, -0.18, 0.18);
    this.spawnSequence = (this.spawnSequence + 1) % 0x1000000;
    const innerSquared = options.spawnInnerRadius * options.spawnInnerRadius;
    const outerSquared = options.spawnOuterRadius * options.spawnOuterRadius;
    const radius = Math.sqrt(randomRange(
      identity.randomState,
      entityIndex,
      innerSquared,
      outerSquared,
    ));
    transform.x[entityIndex] = options.centerX + Math.cos(angle) * radius;
    transform.y[entityIndex] = options.centerY + Math.sin(angle) * radius;
    transform.heading[entityIndex] = angle + Math.PI;
    transform.targetHeading[entityIndex] = angle + Math.PI;
    transitionMonsterLifecycle(
      vitality,
      entityIndex,
      MonsterLifecycleState.Spawning,
      -(delaySeconds + randomRange(identity.randomState, entityIndex, 0, 0.2)),
    );
    vitality.health[entityIndex] = VENOM_LOBBER_MAX_HEALTH;
    vitality.hitTime[entityIndex] = 0;
    behavior.action[entityIndex] = VenomLobberAction.Roam;
    behavior.actionTime[entityIndex] = 0;
    behavior.nextTurnTime[entityIndex] = randomRange(
      identity.randomState,
      entityIndex,
      0.8,
      2.8,
    );
    combat.engaged[entityIndex] = 0;
    combat.castTime[entityIndex] = 0;
    combat.castCooldown[entityIndex] = randomRange(
      identity.randomState,
      entityIndex,
      1.4,
      3.8,
    );
    combat.projectileReleased[entityIndex] = 0;
    intent.targetSpeed[entityIndex] = 0;
    intent.turnRate[entityIndex] = 2.8;
    motion.currentSpeed[entityIndex] = 0;
    animation.bodyBob[entityIndex] = 0;
    animation.tailCharge[entityIndex] = 0;
    animation.sacPulse[entityIndex] = 0;
    animation.hitFlash[entityIndex] = 0;
  }

  /** 回收远处实体，并把当前驻留数补到波次目标。 */
  public maintainAround(options: Readonly<VenomLobberRepopulationOptions>): void {
    validateVenomLobberRepopulationOptions(options, this.state.count);
    this.recycleDistant(options);
    this.activation.synchronize(
      this,
      options,
      options.desiredPopulationCount,
      SPAWN_STAGGER_SECONDS,
    );
  }

  public countAlive(): number {
    let count = 0;
    for (let index = 0; index < this.state.count; index++) {
      if ((this.state.data.vitality.state[index] as MonsterLifecycleState)
        === MonsterLifecycleState.Alive) {
        count++;
      }
    }
    return count;
  }

  public hasResidents(): boolean {
    for (let index = 0; index < this.state.count; index++) {
      if (isMonsterLifecycleResident(
        this.state.data.vitality.state[index] as MonsterLifecycleState,
      )) {
        return true;
      }
    }
    return false;
  }

  private recycleDistant(options: Readonly<VenomLobberRepopulationOptions>): void {
    const { transform, vitality, motion, intent, combat } = this.state.data;
    const maximumDistanceSquared = options.recycleRadius * options.recycleRadius;
    for (let index = 0; index < this.state.count; index++) {
      const lifecycle = vitality.state[index] as MonsterLifecycleState;
      if (lifecycle !== MonsterLifecycleState.Alive
        && lifecycle !== MonsterLifecycleState.Spawning) {
        continue;
      }
      const deltaX = (transform.x[index] ?? 0) - options.centerX;
      const deltaY = (transform.y[index] ?? 0) - options.centerY;
      if (deltaX * deltaX + deltaY * deltaY <= maximumDistanceSquared) {
        continue;
      }
      transitionMonsterLifecycle(vitality, index, MonsterLifecycleState.Dormant);
      motion.currentSpeed[index] = 0;
      intent.targetSpeed[index] = 0;
      combat.engaged[index] = 0;
      combat.castTime[index] = 0;
    }
  }
}
