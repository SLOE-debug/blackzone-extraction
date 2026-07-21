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
import {
  type MonsterObservationEvent,
  type MonsterObservationFootprint,
  type MonsterObservationPopulation,
} from '../../../../../core/contracts/monster-observation';
import { type MonsterPopulation } from '../../../../../core/contracts/monster-population';
import { CurveCrawlerAnimationSystem } from '../animation/curve-crawler-animation-system';
import { CurveCrawlerEmergenceSystem } from '../animation/curve-crawler-emergence-system';
import { CurveCrawlerBehaviorSystem } from '../behavior/curve-crawler-behavior-system';
import { CurveCrawlerCombatSystem } from '../behavior/curve-crawler-combat-system';
import { CurveCrawlerObservationSystem } from '../behavior/curve-crawler-observation-system';
import { normalizeCurveCrawlerCombatOptions } from '../model/curve-crawler-combat-options';
import { createCurveCrawlerObservationFootprint } from '../model/curve-crawler-observation-footprint';
import {
  normalizeCurveCrawlerOptions,
  type CurveCrawlerDisplayOptions,
  type CurveCrawlerPopulationOptions,
} from '../model/curve-crawler-options';
import { CurveCrawlerState } from '../model/curve-crawler-state';
import { CurveCrawlerMotionProfile } from '../model/curve-crawler-motion-profile';
import { type CurveCrawlerRepopulationOptions } from '../model/curve-crawler-repopulation-options';
import { CurveCrawlerMovementSystem } from '../movement/curve-crawler-movement-system';
import { CurveCrawlerSeparationSystem } from '../movement/curve-crawler-separation-system';
import {
  type CurveCrawlerPopulationRendering,
  type CurveCrawlerPopulationRenderingFactory,
} from '../rendering/curve-crawler-population-rendering';
import { type CurveCrawlerCommand, CurveCrawlerCommandType } from './curve-crawler-command';
import { CurveCrawlerDeathSystem } from './curve-crawler-death-system';
import { CurveCrawlerHitSystem } from './curve-crawler-hit-system';
import { CurveCrawlerProjectileHitSystem } from './curve-crawler-projectile-hit-system';
import { CurveCrawlerRepopulationSystem } from './curve-crawler-repopulation-system';
import { CurveCrawlerSimulationCadence } from './curve-crawler-simulation-cadence';
import { CurveCrawlerTargeting } from './curve-crawler-targeting';

const MINIMUM_DELTA_TIME = 1 / 240;
const MAXIMUM_DELTA_TIME = 0.05;

/**
 * Curve Crawler 群体的公开运行时门面。
 *
 * 门面只负责编排系统顺序和资源生命周期，不承载行为、动画或几何细节。
 */
export class CurveCrawlerPopulation
implements MonsterPopulation<CurveCrawlerCommand>, MonsterObservationPopulation,
MonsterCombatPopulation, PlanarTargetPopulation, PlanarMonsterHitPopulation {
  private readonly state: CurveCrawlerState;
  private readonly hit = new CurveCrawlerHitSystem();
  private readonly death = new CurveCrawlerDeathSystem();
  private readonly behavior = new CurveCrawlerBehaviorSystem();
  private readonly combat: CurveCrawlerCombatSystem | null;
  private readonly observation = new CurveCrawlerObservationSystem();
  private readonly movement = new CurveCrawlerMovementSystem();
  private readonly separation: CurveCrawlerSeparationSystem;
  private readonly targeting = new CurveCrawlerTargeting();
  private readonly projectileHit = new CurveCrawlerProjectileHitSystem();
  private readonly repopulation: CurveCrawlerRepopulationSystem;
  private readonly animation = new CurveCrawlerAnimationSystem();
  private readonly emergence = new CurveCrawlerEmergenceSystem();
  private readonly cadence = new CurveCrawlerSimulationCadence();
  private readonly rendering: CurveCrawlerPopulationRendering;
  public readonly observationFootprint: Readonly<MonsterObservationFootprint>;
  private disposed = false;

  constructor(
    options: Readonly<CurveCrawlerPopulationOptions>,
    motionProfile: CurveCrawlerMotionProfile.Autonomous,
    createRendering: CurveCrawlerPopulationRenderingFactory,
  );

  constructor(
    options: Readonly<CurveCrawlerDisplayOptions>,
    motionProfile: CurveCrawlerMotionProfile.ObservationDisplay,
    createRendering: CurveCrawlerPopulationRenderingFactory,
  );

  constructor(
    options: Readonly<CurveCrawlerPopulationOptions | CurveCrawlerDisplayOptions>,
    motionProfile: CurveCrawlerMotionProfile,
    createRendering: CurveCrawlerPopulationRenderingFactory,
  ) {
    const normalizedOptions = normalizeCurveCrawlerOptions(options, motionProfile);
    this.state = new CurveCrawlerState(normalizedOptions);
    this.repopulation = new CurveCrawlerRepopulationSystem(this.state);
    this.separation = new CurveCrawlerSeparationSystem(this.state.count);
    if (motionProfile === CurveCrawlerMotionProfile.Autonomous) {
      if (!('combat' in options)) {
        throw new Error('自主 Curve Crawler 群体缺少战斗参数。');
      }
      this.combat = new CurveCrawlerCombatSystem(
        normalizeCurveCrawlerCombatOptions(options.combat),
      );
    } else {
      this.combat = null;
    }
    this.observationFootprint = createCurveCrawlerObservationFootprint(this.state);
    this.rendering = createRendering(this.state);
  }

  /** 当前群体包含的 Curve Crawler 数量。 */
  public get count(): number {
    return this.state.count;
  }

  /** 当前真正存活且能够追击玩家的实体数量。 */
  public get aliveCount(): number {
    return this.repopulation.countAlive();
  }

  /** 同步玩家周边期望驻留数量，并回收超出半径的非死亡实体槽位。 */
  public maintainAround(options: Readonly<CurveCrawlerRepopulationOptions>): void {
    this.ensureActive();
    this.repopulation.maintainAround(options);
  }

  /** 按出生、受击、死亡、行为、战斗、移动、分离、动画、渲染的固定顺序推进一帧。 */
  public update(deltaTime: number): void {
    this.ensureActive();
    if (!Number.isFinite(deltaTime)) {
      throw new Error('Curve Crawler 帧时间必须是有限数值。');
    }

    const safeDeltaTime = Math.max(MINIMUM_DELTA_TIME, Math.min(deltaTime, MAXIMUM_DELTA_TIME));
    if (!this.repopulation.hasResidents()) {
      this.cadence.reset();
      return;
    }
    this.cadence.advance(safeDeltaTime);
    this.emergence.update(this.state, safeDeltaTime);
    this.hit.update(this.state, safeDeltaTime);
    this.death.update(this.state, safeDeltaTime);
    const intentDeltaTime = this.cadence.intentDeltaTime;
    if (intentDeltaTime > 0) {
      this.behavior.update(this.state, intentDeltaTime);
      this.observation.update(this.state, intentDeltaTime);
      this.combat?.update(this.state, intentDeltaTime);
    }
    this.movement.update(this.state, safeDeltaTime);
    const separationDeltaTime = this.cadence.separationDeltaTime;
    if (separationDeltaTime > 0) {
      this.separation.update(this.state, separationDeltaTime);
    }
    this.animation.update(this.state, safeDeltaTime);
    this.rendering.update();
  }

  /** 向群体分发强类型领域命令。 */
  public dispatch(command: CurveCrawlerCommand): void {
    this.ensureActive();

    switch (command.type) {
      case CurveCrawlerCommandType.Scuttle:
        this.behavior.triggerScuttle(this.state);
        break;
      case CurveCrawlerCommandType.Damage:
        this.applyDamage(command.entityId, command.amount);
        break;
      default:
        throw new Error('收到未知的 Curve Crawler 命令。');
    }
  }

  /** 对指定实体施加伤害，供战斗系统或演示入口直接调用。 */
  public damage(entityId: number, amount: number): void {
    this.ensureActive();
    this.applyDamage(entityId, amount);
  }

  /** 把通用观察阶段切换交给 Curve Crawler 独有的观察行为系统。 */
  public enterObservationEvent(event: MonsterObservationEvent): void {
    this.ensureActive();
    this.observation.enter(this.state, event);
  }

  /** 同步展示根节点产生的真实局部速度，供腿部相位匹配实际位移。 */
  public synchronizeObservationMotion(
    forwardSpeed: number,
    lateralSpeed: number,
    turnRate: number,
  ): void {
    this.ensureActive();
    this.observation.synchronizeMotion(
      this.state,
      forwardSpeed,
      lateralSpeed,
      turnRate,
    );
  }

  /** 在群体局部平面中查找右摇杆方向附近的存活目标。 */
  public findBestPlanarTarget(
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean {
    this.ensureActive();
    return this.targeting.findBest(this.state, query, result);
  }

  /** 在群体局部平面中查找一段子弹位移最先接触的存活实体。 */
  public findFirstPlanarHit(
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean {
    this.ensureActive();
    return this.projectileHit.findFirst(this.state, query, result);
  }

  /** 把场景目标同步给自主战斗系统。 */
  public synchronizeCombatTarget(target: Readonly<PlanarMonsterCombatTarget>): void {
    this.ensureActive();
    this.ensureCombat().synchronizeTarget(target);
  }

  /** 清除场景目标并立即取消全部尚未命中的啃咬。 */
  public clearCombatTarget(): void {
    this.ensureActive();
    this.ensureCombat().clearTarget(this.state);
  }

  /** 读取并清空当前帧已经命中的聚合伤害。 */
  public consumeAttackDamage(): number {
    this.ensureActive();
    return this.ensureCombat().consumeAttackDamage();
  }

  /** 释放群体持有的动态网格和材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.rendering.dispose();
    this.disposed = true;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Curve Crawler 群体已经释放。');
    }
  }

  /** 阻止观察展示群体误用自主战斗接口。 */
  private ensureCombat(): CurveCrawlerCombatSystem {
    if (this.combat === null) {
      throw new Error('观察展示用途的 Curve Crawler 不支持自主战斗。');
    }
    return this.combat;
  }

  /** 编排受击结算，并在致命结果出现时启动独立死亡系统。 */
  private applyDamage(entityId: number, amount: number): void {
    if (this.hit.damage(this.state, entityId, amount)) {
      this.death.start(this.state, entityId);
    }
  }
}
