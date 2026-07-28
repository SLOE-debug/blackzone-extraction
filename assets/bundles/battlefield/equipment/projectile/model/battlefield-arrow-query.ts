import { type BattlefieldTetherHitBuffer } from './battlefield-tether-hit-buffer';

/** 箭头从上一帧到当前帧的连续胶囊扫掠。 */
export interface BattlefieldArrowSweepQuery {
  readonly startX: number;
  readonly startY: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endY: number;
  readonly endZ: number;
  readonly radius: number;
}

/** 持续弦线与怪物脚底至身体顶部范围的低频重叠查询。 */
export interface BattlefieldTetherQuery {
  readonly startX: number;
  readonly startY: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endY: number;
  readonly endZ: number;
  readonly radius: number;
}

/** 箭矢附着系统读取的稳定怪物世界姿态。 */
export interface MutableBattlefieldArrowTargetPose {
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
  halfHeight: number;
}

/** 只沿玩家给出的平面朝向寻找垂直辅助瞄准目标。 */
export interface BattlefieldArrowAimQuery {
  readonly originX: number;
  readonly originY: number;
  readonly originZ: number;
  readonly directionX: number;
  readonly directionZ: number;
  readonly maximumDistance: number;
  readonly projectileRadius: number;
}

/** 垂直辅助瞄准返回的怪物身体中心。 */
export interface MutableBattlefieldArrowAimTarget {
  x: number;
  y: number;
  z: number;
}

/** 预分配的有序箭矢扫掠结果。 */
export class BattlefieldArrowHitBuffer {
  public readonly populationId: Uint32Array;
  public readonly entityId: Uint32Array;
  public readonly x: Float32Array;
  public readonly y: Float32Array;
  public readonly z: Float32Array;
  public readonly progress: Float32Array;
  private hitCount = 0;

  constructor(public readonly capacity = 128) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('箭矢命中缓冲容量必须为正安全整数。');
    }
    this.populationId = new Uint32Array(capacity);
    this.entityId = new Uint32Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.progress = new Float32Array(capacity);
  }

  public get count(): number {
    return this.hitCount;
  }

  public reset(): void {
    this.hitCount = 0;
  }

  /** 按扫掠进度插入，保证穿透始终从近到远处理。 */
  public include(
    populationId: number,
    entityId: number,
    x: number,
    y: number,
    z: number,
    progress: number,
  ): void {
    if (this.hitCount >= this.capacity) {
      throw new Error('箭矢命中缓冲容量不足。');
    }
    let insertion = this.hitCount;
    while (insertion > 0 && (this.progress[insertion - 1] ?? 0) > progress) {
      this.copy(insertion - 1, insertion);
      insertion--;
    }
    this.populationId[insertion] = populationId;
    this.entityId[insertion] = entityId;
    this.x[insertion] = x;
    this.y[insertion] = y;
    this.z[insertion] = z;
    this.progress[insertion] = progress;
    this.hitCount++;
  }

  private copy(source: number, target: number): void {
    this.populationId[target] = this.populationId[source] ?? 0;
    this.entityId[target] = this.entityId[source] ?? 0;
    this.x[target] = this.x[source] ?? 0;
    this.y[target] = this.y[source] ?? 0;
    this.z[target] = this.z[source] ?? 0;
    this.progress[target] = this.progress[source] ?? 0;
  }
}

/** 归弦猎弓依赖的怪物空间查询与效果门面。 */
export interface BattlefieldArrowCombatTarget {
  writeBestArrowAimTarget(
    query: Readonly<BattlefieldArrowAimQuery>,
    result: MutableBattlefieldArrowAimTarget,
  ): boolean;
  collectArrowSweepHits(
    query: Readonly<BattlefieldArrowSweepQuery>,
    result: BattlefieldArrowHitBuffer,
  ): number;
  collectTetherOverlapHits(
    query: Readonly<BattlefieldTetherQuery>,
    result: BattlefieldTetherHitBuffer,
  ): number;
  writeArrowTargetPose(
    populationId: number,
    entityId: number,
    result: MutableBattlefieldArrowTargetPose,
  ): boolean;
  damageMonster(populationId: number, entityId: number, amount: number): boolean;
  applyArrowSlow(
    populationId: number,
    entityId: number,
    scale: number,
    durationSeconds: number,
  ): boolean;
  applyArrowPull(
    populationId: number,
    entityId: number,
    directionX: number,
    directionZ: number,
    strength: number,
  ): boolean;
}
