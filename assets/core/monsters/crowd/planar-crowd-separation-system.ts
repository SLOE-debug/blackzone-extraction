import { MonsterLifecycleState } from '../../contracts/monster-lifecycle';
import { type PlanarCrowdCandidateBuffer } from './planar-crowd-candidate-buffer';
import {
  type PlanarCrowdPopulation,
  validatePlanarCrowdPopulation,
} from './planar-crowd-population';

const DISTANCE_EPSILON_SQUARED = 0.000001;
const COINCIDENT_DIRECTIONS = new Float32Array([
  1, 0, 0.70710678, 0.70710678, 0, 1, -0.70710678, 0.70710678,
  -1, 0, -0.70710678, -0.70710678, 0, -1, 0.70710678, -0.70710678,
]);

/** 统一空间哈希与 Jacobi 位置约束的稳定配置。 */
export interface PlanarCrowdSeparationOptions {
  readonly cellSize: number;
  readonly solverIterations: number;
  readonly stiffness: number;
  readonly maximumCorrectionSpeed: number;
}

export const DEFAULT_PLANAR_CROWD_SEPARATION_OPTIONS = Object.freeze({
  cellSize: 16,
  solverIterations: 3,
  stiffness: 0.88,
  maximumCorrectionSpeed: 52,
}) satisfies Readonly<PlanarCrowdSeparationOptions>;

/**
 * 在 Battlefield World 级别统一约束全部怪物群体，并提供共享宽相位空间查询。
 *
 * 注册只发生在群体创建或销毁阶段；逐帧重建与求解只复用预分配 TypedArray。
 */
export class PlanarCrowdSeparationSystem {
  private readonly populations: PlanarCrowdPopulation[] = [];
  private bucketHeads = new Int32Array(1);
  private nextInBucket = new Int32Array(0);
  private cellX = new Int32Array(0);
  private cellY = new Int32Array(0);
  private populationIndices = new Uint32Array(0);
  private entityIndices = new Uint32Array(0);
  private correctionX = new Float32Array(0);
  private correctionY = new Float32Array(0);
  private bucketMask = 0;
  private activeCount = 0;
  private maximumRadius = 0;

  constructor(
    private readonly options: Readonly<PlanarCrowdSeparationOptions>
      = DEFAULT_PLANAR_CROWD_SEPARATION_OPTIONS,
  ) {
    validateOptions(options);
  }

  public get capacity(): number {
    return this.entityIndices.length;
  }

  public register(population: PlanarCrowdPopulation): void {
    validatePlanarCrowdPopulation(population);
    if (this.populations.some((entry) => entry.populationId === population.populationId)) {
      throw new Error(`Crowd 群体标识重复：${population.populationId}`);
    }
    this.populations.push(population);
    this.resizeWorkspace();
  }

  public unregister(populationId: number): void {
    const index = this.populations.findIndex((entry) => entry.populationId === populationId);
    if (index < 0) {
      return;
    }
    this.populations.splice(index, 1);
    this.resizeWorkspace();
  }

  /** 重建全部 Alive 怪物共享的空间哈希。 */
  public rebuild(): void {
    this.bucketHeads.fill(-1);
    this.nextInBucket.fill(-1);
    this.activeCount = 0;
    this.maximumRadius = 0;
    const inverseCellSize = 1 / this.options.cellSize;
    for (let populationIndex = 0; populationIndex < this.populations.length; populationIndex++) {
      const population = this.populations[populationIndex];
      if (population === undefined) {
        continue;
      }
      for (let entityIndex = 0; entityIndex < population.count; entityIndex++) {
        if ((population.lifecycle[entityIndex] as MonsterLifecycleState)
          !== MonsterLifecycleState.Alive) {
          continue;
        }
        const slot = this.activeCount++;
        const cellX = Math.floor((population.x[entityIndex] ?? 0) * inverseCellSize);
        const cellY = Math.floor((population.y[entityIndex] ?? 0) * inverseCellSize);
        const bucket = this.hashCell(cellX, cellY);
        this.populationIndices[slot] = populationIndex;
        this.entityIndices[slot] = entityIndex;
        this.cellX[slot] = cellX;
        this.cellY[slot] = cellY;
        this.nextInBucket[slot] = this.bucketHeads[bucket] ?? -1;
        this.bucketHeads[bucket] = slot;
        this.maximumRadius = Math.max(this.maximumRadius, population.radius[entityIndex] ?? 0);
      }
    }
  }

  /** 按逆质量分配修正量；数值越大越容易为重型实体让路。 */
  public solve(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('Crowd 约束帧时间必须是有限非负数。');
    }
    if (deltaTime === 0) {
      return;
    }
    const maximumCorrection = this.options.maximumCorrectionSpeed
      * deltaTime
      / this.options.solverIterations;
    for (let iteration = 0; iteration < this.options.solverIterations; iteration++) {
      this.rebuild();
      if (this.activeCount < 2) {
        return;
      }
      this.accumulateCorrections();
      this.applyCorrections(maximumCorrection);
    }
    this.rebuild();
  }

  /** 用线段平面包围盒遍历一次共享空间索引，写出潜在命中实体。 */
  public collectSegmentCandidates(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    queryRadius: number,
    result: PlanarCrowdCandidateBuffer,
  ): number {
    if (![startX, startY, endX, endY, queryRadius].every(Number.isFinite)
      || queryRadius < 0) {
      throw new Error('Crowd 线段候选查询参数无效。');
    }
    result.reset();
    const padding = queryRadius + this.maximumRadius;
    const inverseCellSize = 1 / this.options.cellSize;
    const minimumCellX = Math.floor((Math.min(startX, endX) - padding) * inverseCellSize);
    const maximumCellX = Math.floor((Math.max(startX, endX) + padding) * inverseCellSize);
    const minimumCellY = Math.floor((Math.min(startY, endY) - padding) * inverseCellSize);
    const maximumCellY = Math.floor((Math.max(startY, endY) + padding) * inverseCellSize);
    for (let cellY = minimumCellY; cellY <= maximumCellY; cellY++) {
      for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
        let slot = this.bucketHeads[this.hashCell(cellX, cellY)] ?? -1;
        while (slot >= 0) {
          const next = this.nextInBucket[slot] ?? -1;
          if ((this.cellX[slot] ?? 0) === cellX && (this.cellY[slot] ?? 0) === cellY) {
            const population = this.populations[this.populationIndices[slot] ?? 0];
            if (population !== undefined) {
              result.include(population.populationId, this.entityIndices[slot] ?? 0);
            }
          }
          slot = next;
        }
      }
    }
    return result.count;
  }

  /** 遍历圆形范围覆盖的网格，并写出可供瞄准或 AOE 窄相位复用的候选。 */
  public collectCircleCandidates(
    centerX: number,
    centerY: number,
    radius: number,
    result: PlanarCrowdCandidateBuffer,
  ): number {
    if (![centerX, centerY, radius].every(Number.isFinite) || radius < 0) {
      throw new Error('Crowd 圆形候选查询参数无效。');
    }
    result.reset();
    const padding = radius + this.maximumRadius;
    const inverseCellSize = 1 / this.options.cellSize;
    const minimumCellX = Math.floor((centerX - padding) * inverseCellSize);
    const maximumCellX = Math.floor((centerX + padding) * inverseCellSize);
    const minimumCellY = Math.floor((centerY - padding) * inverseCellSize);
    const maximumCellY = Math.floor((centerY + padding) * inverseCellSize);
    for (let cellY = minimumCellY; cellY <= maximumCellY; cellY++) {
      for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
        let slot = this.bucketHeads[this.hashCell(cellX, cellY)] ?? -1;
        while (slot >= 0) {
          const next = this.nextInBucket[slot] ?? -1;
          if ((this.cellX[slot] ?? 0) === cellX && (this.cellY[slot] ?? 0) === cellY) {
            const population = this.populations[this.populationIndices[slot] ?? 0];
            const entityIndex = this.entityIndices[slot] ?? 0;
            if (population !== undefined) {
              const deltaX = (population.x[entityIndex] ?? 0) - centerX;
              const deltaY = (population.y[entityIndex] ?? 0) - centerY;
              const contactRadius = radius + (population.radius[entityIndex] ?? 0);
              if (deltaX * deltaX + deltaY * deltaY <= contactRadius * contactRadius) {
                result.include(population.populationId, entityIndex);
              }
            }
          }
          slot = next;
        }
      }
    }
    return result.count;
  }

  private accumulateCorrections(): void {
    this.correctionX.fill(0, 0, this.activeCount);
    this.correctionY.fill(0, 0, this.activeCount);
    const neighborRange = Math.max(
      1,
      Math.ceil(this.maximumRadius * 2 / this.options.cellSize),
    );
    for (let first = 0; first < this.activeCount; first++) {
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
              this.accumulatePair(first, second);
            }
            second = next;
          }
        }
      }
    }
  }

  private accumulatePair(firstSlot: number, secondSlot: number): void {
    const firstPopulation = this.populations[this.populationIndices[firstSlot] ?? 0];
    const secondPopulation = this.populations[this.populationIndices[secondSlot] ?? 0];
    if (firstPopulation === undefined || secondPopulation === undefined) {
      return;
    }
    const firstEntity = this.entityIndices[firstSlot] ?? 0;
    const secondEntity = this.entityIndices[secondSlot] ?? 0;
    let deltaX = (secondPopulation.x[secondEntity] ?? 0)
      - (firstPopulation.x[firstEntity] ?? 0);
    let deltaY = (secondPopulation.y[secondEntity] ?? 0)
      - (firstPopulation.y[firstEntity] ?? 0);
    const minimumDistance = (firstPopulation.radius[firstEntity] ?? 0)
      + (secondPopulation.radius[secondEntity] ?? 0);
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared >= minimumDistance * minimumDistance) {
      return;
    }
    let distance = 0;
    if (distanceSquared > DISTANCE_EPSILON_SQUARED) {
      distance = Math.sqrt(distanceSquared);
      deltaX /= distance;
      deltaY /= distance;
    } else {
      const direction = calculateCoincidentDirection(firstSlot, secondSlot);
      deltaX = COINCIDENT_DIRECTIONS[direction] ?? 1;
      deltaY = COINCIDENT_DIRECTIONS[direction + 1] ?? 0;
    }
    const firstInverseMass = firstPopulation.inverseMass[firstEntity] ?? 1;
    const secondInverseMass = secondPopulation.inverseMass[secondEntity] ?? 1;
    const inverseMassSum = Math.max(firstInverseMass + secondInverseMass, 0.0001);
    const correction = (minimumDistance - distance) * this.options.stiffness;
    const firstCorrection = correction * firstInverseMass / inverseMassSum;
    const secondCorrection = correction * secondInverseMass / inverseMassSum;
    this.correctionX[firstSlot] = (this.correctionX[firstSlot] ?? 0) - deltaX * firstCorrection;
    this.correctionY[firstSlot] = (this.correctionY[firstSlot] ?? 0) - deltaY * firstCorrection;
    this.correctionX[secondSlot] = (this.correctionX[secondSlot] ?? 0) + deltaX * secondCorrection;
    this.correctionY[secondSlot] = (this.correctionY[secondSlot] ?? 0) + deltaY * secondCorrection;
  }

  private applyCorrections(maximumCorrection: number): void {
    for (let slot = 0; slot < this.activeCount; slot++) {
      const population = this.populations[this.populationIndices[slot] ?? 0];
      if (population === undefined) {
        continue;
      }
      const entityIndex = this.entityIndices[slot] ?? 0;
      let correctionX = this.correctionX[slot] ?? 0;
      let correctionY = this.correctionY[slot] ?? 0;
      const lengthSquared = correctionX * correctionX + correctionY * correctionY;
      if (lengthSquared > maximumCorrection * maximumCorrection) {
        const scale = maximumCorrection / Math.sqrt(lengthSquared);
        correctionX *= scale;
        correctionY *= scale;
      }
      population.x[entityIndex] = (population.x[entityIndex] ?? 0) + correctionX;
      population.y[entityIndex] = (population.y[entityIndex] ?? 0) + correctionY;
    }
  }

  private resizeWorkspace(): void {
    let capacity = 0;
    for (const population of this.populations) {
      capacity += population.count;
    }
    this.nextInBucket = new Int32Array(capacity);
    this.cellX = new Int32Array(capacity);
    this.cellY = new Int32Array(capacity);
    this.populationIndices = new Uint32Array(capacity);
    this.entityIndices = new Uint32Array(capacity);
    this.correctionX = new Float32Array(capacity);
    this.correctionY = new Float32Array(capacity);
    const bucketCount = calculateBucketCount(Math.max(1, capacity));
    this.bucketHeads = new Int32Array(bucketCount);
    this.bucketMask = bucketCount - 1;
    this.rebuild();
  }

  private hashCell(cellX: number, cellY: number): number {
    return (Math.imul(cellX, 0x45d9f3b) ^ Math.imul(cellY, 0x119de1f3))
      & this.bucketMask;
  }
}

function calculateCoincidentDirection(first: number, second: number): number {
  return ((Math.imul(first + 1, 0x9e3779b1) ^ Math.imul(second + 1, 0x85ebca6b)) & 7) * 2;
}

function calculateBucketCount(capacity: number): number {
  let count = 1;
  while (count < capacity * 4) {
    count *= 2;
  }
  return count;
}

function validateOptions(options: Readonly<PlanarCrowdSeparationOptions>): void {
  if (!Number.isFinite(options.cellSize) || options.cellSize <= 0
    || !Number.isSafeInteger(options.solverIterations) || options.solverIterations <= 0
    || !Number.isFinite(options.stiffness) || options.stiffness <= 0 || options.stiffness > 1
    || !Number.isFinite(options.maximumCorrectionSpeed)
    || options.maximumCorrectionSpeed <= 0) {
    throw new Error('Crowd 约束网格、迭代或速度参数无效。');
  }
}
