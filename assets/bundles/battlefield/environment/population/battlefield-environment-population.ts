import { Node } from 'cc';
import { type PlanarMovementConstraint } from '../../../../core/contracts/planar-movement-constraint';
import { type ChunkCoordinate } from '../../../../core/world/chunk-coordinate';
import {
  ChunkWindowTracker,
  type ChunkWindowTransition,
} from '../../../../core/world/chunk-window-tracker';
import { BattlefieldEnvironmentObstacleField } from '../collision/battlefield-environment-obstacle-field';
import {
  BattlefieldEnvironmentGenerator,
} from '../generation/battlefield-environment-generator';
import { worldCoordinateToEnvironmentChunk } from '../model/battlefield-environment-chunk';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../model/battlefield-environment-config';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';
import { BattlefieldEnvironmentPrototype } from '../model/battlefield-environment-prototype';
import { BattlefieldEnvironmentRenderer } from '../rendering/battlefield-environment-renderer';

/** 环境窗口中一个可生成怪物群体的巢穴描述。 */
export interface BattlefieldMonsterNestSpawn {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly seed: number;
}

/**
 * 战场环境 ECS 门面。
 *
 * 门面只编排确定性 Chunk 生成、静态障碍索引和统一大网格，不承载造型配方。
 */
export class BattlefieldEnvironmentPopulation {
  private readonly world = new BattlefieldEnvironmentWorldState();
  private readonly generator = new BattlefieldEnvironmentGenerator();
  private readonly obstacles = new BattlefieldEnvironmentObstacleField();
  private readonly chunkWindow = new ChunkWindowTracker(
    BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.activeChunkRadius,
  );
  private readonly renderer: BattlefieldEnvironmentRenderer;
  private pendingChunkTransition: Readonly<ChunkWindowTransition> | null = null;
  private centerChunkX = 0;
  private centerChunkZ = 0;
  private disposed = false;

  constructor(parent: Node) {
    this.generator.populate(this.centerChunkX, this.centerChunkZ, this.world);
    this.obstacles.rebuild(this.world, this.centerChunkX, this.centerChunkZ);
    this.renderer = new BattlefieldEnvironmentRenderer(parent, this.world);
    this.pendingChunkTransition = this.chunkWindow.synchronize(
      this.centerChunkX,
      this.centerChunkZ,
    );
  }

  /** 玩家移动系统使用的无分配平面障碍约束。 */
  public get movementConstraint(): PlanarMovementConstraint {
    return this.obstacles;
  }

  /** 玩家跨越 Chunk 边界时同步重用实体槽位、空间索引和 GPU 顶点流。 */
  public update(playerX: number, playerZ: number): void {
    this.ensureActive();
    const nextChunkX = worldCoordinateToEnvironmentChunk(playerX);
    const nextChunkZ = worldCoordinateToEnvironmentChunk(playerZ);
    if (nextChunkX === this.centerChunkX && nextChunkZ === this.centerChunkZ) {
      return;
    }
    if (this.pendingChunkTransition !== null) {
      throw new Error('上一次环境 Chunk 差集尚未被运行时消费。');
    }
    this.generator.populate(nextChunkX, nextChunkZ, this.world);
    this.obstacles.rebuild(this.world, nextChunkX, nextChunkZ);
    this.renderer.synchronize();
    this.centerChunkX = nextChunkX;
    this.centerChunkZ = nextChunkZ;
    this.pendingChunkTransition = this.chunkWindow.synchronize(nextChunkX, nextChunkZ);
  }

  /** 取走最近一次环境窗口切换产生的差集；没有变化时返回 null。 */
  public consumeChunkTransition(): Readonly<ChunkWindowTransition> | null {
    this.ensureActive();
    const transition = this.pendingChunkTransition;
    this.pendingChunkTransition = null;
    return transition;
  }

  /** 遍历指定活动 Chunk 中的全部怪物巢穴。 */
  public forEachMonsterNestInChunk(
    chunk: Readonly<ChunkCoordinate>,
    callback: (spawn: Readonly<BattlefieldMonsterNestSpawn>) => void,
  ): void {
    this.ensureActive();
    const nests = this.world.get(BattlefieldEnvironmentPrototype.MonsterNest);
    for (let index = 0; index < nests.enabledCount; index++) {
      if ((nests.data.chunk.x[index] ?? 0) !== chunk.x
        || (nests.data.chunk.z[index] ?? 0) !== chunk.z) {
        continue;
      }
      callback(Object.freeze({
        x: nests.data.transform.x[index] ?? 0,
        y: nests.data.transform.y[index] ?? 0,
        z: nests.data.transform.z[index] ?? 0,
        seed: nests.data.identity.randomSeed[index] ?? 1,
      }));
    }
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
