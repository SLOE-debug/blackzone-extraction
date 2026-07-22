import {
  type MonsterCombatPopulation,
  type PlanarMonsterCombatTarget,
} from '../../../../../core/contracts/monster-combat';
import {
  type MutablePlanarMonsterHitResult,
  type PlanarMonsterHitPopulation,
  type PlanarMonsterHitQuery,
} from '../../../../../core/contracts/monster-hit';
import {
  type MutablePlanarTargetResult,
  type PlanarTargetPopulation,
  type PlanarTargetQuery,
} from '../../../../../core/contracts/planar-target';
import { type Node } from 'cc';
import { VenomLobberAnimationSystem } from '../animation/venom-lobber-animation-system';
import { VenomLobberCombatSystem } from '../behavior/venom-lobber-combat-system';
import { normalizeVenomLobberCombatOptions } from '../model/venom-lobber-combat-options';
import {
  normalizeVenomLobberOptions,
  type VenomLobberPopulationOptions,
} from '../model/venom-lobber-options';
import { type VenomLobberRepopulationOptions } from '../model/venom-lobber-repopulation-options';
import { VenomLobberState } from '../model/venom-lobber-state';
import { VenomLobberMovementSystem } from '../movement/venom-lobber-movement-system';
import { VenomLobberRenderer } from '../rendering/venom-lobber-renderer';
import { VenomLobberLifeSystem } from './venom-lobber-life-system';
import { VenomLobberProjectileHitSystem } from './venom-lobber-projectile-hit-system';
import { VenomLobberRepopulationSystem } from './venom-lobber-repopulation-system';
import { VenomLobberTargeting } from './venom-lobber-targeting';

const MINIMUM_DELTA_TIME = 1 / 240;
const MAXIMUM_DELTA_TIME = 0.05;

/** Venom Lobber 群体门面，只负责编排 SoA 系统顺序和批渲染生命周期。 */
export class VenomLobberPopulation
implements MonsterCombatPopulation, PlanarTargetPopulation, PlanarMonsterHitPopulation {
  private readonly state: VenomLobberState;
  private readonly life = new VenomLobberLifeSystem();
  private readonly combat: VenomLobberCombatSystem;
  private readonly movement = new VenomLobberMovementSystem();
  private readonly animation = new VenomLobberAnimationSystem();
  private readonly repopulation: VenomLobberRepopulationSystem;
  private readonly targeting = new VenomLobberTargeting();
  private readonly projectileHit = new VenomLobberProjectileHitSystem();
  private readonly renderer: VenomLobberRenderer;
  private disposed = false;

  constructor(parent: Node, options: Readonly<VenomLobberPopulationOptions>) {
    const normalized = normalizeVenomLobberOptions(options);
    const combatOptions = normalizeVenomLobberCombatOptions(options.combat);
    this.state = new VenomLobberState(normalized);
    this.combat = new VenomLobberCombatSystem(this.state.count, combatOptions);
    this.repopulation = new VenomLobberRepopulationSystem(this.state);
    this.renderer = new VenomLobberRenderer(
      parent,
      this.state,
      this.combat.effects,
      combatOptions,
    );
  }

  public get count(): number {
    return this.state.count;
  }

  public get aliveCount(): number {
    return this.repopulation.countAlive();
  }

  public get visibleCount(): number {
    return this.renderer.visibleEntityCount;
  }

  /** 当前酸池对玩家移动速度施加的乘数，一表示不受影响。 */
  public get movementMultiplier(): number {
    return this.combat.movementMultiplier;
  }

  public maintainAround(options: Readonly<VenomLobberRepopulationOptions>): void {
    this.ensureActive();
    this.repopulation.maintainAround(options);
  }

  /** 按生命、施法、移动、姿态和渲染的固定顺序推进一帧。 */
  public update(deltaTime: number): void {
    this.ensureActive();
    if (!Number.isFinite(deltaTime)) {
      throw new Error('Venom Lobber 帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(MINIMUM_DELTA_TIME, Math.min(deltaTime, MAXIMUM_DELTA_TIME));
    this.life.update(this.state, safeDeltaTime);
    this.combat.update(this.state, safeDeltaTime);
    this.movement.update(this.state, safeDeltaTime);
    this.animation.update(this.state, safeDeltaTime);
    this.renderer.update();
  }

  public findBestPlanarTarget(
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean {
    this.ensureActive();
    return this.targeting.findBest(this.state, query, result);
  }

  public findFirstPlanarHit(
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean {
    this.ensureActive();
    return this.projectileHit.findFirst(this.state, query, result);
  }

  public damage(entityId: number, amount: number): void {
    this.ensureActive();
    this.life.damage(this.state, entityId, amount);
  }

  public synchronizeCombatTarget(target: Readonly<PlanarMonsterCombatTarget>): void {
    this.ensureActive();
    this.combat.synchronizeTarget(target);
  }

  public clearCombatTarget(): void {
    this.ensureActive();
    this.combat.clearTarget(this.state);
  }

  public consumeAttackDamage(): number {
    this.ensureActive();
    return this.combat.consumeDamage();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderer.dispose();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Venom Lobber 群体已经释放。');
    }
  }
}
