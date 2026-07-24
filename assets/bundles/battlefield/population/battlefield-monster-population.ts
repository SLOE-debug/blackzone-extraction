import { type Camera, type EffectAsset, type Material, Node } from 'cc';
import { type Disposable } from '../../../core/contracts/disposable';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { BattlefieldDebugMonsterPopulation } from '../debug/battlefield-debug-monster-population';
import { BattlefieldMonsterId } from '../model/battlefield-monster-id';
import { PlanarCrowdSeparationSystem } from '../../../core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import { BATTLEFIELD_VENOM_LOBBER_CONFIG } from '../model/battlefield-venom-lobber-config';
import { calculateBattlefieldMonsterTargetCount } from '../model/battlefield-monster-wave-schedule';
import {
  type BattlefieldProjectileSweepQuery,
  type BattlefieldGrabTargetQuery,
  type BattlefieldMonsterCombatTarget,
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldManipulationCandidate,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';
import { BattlefieldMonsterGroup } from './battlefield-monster-group';
import { BattlefieldMonsterTargetRegistry } from './battlefield-monster-target-registry';
import { BattlefieldMonsterManipulationRegistry } from './battlefield-monster-manipulation-registry';
import { BattlefieldVenomLobberGroup } from './battlefield-venom-lobber-group';
import {
  type BattlefieldMonsterPerformanceRecorder,
  BattlefieldMonsterPerformanceStage,
} from './battlefield-monster-performance';
import {
  type MutableBattlefieldProjectileStatistics,
} from '../equipment/projectile/model/battlefield-projectile-statistics';

const MAXIMUM_WAVE_DELTA_TIME = 0.05;
const SWARM_POPULATION_ID = 0;
const VENOM_POPULATION_ID = 1;

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
  private readonly manipulations = new BattlefieldMonsterManipulationRegistry(this.crowd);
  private readonly venomGroup: BattlefieldVenomLobberGroup;
  private readonly debugMonsters: BattlefieldDebugMonsterPopulation;
  private swarm: BattlefieldMonsterGroup | null = null;
  private readonly automaticMonsterEnabled: Record<BattlefieldMonsterId, boolean> = {
    [BattlefieldMonsterId.CurveCrawler]: true,
    [BattlefieldMonsterId.VenomLobber]: true,
  };
  private automaticGenerationActive = true;
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
          this.manipulations.unregister(group);
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
    this.debugMonsters = new BattlefieldDebugMonsterPopulation(
      renderRoot,
      surfaceMaterialTemplate,
      commonMonsters,
      this.renderBatch,
      this.crowd,
      this.targets,
      this.manipulations,
      camera,
    );
  }

  /** 当前普通尸潮、专家怪与 Debug 观察实体的总槽位数。 */
  public get count(): number {
    let count = this.venomGroup.count + this.debugMonsters.count;
    for (const group of this.groups) {
      count += group.count;
    }
    return count;
  }

  /** 当前普通尸潮与专家怪中真正处于存活阶段的怪物数量。 */
  public get aliveCount(): number {
    return (this.swarm?.aliveCount ?? 0)
      + this.venomGroup.aliveCount;
  }

  /** 当前具有可渲染生命周期并实际进入动态网格的怪物数量。 */
  public get visibleCount(): number {
    return this.renderBatch.visibleEntityCount
      + this.venomGroup.visibleCount
      + this.debugMonsters.separateVisibleCount;
  }

  /** 当前具有渲染生命周期的全部怪物数量，不受镜头可见性影响。 */
  public get residentCount(): number {
    return this.renderBatch.residentCount
      + this.venomGroup.visibleCount
      + this.debugMonsters.separateVisibleCount;
  }

  /** 当前共享动态网格已经分配的实体容量。 */
  public get renderCapacity(): number {
    return this.renderBatch.renderCapacity
      + this.venomGroup.count
      + this.debugMonsters.separateRenderCapacity;
  }

  /** 酸池对玩家下一帧移动输入施加的速度乘数。 */
  public get playerMovementSpeedMultiplier(): number {
    return Math.min(
      this.venomGroup.movementMultiplier,
      this.debugMonsters.movementMultiplier,
    );
  }

  /** 自动波次总开关的当前值。 */
  public get automaticGenerationEnabled(): boolean {
    return this.automaticGenerationActive;
  }

  /** 查询指定怪物原型是否允许进入自动波次。 */
  public isAutomaticMonsterEnabled(id: BattlefieldMonsterId): boolean {
    return this.automaticMonsterEnabled[id];
  }

  /** 显式启停后续自动波次激活，不影响手动 Debug 生成。 */
  public setAutomaticGenerationEnabled(enabled: boolean): void {
    this.ensureActive();
    this.automaticGenerationActive = enabled;
  }

  /** 修改指定怪物原型的自动生成多选状态。 */
  public setAutomaticMonsterEnabled(id: BattlefieldMonsterId, enabled: boolean): void {
    this.ensureActive();
    this.automaticMonsterEnabled[id] = enabled;
  }

  /** 在精确世界坐标手动生成指定怪物，完全绕过自动生成配置。 */
  public spawnDebugMonster(id: BattlefieldMonsterId, x: number, z: number): void {
    this.ensureActive();
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      throw new Error('Debug 怪物生成坐标必须是有限数值。');
    }
    this.debugMonsters.spawn(id, x, z);
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
      if (this.automaticGenerationActive) {
        this.waveElapsedSeconds += Math.max(
          0,
          Math.min(deltaTime, MAXIMUM_WAVE_DELTA_TIME),
        );
      }
      const desiredPopulationCount = calculateBattlefieldMonsterTargetCount(
        BATTLEFIELD_MONSTER_SPAWN,
        this.waveElapsedSeconds,
      );
      this.swarm?.maintainAround(
        target.x,
        target.z,
        this.automaticGenerationActive
          && this.automaticMonsterEnabled[BattlefieldMonsterId.CurveCrawler]
          ? desiredPopulationCount
          : 0,
      );
      const desiredVenomCount = calculateBattlefieldMonsterTargetCount(
        BATTLEFIELD_VENOM_LOBBER_CONFIG,
        this.waveElapsedSeconds,
      );
      this.venomGroup.maintainAround(
        target.x,
        target.z,
        this.automaticGenerationActive
          && this.automaticMonsterEnabled[BattlefieldMonsterId.VenomLobber]
          ? desiredVenomCount
          : 0,
      );
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
    damage += this.debugMonsters.update(deltaTime, target);
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
      this.debugMonsters.synchronizePostCrowdPose();
      return;
    }
    this.crowd.solve(safeDeltaTime);
    this.venomGroup.synchronizePostCrowdPose();
    this.debugMonsters.synchronizePostCrowdPose();
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
    this.debugMonsters.synchronizeRendering();

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
    this.manipulations.register(group);
    this.swarm = group;
  }

  /** 从真实枪口沿手动方向选择武器射程内最先经过的怪物轮廓。 */
  public resolveElevationAlongSegment(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    maximumDistance: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    return this.targets.resolveElevationAlongSegment(
      originX,
      originZ,
      directionX,
      directionZ,
      maximumDistance,
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
    statistics: MutableBattlefieldProjectileStatistics,
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
      statistics,
    );
  }

  /** 把 PostSimulation 中的弹丸伤害路由到稳定群体与实体。 */
  public damageMonster(populationId: number, entityId: number, amount: number): boolean {
    return !this.disposed && this.targets.damageMonster(populationId, entityId, amount);
  }

  public knockbackMonster(populationId: number, entityId: number, x: number, z: number): boolean {
    return !this.disposed && this.targets.knockbackMonster(populationId, entityId, x, z);
  }

  /** 选择玩家方向锥内唯一合法的小型半血怪物。 */
  public findGrabbable(
    query: Readonly<BattlefieldGrabTargetQuery>,
    result: MutableBattlefieldManipulationCandidate,
  ): boolean {
    return !this.disposed && this.manipulations.findGrabbable(query, result);
  }

  public beginCarry(populationId: number, entityId: number): boolean {
    return !this.disposed && this.manipulations.beginCarry(populationId, entityId);
  }

  public beginThrow(populationId: number, entityId: number): boolean {
    return !this.disposed && this.manipulations.beginThrow(populationId, entityId);
  }

  public synchronizeManipulatedPose(
    populationId: number,
    entityId: number,
    x: number,
    y: number,
    z: number,
    heading: number,
  ): boolean {
    return !this.disposed && this.manipulations.synchronizePose(
      populationId,
      entityId,
      x,
      y,
      z,
      heading,
    );
  }

  public releaseManipulation(populationId: number, entityId: number): boolean {
    return !this.disposed && this.manipulations.release(populationId, entityId);
  }

  public killManipulated(populationId: number, entityId: number): boolean {
    return !this.disposed && this.manipulations.kill(populationId, entityId);
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
    this.debugMonsters.dispose();
    while (this.groups.length > 0) {
      const group = this.groups.pop();
      if (group !== undefined) {
        this.manipulations.unregister(group);
        this.targets.unregister(group);
        this.crowd.unregister(group.populationId);
        group.dispose();
      }
    }
    this.renderBatch.dispose();
    if (this.renderRoot.isValid) {
      this.renderRoot.destroy();
    }
    this.swarm = null;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场怪物聚合群体已经释放。');
    }
  }

}
