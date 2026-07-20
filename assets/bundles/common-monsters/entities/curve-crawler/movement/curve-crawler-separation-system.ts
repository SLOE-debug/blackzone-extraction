import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { CurveCrawlerMotionProfile } from '../model/curve-crawler-motion-profile';
import {
  calculateCurveCrawlerSeparationRadius,
  CURVE_CRAWLER_SEPARATION_PROFILE,
  type CurveCrawlerSeparationProfile,
} from '../model/curve-crawler-separation-profile';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const DISTANCE_EPSILON_SQUARED = 0.000001;
const COINCIDENT_DIRECTIONS = new Float32Array([
  1, 0,
  0.70710678, 0.70710678,
  0, 1,
  -0.70710678, 0.70710678,
  -1, 0,
  -0.70710678, -0.70710678,
  0, -1,
  0.70710678, -0.70710678,
]);

/**
 * 使用固定容量空间哈希和位置约束，阻止大量活体蜘蛛占据相同平面空间。
 *
 * 每次迭代只枚举实体所在网格附近的桶；全部工作区均为预分配 TypedArray，
 * 因此追击热路径不会创建 Map、数组、坐标对象或闭包。
 */
export class CurveCrawlerSeparationSystem
implements EntitySystem<CurveCrawlerState, number> {
  private readonly bucketHeads: Int32Array;
  private readonly nextInBucket: Int32Array;
  private readonly cellX: Int32Array;
  private readonly cellY: Int32Array;
  private readonly radii: Float32Array;
  private readonly correctionX: Float32Array;
  private readonly correctionY: Float32Array;
  private readonly bucketMask: number;
  private activeCount = 0;
  private maximumRadius = 0;

  constructor(
    private readonly capacity: number,
    private readonly profile: Readonly<CurveCrawlerSeparationProfile>
      = CURVE_CRAWLER_SEPARATION_PROFILE,
  ) {
    validateConstructorOptions(capacity, profile);
    const bucketCount = calculateBucketCount(capacity);
    this.bucketHeads = new Int32Array(bucketCount);
    this.nextInBucket = new Int32Array(capacity);
    this.cellX = new Int32Array(capacity);
    this.cellY = new Int32Array(capacity);
    this.radii = new Float32Array(capacity);
    this.correctionX = new Float32Array(capacity);
    this.correctionY = new Float32Array(capacity);
    this.bucketMask = bucketCount - 1;
  }

  /** 在移动完成后执行少量 Jacobi 位置约束迭代。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    if (state.motionProfile === CurveCrawlerMotionProfile.ObservationDisplay) {
      return;
    }
    if (state.count > this.capacity) {
      throw new Error('Curve Crawler 分离工作区容量小于实体数量。');
    }
    if (!Number.isFinite(deltaTime)) {
      throw new Error('Curve Crawler 分离帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(0, deltaTime);
    if (safeDeltaTime === 0) {
      return;
    }
    const maximumCorrection = this.profile.maximumCorrectionSpeed
      * safeDeltaTime
      / this.profile.solverIterations;
    for (let iteration = 0; iteration < this.profile.solverIterations; iteration++) {
      this.buildSpatialHash(state);
      if (this.activeCount < 2) {
        return;
      }
      this.accumulateCorrections(state);
      this.applyCorrections(state, maximumCorrection);
    }
  }

  /** 重建活体实体空间哈希，并缓存本轮个体占地半径。 */
  private buildSpatialHash(state: CurveCrawlerState): void {
    this.bucketHeads.fill(-1);
    this.nextInBucket.fill(-1);
    this.activeCount = 0;
    this.maximumRadius = 0;
    const { transform, morphology, vitality } = state.data;
    const inverseCellSize = 1 / this.profile.cellSize;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState)
        !== MonsterLifecycleState.Alive) {
        continue;
      }
      const cellX = Math.floor((transform.x[index] ?? 0) * inverseCellSize);
      const cellY = Math.floor((transform.y[index] ?? 0) * inverseCellSize);
      const radius = calculateCurveCrawlerSeparationRadius(
        morphology.bodyWidth[index] ?? 0,
        morphology.legLength[index] ?? 0,
        morphology.legWidth[index] ?? 0,
        this.profile,
      );
      const bucket = this.hashCell(cellX, cellY);
      this.cellX[index] = cellX;
      this.cellY[index] = cellY;
      this.radii[index] = radius;
      this.nextInBucket[index] = this.bucketHeads[bucket] ?? -1;
      this.bucketHeads[bucket] = index;
      this.maximumRadius = Math.max(this.maximumRadius, radius);
      this.activeCount++;
    }
  }

  /** 对每一对邻近活体只计算一次等量反向的位置修正。 */
  private accumulateCorrections(state: CurveCrawlerState): void {
    this.correctionX.fill(0);
    this.correctionY.fill(0);
    const { transform, vitality } = state.data;
    const neighborRange = Math.max(
      1,
      Math.ceil(this.maximumRadius * 2 / this.profile.cellSize),
    );
    for (let first = 0; first < state.count; first++) {
      if ((vitality.state[first] as MonsterLifecycleState)
        !== MonsterLifecycleState.Alive) {
        continue;
      }
      const firstX = transform.x[first] ?? 0;
      const firstY = transform.y[first] ?? 0;
      const firstCellX = this.cellX[first] ?? 0;
      const firstCellY = this.cellY[first] ?? 0;
      for (let offsetY = -neighborRange; offsetY <= neighborRange; offsetY++) {
        const neighborCellY = firstCellY + offsetY;
        for (let offsetX = -neighborRange; offsetX <= neighborRange; offsetX++) {
          const neighborCellX = firstCellX + offsetX;
          let second = this.bucketHeads[this.hashCell(neighborCellX, neighborCellY)] ?? -1;
          while (second >= 0) {
            const next = this.nextInBucket[second] ?? -1;
            if (second > first
              && (this.cellX[second] ?? 0) === neighborCellX
              && (this.cellY[second] ?? 0) === neighborCellY) {
              this.accumulatePairCorrection(state, first, second, firstX, firstY);
            }
            second = next;
          }
        }
      }
    }
  }

  private accumulatePairCorrection(
    state: CurveCrawlerState,
    first: number,
    second: number,
    firstX: number,
    firstY: number,
  ): void {
    const transform = state.data.transform;
    let deltaX = (transform.x[second] ?? 0) - firstX;
    let deltaY = (transform.y[second] ?? 0) - firstY;
    const minimumDistance = (this.radii[first] ?? 0) + (this.radii[second] ?? 0);
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared >= minimumDistance * minimumDistance) {
      return;
    }

    let distance = 0;
    if (distanceSquared > DISTANCE_EPSILON_SQUARED) {
      distance = Math.sqrt(distanceSquared);
      const inverseDistance = 1 / distance;
      deltaX *= inverseDistance;
      deltaY *= inverseDistance;
    } else {
      const directionOffset = calculateCoincidentDirectionOffset(first, second);
      deltaX = COINCIDENT_DIRECTIONS[directionOffset] ?? 1;
      deltaY = COINCIDENT_DIRECTIONS[directionOffset + 1] ?? 0;
    }
    const correction = (minimumDistance - distance) * 0.5 * this.profile.stiffness;
    const correctionX = deltaX * correction;
    const correctionY = deltaY * correction;
    this.correctionX[first] = (this.correctionX[first] ?? 0) - correctionX;
    this.correctionY[first] = (this.correctionY[first] ?? 0) - correctionY;
    this.correctionX[second] = (this.correctionX[second] ?? 0) + correctionX;
    this.correctionY[second] = (this.correctionY[second] ?? 0) + correctionY;
  }

  /** 限制单帧修正速度后原地写回位置，避免拥挤时产生可见瞬移。 */
  private applyCorrections(state: CurveCrawlerState, maximumCorrection: number): void {
    const { transform, vitality } = state.data;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState)
        !== MonsterLifecycleState.Alive) {
        continue;
      }
      let correctionX = this.correctionX[index] ?? 0;
      let correctionY = this.correctionY[index] ?? 0;
      const correctionLength = Math.hypot(correctionX, correctionY);
      if (correctionLength > maximumCorrection) {
        const correctionScale = maximumCorrection / correctionLength;
        correctionX *= correctionScale;
        correctionY *= correctionScale;
      }
      transform.x[index] = (transform.x[index] ?? 0) + correctionX;
      transform.y[index] = (transform.y[index] ?? 0) + correctionY;
    }
  }

  private hashCell(cellX: number, cellY: number): number {
    return (
      Math.imul(cellX, 0x45d9f3b)
      ^ Math.imul(cellY, 0x119de1f3)
    ) & this.bucketMask;
  }
}

function calculateCoincidentDirectionOffset(first: number, second: number): number {
  const selector = (
    Math.imul(first + 1, 0x9e3779b1)
    ^ Math.imul(second + 1, 0x85ebca6b)
  ) & 7;
  return selector * 2;
}

function calculateBucketCount(capacity: number): number {
  let bucketCount = 1;
  const targetCount = capacity * 4;
  while (bucketCount < targetCount) {
    bucketCount *= 2;
  }
  return bucketCount;
}

function validateConstructorOptions(
  capacity: number,
  profile: Readonly<CurveCrawlerSeparationProfile>,
): void {
  if (!Number.isSafeInteger(capacity) || capacity <= 0
    || !Number.isFinite(profile.cellSize) || profile.cellSize <= 0
    || !Number.isFinite(profile.bodyRadiusScale) || profile.bodyRadiusScale < 0
    || !Number.isFinite(profile.legRadiusScale) || profile.legRadiusScale < 0
    || !Number.isFinite(profile.legWidthRadiusScale) || profile.legWidthRadiusScale < 0
    || !Number.isFinite(profile.minimumRadius) || profile.minimumRadius <= 0
    || !Number.isSafeInteger(profile.solverIterations) || profile.solverIterations <= 0
    || !Number.isFinite(profile.stiffness) || profile.stiffness <= 0 || profile.stiffness > 1
    || !Number.isFinite(profile.maximumCorrectionSpeed)
    || profile.maximumCorrectionSpeed <= 0) {
    throw new Error('Curve Crawler 分离容量、网格或约束参数无效。');
  }
}
