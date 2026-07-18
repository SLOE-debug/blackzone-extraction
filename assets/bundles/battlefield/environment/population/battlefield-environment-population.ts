import { Node } from 'cc';
import { type PlanarMovementConstraint } from '../../../../core/contracts/planar-movement-constraint';
import { BattlefieldEnvironmentObstacleField } from '../collision/battlefield-environment-obstacle-field';
import {
  BattlefieldEnvironmentGenerator,
} from '../generation/battlefield-environment-generator';
import { worldCoordinateToEnvironmentChunk } from '../model/battlefield-environment-chunk';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';
import { BattlefieldEnvironmentPrototype } from '../model/battlefield-environment-prototype';
import { BattlefieldEnvironmentRenderer } from '../rendering/battlefield-environment-renderer';

/** 调用方复用的怪物巢穴世界坐标。 */
export interface MutableBattlefieldMonsterNestPosition {
  x: number;
  z: number;
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
  private readonly renderer: BattlefieldEnvironmentRenderer;
  private centerChunkX = 0;
  private centerChunkZ = 0;
  private disposed = false;

  constructor(parent: Node) {
    this.generator.populate(this.centerChunkX, this.centerChunkZ, this.world);
    this.obstacles.rebuild(this.world, this.centerChunkX, this.centerChunkZ);
    this.renderer = new BattlefieldEnvironmentRenderer(parent, this.world);
  }

  /** 玩家移动系统使用的无分配平面障碍约束。 */
  public get movementConstraint(): PlanarMovementConstraint {
    return this.obstacles;
  }

  /** 玩家跨越 Chunk 边界时同步重用实体槽位、空间索引和 GPU 顶点流。 */
  public update(playerX: number, playerZ: number): boolean {
    this.ensureActive();
    const nextChunkX = worldCoordinateToEnvironmentChunk(playerX);
    const nextChunkZ = worldCoordinateToEnvironmentChunk(playerZ);
    if (nextChunkX === this.centerChunkX && nextChunkZ === this.centerChunkZ) {
      return false;
    }
    this.centerChunkX = nextChunkX;
    this.centerChunkZ = nextChunkZ;
    this.generator.populate(nextChunkX, nextChunkZ, this.world);
    this.obstacles.rebuild(this.world, nextChunkX, nextChunkZ);
    this.renderer.synchronize();
    return true;
  }

  /** 判断指定巢穴是否仍存在于当前活动窗口。 */
  public containsMonsterNest(x: number, z: number): boolean {
    const nests = this.world.get(BattlefieldEnvironmentPrototype.MonsterNest);
    for (let index = 0; index < nests.enabledCount; index++) {
      const deltaX = (nests.data.transform.x[index] ?? 0) - x;
      const deltaZ = (nests.data.transform.z[index] ?? 0) - z;
      if (deltaX * deltaX + deltaZ * deltaZ <= 0.01) {
        return true;
      }
    }
    return false;
  }

  /** 查找距离玩家最近的活动密林巢穴。 */
  public writeNearestMonsterNest(
    playerX: number,
    playerZ: number,
    result: MutableBattlefieldMonsterNestPosition,
  ): boolean {
    const nests = this.world.get(BattlefieldEnvironmentPrototype.MonsterNest);
    let bestIndex = -1;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (let index = 0; index < nests.enabledCount; index++) {
      const x = nests.data.transform.x[index] ?? 0;
      const z = nests.data.transform.z[index] ?? 0;
      const deltaX = x - playerX;
      const deltaZ = z - playerZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) {
      return false;
    }
    result.x = nests.data.transform.x[bestIndex] ?? 0;
    result.z = nests.data.transform.z[bestIndex] ?? 0;
    return true;
  }

  /** 释放全部环境批次和共享材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.renderer.dispose();
    this.disposed = true;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场环境群体已经释放。');
    }
  }
}
