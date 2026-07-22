import { Node } from 'cc';
import { type PlanarMovementConstraint } from '../../../../core/contracts/planar-movement-constraint';
import {
  ChunkWindowTracker,
  type ChunkWindowTransition,
} from '../../../../core/world/chunk-window-tracker';
import { BattlefieldEnvironmentObstacleField } from '../collision/battlefield-environment-obstacle-field';
import { BattlefieldEnvironmentPlacementQuery } from '../collision/battlefield-environment-placement-query';
import { type BattlefieldEnvironmentPrototype } from '../catalog/battlefield-environment-catalog';
import { prepareBattlefieldEnvironment } from '../compilation/battlefield-environment-preparation';
import {
  BattlefieldEnvironmentGenerator,
} from '../generation/battlefield-environment-generator';
import { worldCoordinateToEnvironmentChunk } from '../model/battlefield-environment-chunk';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../model/battlefield-environment-config';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';
import { BattlefieldEnvironmentRenderer } from '../rendering/battlefield-environment-renderer';

/**
 * 战场环境 ECS 门面。
 *
 * 门面只编排确定性 Chunk 生成、静态障碍索引和统一窗口批次，不承载造型配方。
 */
export class BattlefieldEnvironmentPopulation {
  private readonly preparation = prepareBattlefieldEnvironment();
  private readonly world = new BattlefieldEnvironmentWorldState();
  private readonly generator = new BattlefieldEnvironmentGenerator();
  private readonly obstacles = new BattlefieldEnvironmentObstacleField();
  private readonly placement = new BattlefieldEnvironmentPlacementQuery(
    this.world,
    this.preparation.prototypes,
  );
  private readonly chunkWindow = new ChunkWindowTracker(
    BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.activeChunkRadius,
  );
  private readonly renderer: BattlefieldEnvironmentRenderer;
  private pendingChunkTransition: Readonly<ChunkWindowTransition> | null = null;
  private centerChunkX = 0;
  private centerChunkZ = 0;
  private disposed = false;

  /** 当前活动窗口实际启用的程序化环境实体数量。 */
  public get activeEntityCount(): number {
    let count = 0;
    this.world.forEach((_prototype, state) => {
      count += state.enabledCount;
    });
    return count;
  }

  /** 环境渲染器是否仍在分帧构建下一份统一窗口几何。 */
  public get renderingSynchronizing(): boolean {
    return this.renderer.synchronizing;
  }

  /** 当前环境窗口已经完成初始化的持久化 Chunk 批次数量。 */
  public get renderBatchCount(): number {
    return this.renderer.activeBatchCount;
  }

  /** 最近一次窗口变化仅为新增 Chunk 分配的几何字节数。 */
  public get geometryBytesAllocated(): number {
    return this.renderer.geometryBytesAllocated;
  }

  /** 最近一次窗口变化取消并替换的未完成 Chunk 构建器数量。 */
  public get builderReplacementCount(): number {
    return this.renderer.builderReplacementCount;
  }

  constructor(parent: Node) {
    this.generator.populate(this.centerChunkX, this.centerChunkZ, this.world);
    this.obstacles.rebuild(this.world, this.centerChunkX, this.centerChunkZ);
    const initialTransition = this.chunkWindow.synchronize(
      this.centerChunkX,
      this.centerChunkZ,
    );
    this.renderer = new BattlefieldEnvironmentRenderer(
      parent,
      this.world,
      this.preparation,
      initialTransition,
    );
    try {
      // 场景尚未激活，首份统一批次在加载阶段完成，避免把初始化成本泄漏到开场帧。
      this.renderer.completeInitialSynchronization();
    } catch (error: unknown) {
      this.renderer.dispose();
      throw error;
    }
    this.pendingChunkTransition = initialTransition;
  }

  /** 玩家移动系统使用的无分配平面障碍约束。 */
  public get movementConstraint(): PlanarMovementConstraint {
    return this.obstacles;
  }

  /** 供同一战场 Feature 的静态玩法物件避开选定环境原型。 */
  public isAreaClearOf(
    prototypes: readonly BattlefieldEnvironmentPrototype[],
    x: number,
    z: number,
    clearanceRadius: number,
  ): boolean {
    this.ensureActive();
    return this.placement.isAreaClearOf(prototypes, x, z, clearanceRadius);
  }

  /** 玩家跨越 Chunk 边界时重用实体槽位、重建空间索引并更新新增 Chunk 槽位。 */
  public update(playerX: number, playerZ: number): void {
    this.ensureActive();
    const nextChunkX = worldCoordinateToEnvironmentChunk(playerX);
    const nextChunkZ = worldCoordinateToEnvironmentChunk(playerZ);
    if (nextChunkX === this.centerChunkX && nextChunkZ === this.centerChunkZ) {
      this.renderer.updateSynchronization();
      return;
    }
    if (this.pendingChunkTransition !== null) {
      throw new Error('上一次环境 Chunk 差集尚未被运行时消费。');
    }
    this.generator.populate(nextChunkX, nextChunkZ, this.world);
    this.obstacles.rebuild(this.world, nextChunkX, nextChunkZ);
    const transition = this.chunkWindow.synchronize(nextChunkX, nextChunkZ);
    this.renderer.requestSynchronization(transition);
    this.centerChunkX = nextChunkX;
    this.centerChunkZ = nextChunkZ;
    this.pendingChunkTransition = transition;
  }

  /** 取走最近一次环境窗口切换产生的差集；没有变化时返回 null。 */
  public consumeChunkTransition(): Readonly<ChunkWindowTransition> | null {
    this.ensureActive();
    const transition = this.pendingChunkTransition;
    this.pendingChunkTransition = null;
    return transition;
  }

  /** 释放全部环境批次和共享材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.pendingChunkTransition = null;
    this.renderer.dispose();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场环境群体已经释放。');
    }
  }
}
