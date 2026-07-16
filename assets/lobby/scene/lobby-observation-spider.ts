import { type Material, Node } from 'cc';
import { BundleService } from '../../core/bundles/bundle-service';
import { FeatureId } from '../../core/contracts/runtime-id';
import { FeatureLoader } from '../../core/features/feature-loader';
import { featureRegistry } from '../../core/features/feature-registry';
import { damp, dampAngle } from '../../core/math/scalar';
import { LOBBY_OBSERVATION_SPIDER_CONFIG } from '../model/lobby-observation-spider-config';

enum LobbyObservationSpiderPhase {
  Roaming,
  SidePositioning,
  Turning,
  Approaching,
  Watching,
  Retreating,
}

interface ObservationSpiderPopulation {
  update(deltaTime: number): void;
  dispose(): void;
}

/** 装配墙后巨型蜘蛛，并编排巡爬、靠近观察窗、探头和退回动画。 */
export class LobbyObservationSpider {
  private readonly root: Node;
  private readonly modelRoot: Node;
  private readonly featureLoader = new FeatureLoader(new BundleService(), featureRegistry);
  private population: ObservationSpiderPopulation | null = null;
  private phase = LobbyObservationSpiderPhase.Roaming;
  private phaseTime = 0;
  private elapsedTime = 0;
  private cycleIndex = 0;
  private currentScale = LOBBY_OBSERVATION_SPIDER_CONFIG.initialScale;
  private currentX = -LOBBY_OBSERVATION_SPIDER_CONFIG.roamingHorizontalAmplitude;
  private currentZ = getRoamingDepth(LOBBY_OBSERVATION_SPIDER_CONFIG.initialScale);
  private currentYaw = Math.PI * 0.5;
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

  /** 调整蜘蛛大小，并让巡爬和探头深度随缩放同步适配。 */
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

  /** 动态加载 Common Monsters Feature，并创建观察窗专用蜘蛛。 */
  public async initialize(): Promise<void> {
    const feature = await this.featureLoader.load(FeatureId.CommonMonsters);
    if (this.disposed) {
      return;
    }
    this.population = feature.createCurveCrawlerDisplay(this.modelRoot, {
      count: 1,
      spawnArea: Object.freeze({
        width: LOBBY_OBSERVATION_SPIDER_CONFIG.localSpawnWidth,
        height: LOBBY_OBSERVATION_SPIDER_CONFIG.localSpawnHeight,
      }),
      seed: LOBBY_OBSERVATION_SPIDER_CONFIG.seed,
      surfaceMaterialTemplate: this.surfaceMaterialTemplate,
    });
  }

  /** 推进蜘蛛本体步态和大厅专属的纵深探头状态机。 */
  public update(deltaTime: number): void {
    if (this.disposed || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }

    this.elapsedTime += deltaTime;
    this.phaseTime += deltaTime;
    this.advancePhaseWhenNeeded();
    this.updateTransform(deltaTime);
    this.population?.update(deltaTime);
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

  /** 根据当前阶段平滑更新巡爬位置和离观察窗的距离。 */
  private updateTransform(deltaTime: number): void {
    const config = LOBBY_OBSERVATION_SPIDER_CONFIG;
    const roamingX = Math.sin(this.elapsedTime * 0.31 - 1.1)
      * config.roamingHorizontalAmplitude;
    let targetX = roamingX;
    const roamingDepth = getRoamingDepth(this.currentScale);
    const watchingDepth = getWatchingDepth(this.currentScale);
    const watchingX = getWatchingX(this.cycleIndex);
    const watchingYaw = getWatchingYaw(watchingX);
    let targetZ = roamingDepth + Math.sin(this.elapsedTime * 0.41) * this.currentScale * 0.14;
    let targetYaw = getHorizontalTravelYaw(roamingX - this.currentX, this.currentYaw);
    let response = 1.2;
    let yawResponse = 2.2;

    switch (this.phase) {
      case LobbyObservationSpiderPhase.Roaming:
        break;
      case LobbyObservationSpiderPhase.SidePositioning:
        targetX = watchingX;
        targetZ = roamingDepth;
        targetYaw = getHorizontalTravelYaw(watchingX - this.currentX, this.currentYaw);
        response = 1.45;
        yawResponse = 2.8;
        break;
      case LobbyObservationSpiderPhase.Turning:
        targetX = watchingX;
        targetZ = roamingDepth;
        targetYaw = watchingYaw;
        response = 2.4;
        yawResponse = 1.25;
        break;
      case LobbyObservationSpiderPhase.Approaching:
        targetX = watchingX;
        targetZ = watchingDepth;
        targetYaw = watchingYaw;
        response = 0.92;
        yawResponse = 2;
        break;
      case LobbyObservationSpiderPhase.Watching:
        targetX = watchingX
          + Math.sin(this.elapsedTime * 0.46) * config.watchingDriftAmplitude;
        targetZ = watchingDepth
          + Math.sin(this.elapsedTime * 0.37) * this.currentScale * 0.025;
        targetYaw = watchingYaw + Math.sin(this.elapsedTime * 0.29) * 0.05;
        response = 2.2;
        yawResponse = 0.9;
        break;
      case LobbyObservationSpiderPhase.Retreating:
        targetX = watchingX;
        targetZ = roamingDepth;
        targetYaw = watchingYaw;
        response = 2.4;
        yawResponse = 2;
        break;
      default:
        throw new Error(`未知的大厅观察蜘蛛阶段：${String(this.phase)}`);
    }

    this.currentX = damp(this.currentX, targetX, response, deltaTime);
    this.currentZ = damp(this.currentZ, targetZ, response, deltaTime);
    this.currentYaw = dampAngle(this.currentYaw, targetYaw, yawResponse, deltaTime);
    this.applyTransform();
  }

  /** 在阶段持续时间结束后切换到下一种观察行为。 */
  private advancePhaseWhenNeeded(): void {
    const duration = getPhaseDuration(this.phase, this.cycleIndex);
    if (this.phaseTime < duration) {
      return;
    }
    this.phaseTime -= duration;
    switch (this.phase) {
      case LobbyObservationSpiderPhase.Roaming:
        this.phase = LobbyObservationSpiderPhase.SidePositioning;
        break;
      case LobbyObservationSpiderPhase.SidePositioning:
        this.phase = LobbyObservationSpiderPhase.Turning;
        break;
      case LobbyObservationSpiderPhase.Turning:
        this.phase = LobbyObservationSpiderPhase.Approaching;
        break;
      case LobbyObservationSpiderPhase.Approaching:
        this.phase = LobbyObservationSpiderPhase.Watching;
        break;
      case LobbyObservationSpiderPhase.Watching:
        this.phase = LobbyObservationSpiderPhase.Retreating;
        break;
      case LobbyObservationSpiderPhase.Retreating:
        this.phase = LobbyObservationSpiderPhase.Roaming;
        this.cycleIndex++;
        break;
      default:
        throw new Error(`未知的大厅观察蜘蛛阶段：${String(this.phase)}`);
    }
  }

  /** 把缓存的世界位置提交到可调缩放的蜘蛛根节点。 */
  private applyTransform(): void {
    this.root.setPosition(
      this.currentX,
      LOBBY_OBSERVATION_SPIDER_CONFIG.floorY,
      this.currentZ,
    );
    this.root.setRotationFromEuler(0, this.currentYaw * 180 / Math.PI, 0);
  }

  /** 把当前调试缩放同步到蜘蛛根节点。 */
  private applyScale(): void {
    this.modelRoot.setScale(this.currentScale, this.currentScale, this.currentScale);
  }
}

/** 计算蜘蛛背部接近透明观察面时的根节点深度。 */
function getWatchingDepth(scale: number): number {
  const config = LOBBY_OBSERVATION_SPIDER_CONFIG;
  return config.glassZ - config.forwardReachPerScale * scale - config.watchingClearance;
}

/** 计算蜘蛛日常巡爬时退到观察窗后方的深度。 */
function getRoamingDepth(scale: number): number {
  const config = LOBBY_OBSERVATION_SPIDER_CONFIG;
  return getWatchingDepth(scale) - config.retreatDepthPerScale * scale;
}

/** 返回每个观察阶段的固定持续时间。 */
function getPhaseDuration(phase: LobbyObservationSpiderPhase, cycleIndex: number): number {
  const config = LOBBY_OBSERVATION_SPIDER_CONFIG;
  switch (phase) {
    case LobbyObservationSpiderPhase.Roaming:
      return config.minimumRoamingDuration
        + getCycleVariation(cycleIndex) * config.roamingDurationRange;
    case LobbyObservationSpiderPhase.SidePositioning:
      return config.sidePositioningDuration;
    case LobbyObservationSpiderPhase.Turning:
      return config.turningDuration;
    case LobbyObservationSpiderPhase.Approaching:
      return config.approachDuration;
    case LobbyObservationSpiderPhase.Watching:
      return config.watchingDuration;
    case LobbyObservationSpiderPhase.Retreating:
      return config.retreatDuration;
    default:
      throw new Error(`未知的大厅观察蜘蛛阶段：${String(phase)}`);
  }
}

/** 根据当前横向位移目标，让蜘蛛沿实际行进方向迈步。 */
function getHorizontalTravelYaw(horizontalDelta: number, fallbackYaw: number): number {
  if (Math.abs(horizontalDelta) < 0.0001) {
    return fallbackYaw;
  }
  return horizontalDelta > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
}

/** 每轮在观察窗左右两侧交替选择探头位置，避开大厅中央柱体。 */
function getWatchingX(cycleIndex: number): number {
  const side = cycleIndex % 2 === 0 ? -1 : 1;
  return side * LOBBY_OBSERVATION_SPIDER_CONFIG.watchingSideOffset;
}

/** 从侧边观察位置略微朝大厅中央偏头。 */
function getWatchingYaw(watchingX: number): number {
  return -Math.sign(watchingX) * LOBBY_OBSERVATION_SPIDER_CONFIG.watchingInwardYaw;
}

/** 生成不依赖运行时随机分配、但每轮不同的稳定等待系数。 */
function getCycleVariation(cycleIndex: number): number {
  const value = Math.sin((cycleIndex + 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
