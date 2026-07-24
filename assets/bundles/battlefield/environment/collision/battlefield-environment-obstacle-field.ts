import {
  type MutablePlanarPosition,
  type PlanarMovementConstraint,
} from '../../../../core/contracts/planar-movement-constraint';
import {
  BATTLEFIELD_ENVIRONMENT_CATALOG,
} from '../catalog/battlefield-environment-catalog';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../model/battlefield-environment-config';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';

const MAXIMUM_OBSTACLE_COUNT = 512;
const RESOLUTION_ITERATIONS = 3;
const DISTANCE_EPSILON = 0.00001;

/**
 * 为静态环境障碍建立无逐帧分配的均匀网格。
 *
 * 树干、岩体、残骸和祭台仅使用平面圆形占地；可视 Mesh 不参与碰撞。
 */
export class BattlefieldEnvironmentObstacleField implements PlanarMovementConstraint {
  private readonly obstacleX = new Float32Array(MAXIMUM_OBSTACLE_COUNT);
  private readonly obstacleZ = new Float32Array(MAXIMUM_OBSTACLE_COUNT);
  private readonly obstacleRadius = new Float32Array(MAXIMUM_OBSTACLE_COUNT);
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

    for (const definition of BATTLEFIELD_ENVIRONMENT_CATALOG) {
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

  private addObstacle(x: number, z: number, radius: number): void {
    if (!Number.isFinite(radius) || radius <= 0) {
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
