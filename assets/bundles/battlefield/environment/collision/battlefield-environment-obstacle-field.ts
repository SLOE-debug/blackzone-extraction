import {
  type MutablePlanarPosition,
} from '../../../../core/contracts/planar-movement-constraint';
import {
  type MutableSpatialPosition,
  type SpatialMovementConstraint,
} from '../../../../core/contracts/spatial-movement-constraint';
import {
  BATTLEFIELD_ENVIRONMENT_CATALOG,
} from '../catalog/battlefield-environment-catalog';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../model/battlefield-environment-config';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';
import { type PreparedBattlefieldEnvironmentCatalog } from '../geometry/battlefield-environment-prepared-catalog';

const MAXIMUM_OBSTACLE_COUNT = 512;
const RESOLUTION_ITERATIONS = 3;
const DISTANCE_EPSILON = 0.00001;

/**
 * 为静态环境障碍建立无逐帧分配的均匀网格。
 *
 * 树干、岩体、残骸和祭台使用圆形占地与已编译程序网格高度区间；可视 Mesh 不直接参与碰撞。
 */
export class BattlefieldEnvironmentObstacleField implements SpatialMovementConstraint {
  private readonly obstacleX = new Float32Array(MAXIMUM_OBSTACLE_COUNT);
  private readonly obstacleZ = new Float32Array(MAXIMUM_OBSTACLE_COUNT);
  private readonly obstacleRadius = new Float32Array(MAXIMUM_OBSTACLE_COUNT);
  private readonly obstacleMinimumY = new Float32Array(MAXIMUM_OBSTACLE_COUNT);
  private readonly obstacleMaximumY = new Float32Array(MAXIMUM_OBSTACLE_COUNT);
  private readonly nextObstacle = new Int32Array(MAXIMUM_OBSTACLE_COUNT);
  private cellHeads = new Int32Array(1);
  private obstacleCount = 0;
  private columns = 1;
  private rows = 1;
  private minimumX = 0;
  private minimumZ = 0;
  private maximumObstacleRadius = 0;

  constructor() {
    this.cellHeads.fill(-1);
    this.nextObstacle.fill(-1);
  }

  /** 在环境窗口变化后重建一次静态空间索引。 */
  public rebuild(
    world: BattlefieldEnvironmentWorldState,
    prototypes: PreparedBattlefieldEnvironmentCatalog,
    centerChunkX: number,
    centerChunkZ: number,
  ): void {
    const config = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG;
    const worldDiameter = (config.activeChunkRadius * 2 + 1) * config.chunkSize;
    const padding = config.obstacleCellSize * 2;
    this.minimumX = centerChunkX * config.chunkSize - worldDiameter * 0.5 - padding;
    this.minimumZ = centerChunkZ * config.chunkSize - worldDiameter * 0.5 - padding;
    this.columns = Math.ceil((worldDiameter + padding * 2) / config.obstacleCellSize);
    this.rows = this.columns;
    const requiredHeads = this.columns * this.rows;
    if (this.cellHeads.length !== requiredHeads) {
      this.cellHeads = new Int32Array(requiredHeads);
    }
    this.cellHeads.fill(-1);
    this.nextObstacle.fill(-1);
    this.obstacleCount = 0;
    this.maximumObstacleRadius = 0;

    for (let definitionIndex = 0;
      definitionIndex < BATTLEFIELD_ENVIRONMENT_CATALOG.length;
      definitionIndex++) {
      const definition = BATTLEFIELD_ENVIRONMENT_CATALOG[definitionIndex];
      const prepared = prototypes[definitionIndex];
      if (definition === undefined
        || prepared === undefined
        || prepared.definition.prototype !== definition.prototype) {
        throw new Error('环境障碍与已编译原型 Catalog 顺序不一致。');
      }
      const state = world.get(definition.prototype);
      const { identity, transform, collision } = state.data;
      for (let index = 0; index < state.enabledCount; index++) {
        if ((identity.active[index] ?? 0) === 0
          || (collision.blocksPlayer[index] ?? 0) === 0) {
          continue;
        }
        this.addObstacle(
          transform.x[index] ?? 0,
          transform.z[index] ?? 0,
          collision.radius[index] ?? 0,
          (transform.y[index] ?? 0) + prepared.plan.bounds.minY
            * (transform.scale[index] ?? 1),
          (transform.y[index] ?? 0) + prepared.plan.bounds.maxY
            * (transform.scale[index] ?? 1),
        );
      }
    }
  }

  /** 将候选位置推出全部相交圆形占地，并允许沿障碍边缘自然滑动。 */
  public resolve(
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number,
    radius: number,
    result: MutablePlanarPosition,
  ): void {
    if (!Number.isFinite(startX)
      || !Number.isFinite(startZ)
      || !Number.isFinite(targetX)
      || !Number.isFinite(targetZ)
      || !Number.isFinite(radius)
      || radius <= 0) {
      throw new Error('环境平面碰撞输入必须是有限坐标和正占地半径。');
    }
    this.resolveInternal(
      startX,
      startZ,
      targetX,
      targetZ,
      radius,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      result,
    );
  }

  /** 只在轨迹球与障碍真实高度区间重叠时施加平面占地修正。 */
  public resolveSpatial(
    startX: number,
    startY: number,
    startZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    radius: number,
    result: MutableSpatialPosition,
  ): void {
    if (!Number.isFinite(startX)
      || !Number.isFinite(startY)
      || !Number.isFinite(startZ)
      || !Number.isFinite(targetX)
      || !Number.isFinite(targetY)
      || !Number.isFinite(targetZ)
      || !Number.isFinite(radius)
      || radius <= 0) {
      throw new Error('环境三维轨迹碰撞输入必须是有限坐标和正球形半径。');
    }
    result.y = targetY;
    this.resolveInternal(
      startX,
      startZ,
      targetX,
      targetZ,
      radius,
      targetY - radius,
      targetY + radius,
      result,
    );
  }

  private resolveInternal(
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number,
    radius: number,
    minimumY: number,
    maximumY: number,
    result: MutablePlanarPosition,
  ): void {
    result.x = targetX;
    result.z = targetZ;
    const queryRadius = radius + this.maximumObstacleRadius;
    for (let iteration = 0; iteration < RESOLUTION_ITERATIONS; iteration++) {
      let corrected = false;
      const minimumColumn = this.toClampedColumn(result.x - queryRadius);
      const maximumColumn = this.toClampedColumn(result.x + queryRadius);
      const minimumRow = this.toClampedRow(result.z - queryRadius);
      const maximumRow = this.toClampedRow(result.z + queryRadius);
      for (let row = minimumRow; row <= maximumRow; row++) {
        for (let column = minimumColumn; column <= maximumColumn; column++) {
          let obstacle = this.cellHeads[row * this.columns + column] ?? -1;
          while (obstacle >= 0) {
            if (maximumY < (this.obstacleMinimumY[obstacle] ?? 0)
              || minimumY > (this.obstacleMaximumY[obstacle] ?? 0)) {
              obstacle = this.nextObstacle[obstacle] ?? -1;
              continue;
            }
            const obstacleX = this.obstacleX[obstacle] ?? 0;
            const obstacleZ = this.obstacleZ[obstacle] ?? 0;
            const combinedRadius = radius + (this.obstacleRadius[obstacle] ?? 0);
            let deltaX = result.x - obstacleX;
            let deltaZ = result.z - obstacleZ;
            let distance = Math.hypot(deltaX, deltaZ);
            if (distance < combinedRadius) {
              if (distance <= DISTANCE_EPSILON) {
                deltaX = startX - obstacleX;
                deltaZ = startZ - obstacleZ;
                distance = Math.hypot(deltaX, deltaZ);
                if (distance <= DISTANCE_EPSILON) {
                  deltaX = 1;
                  deltaZ = 0;
                  distance = 1;
                }
              }
              const pushDistance = combinedRadius - distance;
              result.x += deltaX / distance * pushDistance;
              result.z += deltaZ / distance * pushDistance;
              corrected = true;
            }
            obstacle = this.nextObstacle[obstacle] ?? -1;
          }
        }
      }
      if (!corrected) {
        break;
      }
    }
  }

  private addObstacle(
    x: number,
    z: number,
    radius: number,
    minimumY: number,
    maximumY: number,
  ): void {
    if (!Number.isFinite(radius)
      || radius <= 0
      || !Number.isFinite(minimumY)
      || !Number.isFinite(maximumY)
      || maximumY < minimumY) {
      return;
    }
    if (this.obstacleCount >= MAXIMUM_OBSTACLE_COUNT) {
      throw new Error('战场环境障碍数量超过固定空间索引容量。');
    }
    const index = this.obstacleCount;
    const column = this.toClampedColumn(x);
    const row = this.toClampedRow(z);
    const cell = row * this.columns + column;
    this.obstacleX[index] = x;
    this.obstacleZ[index] = z;
    this.obstacleRadius[index] = radius;
    this.obstacleMinimumY[index] = minimumY;
    this.obstacleMaximumY[index] = maximumY;
    this.nextObstacle[index] = this.cellHeads[cell] ?? -1;
    this.cellHeads[cell] = index;
    this.maximumObstacleRadius = Math.max(this.maximumObstacleRadius, radius);
    this.obstacleCount += 1;
  }

  private toClampedColumn(x: number): number {
    const column = Math.floor(
      (x - this.minimumX) / BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.obstacleCellSize,
    );
    return Math.max(0, Math.min(this.columns - 1, column));
  }

  private toClampedRow(z: number): number {
    const row = Math.floor(
      (z - this.minimumZ) / BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.obstacleCellSize,
    );
    return Math.max(0, Math.min(this.rows - 1, row));
  }
}
