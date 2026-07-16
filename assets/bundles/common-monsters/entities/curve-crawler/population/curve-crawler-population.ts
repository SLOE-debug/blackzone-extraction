import { Node } from 'cc';
import {
  type MonsterObservationEvent,
  type MonsterObservationFootprint,
  type MonsterObservationPopulation,
} from '../../../../../core/contracts/monster-observation';
import { type MonsterPopulation } from '../../../../../core/contracts/monster-population';
import { CurveCrawlerAnimationSystem } from '../animation/curve-crawler-animation-system';
import { CurveCrawlerBehaviorSystem } from '../behavior/curve-crawler-behavior-system';
import { CurveCrawlerObservationSystem } from '../behavior/curve-crawler-observation-system';
import { createCurveCrawlerObservationFootprint } from '../model/curve-crawler-observation-footprint';
import {
  normalizeCurveCrawlerOptions,
  type CurveCrawlerPopulationOptions,
} from '../model/curve-crawler-options';
import { CurveCrawlerState } from '../model/curve-crawler-state';
import { CurveCrawlerMotionProfile } from '../model/curve-crawler-motion-profile';
import { CurveCrawlerMovementSystem } from '../movement/curve-crawler-movement-system';
import { CurveCrawlerRenderer } from '../rendering/curve-crawler-renderer';
import { type CurveCrawlerCommand, CurveCrawlerCommandType } from './curve-crawler-command';
import { CurveCrawlerDeathSystem } from './curve-crawler-death-system';
import { CurveCrawlerHitSystem } from './curve-crawler-hit-system';

const MINIMUM_DELTA_TIME = 1 / 240;
const MAXIMUM_DELTA_TIME = 0.05;

/**
 * Curve Crawler 群体的公开运行时门面。
 *
 * 门面只负责编排系统顺序和资源生命周期，不承载行为、动画或几何细节。
 */
export class CurveCrawlerPopulation
implements MonsterPopulation<CurveCrawlerCommand>, MonsterObservationPopulation {
  private readonly state: CurveCrawlerState;
  private readonly hit = new CurveCrawlerHitSystem();
  private readonly death = new CurveCrawlerDeathSystem();
  private readonly behavior = new CurveCrawlerBehaviorSystem();
  private readonly observation = new CurveCrawlerObservationSystem();
  private readonly movement = new CurveCrawlerMovementSystem();
  private readonly animation = new CurveCrawlerAnimationSystem();
  private readonly renderer: CurveCrawlerRenderer;
  public readonly observationFootprint: Readonly<MonsterObservationFootprint>;
  private disposed = false;

  constructor(
    parent: Node,
    options: Readonly<CurveCrawlerPopulationOptions>,
    motionProfile: CurveCrawlerMotionProfile,
  ) {
    const normalizedOptions = normalizeCurveCrawlerOptions(options, motionProfile);
    this.state = new CurveCrawlerState(normalizedOptions);
    this.observationFootprint = createCurveCrawlerObservationFootprint(this.state);
    this.renderer = new CurveCrawlerRenderer(
      parent,
      this.state,
      normalizedOptions.surfaceMaterialTemplate,
    );
  }

  /** 当前群体包含的 Curve Crawler 数量。 */
  public get count(): number {
    return this.state.count;
  }

  /** 按受击、死亡、行为、观察控制、移动、动画、渲染的固定顺序推进一帧。 */
  public update(deltaTime: number): void {
    this.ensureActive();
    if (!Number.isFinite(deltaTime)) {
      throw new Error('Curve Crawler 帧时间必须是有限数值。');
    }

    const safeDeltaTime = Math.max(MINIMUM_DELTA_TIME, Math.min(deltaTime, MAXIMUM_DELTA_TIME));
    this.hit.update(this.state, safeDeltaTime);
    this.death.update(this.state, safeDeltaTime);
    this.behavior.update(this.state, safeDeltaTime);
    this.observation.update(this.state, safeDeltaTime);
    this.movement.update(this.state, safeDeltaTime);
    this.animation.update(this.state, safeDeltaTime);
    this.renderer.update();
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

  /** 释放群体持有的动态网格和材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.renderer.dispose();
    this.disposed = true;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Curve Crawler 群体已经释放。');
    }
  }

  /** 编排受击结算，并在致命结果出现时启动独立死亡系统。 */
  private applyDamage(entityId: number, amount: number): void {
    if (this.hit.damage(this.state, entityId, amount)) {
      this.death.start(this.state, entityId);
    }
  }
}
