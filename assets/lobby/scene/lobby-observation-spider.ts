import { type Material, Node } from 'cc';
import { BundleService } from '../../core/bundles/bundle-service';
import { type MonsterObservationPopulation } from '../../core/contracts/monster-observation';
import { FeatureId } from '../../core/contracts/runtime-id';
import { FeatureLoader } from '../../core/features/feature-loader';
import { featureRegistry } from '../../core/features/feature-registry';
import { LOBBY_OBSERVATION_SPIDER_CONFIG } from '../model/lobby-observation-spider-config';
import { LobbyObservationSpiderMotion } from './lobby-observation-spider-motion';

const MAXIMUM_OBSERVATION_DELTA_TIME = 0.05;

/** 装配墙后巨型蜘蛛，并连接场景观察序列与怪物自身动作实现。 */
export class LobbyObservationSpider {
  private readonly root: Node;
  private readonly modelRoot: Node;
  private readonly featureLoader = new FeatureLoader(new BundleService(), featureRegistry);
  private readonly motion = new LobbyObservationSpiderMotion(
    LOBBY_OBSERVATION_SPIDER_CONFIG.initialScale,
  );
  private population: MonsterObservationPopulation | null = null;
  private currentScale = LOBBY_OBSERVATION_SPIDER_CONFIG.initialScale;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly surfaceMaterialTemplate: Material,
  ) {
    this.root = new Node('LobbyObservationSpider');
    parent.addChild(this.root);
    this.modelRoot = new Node('LobbyObservationSpiderModel');
    this.root.addChild(this.modelRoot);
    // Curve Crawler 原生使用 XY 平面和 Z-up；旋转后对齐大厅 XZ 地面和 Y-up。
    this.modelRoot.setRotationFromEuler(-90, 0, 0);
    this.applyScale();
    this.applyTransform();
  }

  /** 当前墙后蜘蛛的统一缩放。 */
  public get scale(): number {
    return this.currentScale;
  }

  /** 调整蜘蛛大小，下一帧会按真实足迹重新约束玻璃安全距离。 */
  public setScale(scale: number): void {
    const config = LOBBY_OBSERVATION_SPIDER_CONFIG;
    if (!Number.isFinite(scale)
      || scale < config.minimumScale
      || scale > config.maximumScale) {
      throw new Error(
        `大厅观察蜘蛛缩放必须位于 ${config.minimumScale} 到 ${config.maximumScale} 之间。`,
      );
    }
    this.currentScale = scale;
    this.applyScale();
  }

  /** 动态加载 Common Monsters Feature，并创建实现通用观察契约的蜘蛛。 */
  public async initialize(): Promise<void> {
    const feature = await this.featureLoader.load(FeatureId.CommonMonsters);
    if (this.disposed) {
      return;
    }

    const population = feature.createCurveCrawlerDisplay(this.modelRoot, {
      count: 1,
      spawnArea: Object.freeze({
        width: LOBBY_OBSERVATION_SPIDER_CONFIG.localSpawnWidth,
        height: LOBBY_OBSERVATION_SPIDER_CONFIG.localSpawnHeight,
      }),
      seed: LOBBY_OBSERVATION_SPIDER_CONFIG.seed,
      surfaceMaterialTemplate: this.surfaceMaterialTemplate,
    });
    this.motion.setFootprint(population.observationFootprint, this.currentScale);
    population.enterObservationEvent(this.motion.observationEvent);
    population.synchronizeObservationMotion(0, 0, 0);
    this.motion.takePendingEvent();
    this.population = population;
    this.applyTransform();
  }

  /** 推进场景轨迹，并把阶段事件和真实速度同步给蜘蛛自身动画。 */
  public update(deltaTime: number): void {
    if (this.disposed || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }

    const safeDeltaTime = Math.min(deltaTime, MAXIMUM_OBSERVATION_DELTA_TIME);
    this.motion.update(safeDeltaTime, this.currentScale);
    this.applyTransform();

    const population = this.population;
    if (population === null) {
      return;
    }
    const event = this.motion.takePendingEvent();
    if (event !== null) {
      population.enterObservationEvent(event);
    }
    population.synchronizeObservationMotion(
      this.motion.forwardSpeed,
      this.motion.lateralSpeed,
      this.motion.turnRate,
    );
    population.update(safeDeltaTime);
  }

  /** 释放动态怪物网格及其异步加载期间创建的根节点。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.population?.dispose();
    this.population = null;
    if (this.root.isValid) {
      this.root.destroy();
    }
    this.disposed = true;
  }

  /** 把轨迹控制器缓存的世界姿态提交到蜘蛛根节点。 */
  private applyTransform(): void {
    this.root.setPosition(
      this.motion.x,
      LOBBY_OBSERVATION_SPIDER_CONFIG.floorY,
      this.motion.z,
    );
    this.root.setRotationFromEuler(0, this.motion.yaw * 180 / Math.PI, 0);
  }

  /** 把当前调试缩放同步到蜘蛛模型根节点。 */
  private applyScale(): void {
    this.modelRoot.setScale(this.currentScale, this.currentScale, this.currentScale);
  }
}
