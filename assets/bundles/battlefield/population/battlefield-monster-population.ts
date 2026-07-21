import { type Camera, type Material, Node } from 'cc';
import { type Disposable } from '../../../core/contracts/disposable';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import { BATTLEFIELD_VENOM_LOBBER_CONFIG } from '../model/battlefield-venom-lobber-config';
import { calculateBattlefieldMonsterTargetCount } from '../model/battlefield-monster-wave-schedule';
import {
  type BattlefieldMonsterCombatTarget,
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';
import { BattlefieldMonsterGroup } from './battlefield-monster-group';
import { BattlefieldMonsterFrustumVisibility } from './battlefield-monster-frustum-visibility';
import { BattlefieldMonsterTargetRegistry } from './battlefield-monster-target-registry';
import { BattlefieldVenomLobberGroup } from './battlefield-venom-lobber-group';
import {
  type BattlefieldMonsterPerformanceRecorder,
  BattlefieldMonsterPerformanceStage,
} from './battlefield-monster-performance';

const DEBUG_CURVE_CRAWLER_SEED = 0x51d3b9;
const DEBUG_CURVE_CRAWLER_WORLD_DIAMETER = 0.01;
const MAXIMUM_WAVE_DELTA_TIME = 0.05;

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
  private readonly visibility: BattlefieldMonsterFrustumVisibility;
  private readonly renderBatch: ReturnType<
    RegisteredFeaturePlugin<FeatureId.CommonMonsters>['createCurveCrawlerBatch']
  >;
  private readonly groups: BattlefieldMonsterGroup[] = [];
  private readonly targets = new BattlefieldMonsterTargetRegistry();
  private readonly venomGroup: BattlefieldVenomLobberGroup;
  private swarm: BattlefieldMonsterGroup | null = null;
  private debugGroup: BattlefieldMonsterGroup | null = null;
  private waveElapsedSeconds = 0;
  private detailCenterX = 0;
  private detailCenterZ = 0;
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    camera: Camera,
    commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>,
    initialCenterX: number,
    initialCenterZ: number,
  ) {
    if (!Number.isFinite(initialCenterX) || !Number.isFinite(initialCenterZ)) {
      throw new Error('战场怪物群初始中心必须使用有限坐标。');
    }
    const config = BATTLEFIELD_MONSTER_SPAWN;
    this.visibility = new BattlefieldMonsterFrustumVisibility(camera);
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
        this.visibility,
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
        this.visibility,
        commonMonsters,
        initialCenterX,
        initialCenterZ,
      );
      this.targets.register(venomGroup);
    } catch (error: unknown) {
      venomGroup?.dispose();
      while (this.groups.length > 0) {
        const group = this.groups.pop();
        if (group !== undefined) {
          this.targets.unregister(group);
          group.dispose();
        }
      }
      this.renderBatch.dispose();
      renderRoot.destroy();
      throw error;
    }
    this.detailCenterX = initialCenterX;
    this.detailCenterZ = initialCenterZ;
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

  /** 当前通过相机视锥筛选并实际进入动态网格的怪物数量。 */
  public get visibleCount(): number {
    return this.renderBatch.visibleEntityCount + this.venomGroup.visibleCount;
  }

  /** 当前共享动态网格已经分配的可见实体容量。 */
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
    );
    this.groups.push(group);
    this.targets.register(group);
    this.debugGroup = group;
  }

  /** 推进全部活动地图群体并汇总本帧伤害。 */
  public update(
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
      this.detailCenterX = target.x;
      this.detailCenterZ = target.z;
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
    this.visibility.synchronize(this.detailCenterX, this.detailCenterZ);
    performance.endMonsterStage(
      BattlefieldMonsterPerformanceStage.Visibility,
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

    const previousCapacity = this.renderBatch.renderCapacity;
    stageStarted = performance.beginMonsterStage();
    this.renderBatch.synchronize();
    performance.endMonsterStage(
      BattlefieldMonsterPerformanceStage.RenderingSynchronization,
      stageStarted,
    );
    const nextCapacity = this.renderBatch.renderCapacity;
    if (nextCapacity > previousCapacity) {
      performance.recordMonsterBatchGrowth(previousCapacity, nextCapacity);
    }
    return damage;
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
    );
    this.groups.push(group);
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

  /** 查找一段世界子弹位移最先接触的怪物，并只对该实体施加一次伤害。 */
  public damageFirstAlongSegment(
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    impactRadius: number,
    damage: number,
    result: MutableBattlefieldProjectileHit,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    return this.targets.damageFirstAlongSegment(
      startX,
      startY,
      startZ,
      endX,
      endY,
      endZ,
      impactRadius,
      damage,
      result,
    );
  }

  /** 释放尸潮状态、共享渲染批次和调试实体。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.targets.unregister(this.venomGroup);
    this.venomGroup.dispose();
    while (this.groups.length > 0) {
      const group = this.groups.pop();
      if (group !== undefined) {
        this.targets.unregister(group);
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
