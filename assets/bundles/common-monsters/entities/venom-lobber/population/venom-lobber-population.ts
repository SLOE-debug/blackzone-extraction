import {
  type MonsterCombatPopulation,
  type PlanarMonsterCombatTarget,
} from '../../../../../core/contracts/monster-combat';
import { type PlanarMonsterEffectPopulation } from '../../../../../core/contracts/monster-effects';
import { type Node } from 'cc';
import { type PlanarCrowdPopulation } from '../../../../../core/monsters/crowd/planar-crowd-population';
import { VenomLobberAnimationSystem } from '../animation/venom-lobber-animation-system';
import { VenomLobberLegAnimationSystem } from '../animation/venom-lobber-leg-animation-system';
import { VenomLobberLifecyclePoseSystem } from '../animation/venom-lobber-lifecycle-pose-system';
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
import { createVenomLobberCrowdPopulation } from './venom-lobber-crowd-population';
import { VenomLobberRepopulationSystem } from './venom-lobber-repopulation-system';

const MINIMUM_DELTA_TIME = 1 / 240;
const MAXIMUM_DELTA_TIME = 0.05;

/** Venom Lobber 群体门面，只负责编排 SoA 系统顺序和批渲染生命周期。 */
export class VenomLobberPopulation
implements MonsterCombatPopulation, PlanarMonsterEffectPopulation {
  private readonly state: VenomLobberState;
  private readonly life: VenomLobberLifeSystem;
  private readonly combat: VenomLobberCombatSystem;
  private readonly movement = new VenomLobberMovementSystem();
  private readonly animation = new VenomLobberAnimationSystem();
  private readonly lifecyclePose = new VenomLobberLifecyclePoseSystem();
  private readonly legAnimation = new VenomLobberLegAnimationSystem();
  private readonly repopulation: VenomLobberRepopulationSystem;
  private readonly renderer: VenomLobberRenderer;
  private disposed = false;

  constructor(parent: Node, options: Readonly<VenomLobberPopulationOptions>) {
    const normalized = normalizeVenomLobberOptions(options);
    const combatOptions = normalizeVenomLobberCombatOptions(options.combat);
    this.state = new VenomLobberState(normalized);
    this.combat = new VenomLobberCombatSystem(this.state.count, combatOptions);
    this.life = new VenomLobberLifeSystem(this.combat.effects);
    this.repopulation = new VenomLobberRepopulationSystem(this.state);
    this.renderer = new VenomLobberRenderer(
      parent,
      this.state,
      this.combat.effects,
      combatOptions,
      options.camera,
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
    this.repopulation.maintainAround(options, this.renderer);
  }

  /** 在精确局部坐标启动一个完整出生生命周期。 */
  public spawnAt(x: number, y: number): boolean {
    this.ensureActive();
    return this.repopulation.spawnAt(x, y);
  }

  /** 暴露给战场世界统一空间约束的重型 SoA 视图。 */
  public createCrowdPopulation(populationId: number): PlanarCrowdPopulation {
    this.ensureActive();
    return createVenomLobberCrowdPopulation(this.state, populationId);
  }

  /** 按生命、施法、移动、姿态和渲染的固定顺序推进一帧。 */
  public update(deltaTime: number): void {
    this.simulate(deltaTime);
    this.synchronizeRendering();
  }

  /** 推进领域模拟，位置约束由战场世界随后统一处理。 */
  public simulate(deltaTime: number): void {
    this.ensureActive();
    if (!Number.isFinite(deltaTime)) {
      throw new Error('Venom Lobber 帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(MINIMUM_DELTA_TIME, Math.min(deltaTime, MAXIMUM_DELTA_TIME));
    this.life.update(this.state, safeDeltaTime);
    this.combat.update(this.state, safeDeltaTime);
    this.movement.update(this.state, safeDeltaTime);
    this.animation.update(this.state, safeDeltaTime);
    this.lifecyclePose.update(this.state, safeDeltaTime);
    this.legAnimation.update(this.state, safeDeltaTime);
  }

  /** 在共享 Crowd 修正位置后上传最终姿态。 */
  public synchronizeRendering(): void {
    this.ensureActive();
    this.renderer.update();
  }

  /** Crowd 改写根位置后用同一脚掌锚点重新求解腿链，消除支撑脚单帧滑动。 */
  public synchronizePostCrowdPose(): void {
    this.ensureActive();
    this.legAnimation.update(this.state, 0);
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

  /** 写入独立于出生、死亡姿态的显式腾空状态与高度。 */
  public setAirborneEffect(entityId: number, active: boolean, elevation: number): boolean {
    this.ensureActive();
    if (!Number.isSafeInteger(entityId) || entityId < 0 || entityId >= this.state.count
      || !Number.isFinite(elevation) || elevation < 0) {
      return false;
    }
    this.state.data.effects.externalAirborneActive[entityId] = active ? 1 : 0;
    this.state.data.effects.externalElevation[entityId] = elevation;
    return true;
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
