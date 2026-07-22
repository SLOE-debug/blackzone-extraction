import { type Camera, type EffectAsset, type Material, Node } from 'cc';
import { type Disposable } from '../../../core/contracts/disposable';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { PlanarCrowdSeparationSystem } from '../../../core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import { BATTLEFIELD_VENOM_LOBBER_CONFIG } from '../model/battlefield-venom-lobber-config';
import { calculateBattlefieldMonsterTargetCount } from '../model/battlefield-monster-wave-schedule';
import {
  type BattlefieldProjectileSweepQuery,
  type BattlefieldMonsterCombatTarget,
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';
import { BattlefieldMonsterGroup } from './battlefield-monster-group';
import { BattlefieldMonsterTargetRegistry } from './battlefield-monster-target-registry';
import { BattlefieldVenomLobberGroup } from './battlefield-venom-lobber-group';
import {
  type BattlefieldMonsterPerformanceRecorder,
  BattlefieldMonsterPerformanceStage,
} from './battlefield-monster-performance';

const DEBUG_CURVE_CRAWLER_SEED = 0x51d3b9;
const DEBUG_CURVE_CRAWLER_WORLD_DIAMETER = 0.01;
const MAXIMUM_WAVE_DELTA_TIME = 0.05;
const SWARM_POPULATION_ID = 0;
const VENOM_POPULATION_ID = 1;
const DEBUG_POPULATION_ID = 2;

export type {
  BattlefieldAimTarget,
  BattlefieldMonsterCombatTarget,
  MutableBattlefieldAimTarget,
  MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';

/**
 * 聚合固定容量、渐进激活的 Curve Crawler 尸潮、Venom Lobber 专家怪与 Debug 实体。
 *
 * 正式尸潮不再由 Chunk 持有；同一 SoA 内的空闲槽位按波次进入完整出生生命周期。
 */
export class BattlefieldMonsterPopulation
implements Disposable {
  private readonly renderRoot: Node;
  private readonly renderBatch: ReturnType<
    RegisteredFeaturePlugin<FeatureId.CommonMonsters>['createCurveCrawlerBatch']
  >;
  private readonly groups: BattlefieldMonsterGroup[] = [];
  private readonly crowd = new PlanarCrowdSeparationSystem();
  private readonly targets = new BattlefieldMonsterTargetRegistry(this.crowd);
  private readonly venomGroup: BattlefieldVenomLobberGroup;
  private swarm: BattlefieldMonsterGroup | null = null;
  private debugGroup: BattlefieldMonsterGroup | null = null;
  private waveElapsedSeconds = 0;
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>,
    curveCrawlerGpuEffect: EffectAsset,
    camera: Camera,
    initialCenterX: number,
    initialCenterZ: number,
  ) {
    if (!Number.isFinite(initialCenterX) || !Number.isFinite(initialCenterZ)) {
      throw new Error('战场怪物群初始中心必须使用有限坐标。');
    }
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const renderRoot = new Node('BattlefieldCommonMonstersBatchRoot');
    parent.addChild(renderRoot);
    renderRoot.setPosition(0, config.groundOffsetY, 0);
    // Curve Crawler 原生位于 XY 平面并以 Z 为高度；统一根一次性对齐战场 XZ 地面。
    renderRoot.setRotationFromEuler(-90, 0, 0);
    renderRoot.setScale(config.modelScale, config.modelScale, config.modelScale);
    this.renderRoot = renderRoot;
    try {
      this.renderBatch = commonMonsters.createCurveCrawlerBatch(
        renderRoot,
        surfaceMaterialTemplate,
        curveCrawlerGpuEffect,
        camera,
      );
    } catch (error: unknown) {
      renderRoot.destroy();
      throw error;
    }
    let venomGroup: BattlefieldVenomLobberGroup | null = null;
    try {
      // 固定容量 SoA 在加载阶段准备；开场帧只同步零驻留布局，不再临时分配完整群体。
      this.ensureSwarm(initialCenterX, initialCenterZ);
      venomGroup = new BattlefieldVenomLobberGroup(
        renderRoot,
        surfaceMaterialTemplate,
        commonMonsters,
        initialCenterX,
        initialCenterZ,
        VENOM_POPULATION_ID,
        camera,
      );
      this.crowd.register(venomGroup.crowdPopulation);
      this.targets.register(venomGroup);
    } catch (error: unknown) {
      if (venomGroup !== null) {
        this.targets.unregister(venomGroup);
        this.crowd.unregister(venomGroup.populationId);
      }
      venomGroup?.dispose();
      while (this.groups.length > 0) {
        const group = this.groups.pop();
        if (group !== undefined) {
          this.targets.unregister(group);
          this.crowd.unregister(group.populationId);
          group.dispose();
        }
      }
      this.renderBatch.dispose();
      renderRoot.destroy();
      throw error;
    }
    if (venomGroup === null) {
      this.renderBatch.dispose();
      renderRoot.destroy();
      throw new Error('战场 Venom Lobber 群体初始化结果缺失。');
    }
    this.venomGroup = venomGroup;
  }

  /** 当前普通尸潮、专家怪与 Debug 观察实体的总槽位数。 */
  public get count(): number {
    let count = this.venomGroup.count;
    for (const group of this.groups) {
      count += group.count;
    }
    return count;
  }

  /** 当前普通尸潮与专家怪中真正处于存活阶段的怪物数量。 */
  public get aliveCount(): number {
    return (this.swarm?.aliveCount ?? 0) + this.venomGroup.aliveCount;
  }

  /** 当前具有可渲染生命周期并实际进入动态网格的怪物数量。 */
  public get visibleCount(): number {
    return this.renderBatch.visibleEntityCount + this.venomGroup.visibleCount;
  }

  /** 当前具有渲染生命周期的全部怪物数量，不受镜头可见性影响。 */
  public get residentCount(): number {
    return this.renderBatch.residentCount + this.venomGroup.visibleCount;
  }

  /** 当前共享动态网格已经分配的实体容量。 */
  public get renderCapacity(): number {
    return this.renderBatch.renderCapacity + this.venomGroup.count;
  }

  /** 酸池对玩家下一帧移动输入施加的速度乘数。 */
  public get playerMovementSpeedMultiplier(): number {
    return this.venomGroup.movementMultiplier;
  }

  /**
   * 在精确世界坐标创建一只用于观察出生演出的蜘蛛。
   *
   * 再次触发时先替换旧观察实体，避免调试点击持续积累完整怪物批次。
   */
  public spawnDebugCurveCrawler(x: number, z: number): void {
    this.ensureActive();
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      throw new Error('Debug 蜘蛛生成坐标必须是有限数值。');
    }
    if (this.debugGroup !== null) {
      this.targets.unregister(this.debugGroup);
      this.crowd.unregister(this.debugGroup.populationId);
      removeMonsterGroup(this.groups, this.debugGroup);
      this.debugGroup.dispose();
    }
    const group = new BattlefieldMonsterGroup(
      this.renderBatch,
      x,
      z,
      1,
      DEBUG_CURVE_CRAWLER_SEED,
      DEBUG_CURVE_CRAWLER_WORLD_DIAMETER,
      1,
      DEBUG_POPULATION_ID,
    );
    this.groups.push(group);
    this.crowd.register(group.crowdPopulation);
    this.targets.register(group);
    this.debugGroup = group;
  }

  /** 推进人口维护与领域模拟；空间索引和渲染由后续 World 阶段处理。 */
  public simulate(
    deltaTime: number,
    target: Readonly<BattlefieldMonsterCombatTarget> | null,
    performance: BattlefieldMonsterPerformanceRecorder,
  ): number {
    if (this.disposed) {
      return 0;
    }
    if (!Number.isFinite(deltaTime)) {
      throw new Error('战场怪物聚合群体帧时间必须是有限数值。');
    }
    let stageStarted = performance.beginMonsterStage();
    if (target !== null) {
      this.waveElapsedSeconds += Math.max(
        0,
        Math.min(deltaTime, MAXIMUM_WAVE_DELTA_TIME),
      );
      const desiredPopulationCount = calculateBattlefieldMonsterTargetCount(
        BATTLEFIELD_MONSTER_SPAWN,
        this.waveElapsedSeconds,
      );
      this.swarm?.maintainAround(
        target.x,
        target.z,
        desiredPopulationCount,
      );
      const desiredVenomCount = calculateBattlefieldMonsterTargetCount(
        BATTLEFIELD_VENOM_LOBBER_CONFIG,
        this.waveElapsedSeconds,
      );
      this.venomGroup.maintainAround(target.x, target.z, desiredVenomCount);
    }
    performance.endMonsterStage(
      BattlefieldMonsterPerformanceStage.PopulationMaintenance,
      stageStarted,
    );

    stageStarted = performance.beginMonsterStage();
    let damage = 0;
    for (const group of this.groups) {
      damage += group.update(deltaTime, target);
    }
    damage += this.venomGroup.update(deltaTime, target);
    performance.endMonsterStage(
      BattlefieldMonsterPerformanceStage.Simulation,
      stageStarted,
    );

    return damage;
  }

  /** 在全部怪物移动完成后统一求解 Crowd，并留下最新共享空间索引。 */
  public rebuildSpatialIndex(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    if (!Number.isFinite(deltaTime)) {
      throw new Error('怪物空间索引帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(0, Math.min(deltaTime, MAXIMUM_WAVE_DELTA_TIME));
    if (safeDeltaTime === 0) {
      this.crowd.rebuild();
      this.venomGroup.synchronizePostCrowdPose();
      return;
    }
    this.crowd.solve(safeDeltaTime);
    this.venomGroup.synchronizePostCrowdPose();
  }

  /** 在战斗与伤害结算后整理并上传全部怪物可见状态。 */
  public synchronizeRendering(
    deltaTime: number,
    performance: BattlefieldMonsterPerformanceRecorder,
  ): void {
    if (this.disposed) {
      return;
    }
    for (const group of this.groups) {
      group.synchronizeRendering();
    }
    this.venomGroup.synchronizeRendering();

    const previousCapacity = this.renderBatch.renderCapacity;
    const stageStarted = performance.beginMonsterStage();
    this.renderBatch.synchronize(deltaTime);
    performance.recordMonsterRenderingWork(
      this.renderBatch.lastPoseUploadBytes,
      this.renderBatch.lastPoseUploadCalls,
    );
    performance.endMonsterStage(
      BattlefieldMonsterPerformanceStage.RenderingSynchronization,
      stageStarted,
    );
    const nextCapacity = this.renderBatch.renderCapacity;
    if (nextCapacity > previousCapacity) {
      performance.recordMonsterBatchGrowth(previousCapacity, nextCapacity);
    }
  }

  /** 在加载阶段创建唯一固定容量群体，槽位保持休眠直到波次激活。 */
  private ensureSwarm(playerX: number, playerZ: number): void {
    if (this.swarm !== null) {
      return;
    }
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const group = new BattlefieldMonsterGroup(
      this.renderBatch,
      playerX,
      playerZ,
      config.populationCapacity,
      config.seed,
      config.spawnOuterRadius * 2,
      0,
      SWARM_POPULATION_ID,
    );
    this.groups.push(group);
    this.crowd.register(group.crowdPopulation);
    this.targets.register(group);
    this.swarm = group;
  }

  /** 在所有活动地图群体中选择距离玩家最近的有效瞄准吸附结果。 */
  public resolveAimTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    return this.targets.resolveAimTarget(
      originX,
      originZ,
      directionX,
      directionZ,
      false,
      result,
    );
  }

  /** 在全部活动群体中使用更宽的移动朝向锥体选择自动射击目标。 */
  public resolveAutoTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    return this.targets.resolveAimTarget(
      originX,
      originZ,
      directionX,
      directionZ,
      true,
      result,
    );
  }

  /** 查询实体弹丸本帧真实位移最先接触且尚未命中过的怪物。 */
  public findFirstProjectileHit(
    query: Readonly<BattlefieldProjectileSweepQuery>,
    ignoredPopulationIds: Uint32Array,
    ignoredEntityIds: Uint32Array,
    ignoredOffset: number,
    ignoredCount: number,
    result: MutableBattlefieldProjectileHit,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    return this.targets.findFirstProjectileHit(
      query,
      ignoredPopulationIds,
      ignoredEntityIds,
      ignoredOffset,
      ignoredCount,
      result,
    );
  }

  /** 把 PostSimulation 中的弹丸伤害路由到稳定群体与实体。 */
  public damageMonster(populationId: number, entityId: number, amount: number): void {
    if (!this.disposed) {
      this.targets.damageMonster(populationId, entityId, amount);
    }
  }

  /** 释放尸潮状态、共享渲染批次和调试实体。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.targets.unregister(this.venomGroup);
    this.crowd.unregister(this.venomGroup.populationId);
    this.venomGroup.dispose();
    while (this.groups.length > 0) {
      const group = this.groups.pop();
      if (group !== undefined) {
        this.targets.unregister(group);
        this.crowd.unregister(group.populationId);
        group.dispose();
      }
    }
    this.renderBatch.dispose();
    if (this.renderRoot.isValid) {
      this.renderRoot.destroy();
    }
    this.debugGroup = null;
    this.swarm = null;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场怪物聚合群体已经释放。');
    }
  }
}

/** 从聚合更新列表移除指定群体。 */
function removeMonsterGroup(
  groups: BattlefieldMonsterGroup[],
  group: BattlefieldMonsterGroup,
): void {
  const index = groups.indexOf(group);
  if (index >= 0) {
    groups.splice(index, 1);
  }
}
