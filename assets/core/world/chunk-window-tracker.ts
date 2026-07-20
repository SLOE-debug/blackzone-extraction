import {
  createChunkCoordinate,
  toChunkCoordinateKey,
  type ChunkCoordinate,
  type ChunkCoordinateKey,
} from './chunk-coordinate';

/** 一次 Chunk 活动窗口切换产生的精确差集。 */
export interface ChunkWindowTransition {
  readonly previousCenter: Readonly<ChunkCoordinate> | null;
  readonly center: Readonly<ChunkCoordinate>;
  readonly added: readonly Readonly<ChunkCoordinate>[];
  readonly removed: readonly Readonly<ChunkCoordinate>[];
}

/**
 * 跟踪固定半径的方形 Chunk 窗口，只在中心变化时计算新增和移除差集。
 *
 * 该类不创建任何玩法对象；调用方可把差集交给独立的资源作用域管理器。
 */
export class ChunkWindowTracker {
  private active = new Map<ChunkCoordinateKey, Readonly<ChunkCoordinate>>();
  private currentCenter: Readonly<ChunkCoordinate> | null = null;

  constructor(private readonly radius: number) {
    if (!Number.isSafeInteger(radius) || radius < 0) {
      throw new Error('Chunk 活动窗口半径必须是非负安全整数。');
    }
  }

  /** 当前窗口中心；尚未同步过窗口时为 null。 */
  public get center(): Readonly<ChunkCoordinate> | null {
    return this.currentCenter;
  }

  /**
   * 切换到新中心并返回差集。
   *
   * @param centerX 新窗口中心的 X Chunk 坐标。
   * @param centerZ 新窗口中心的 Z Chunk 坐标。
   */
  public synchronize(centerX: number, centerZ: number): Readonly<ChunkWindowTransition> {
    const center = createChunkCoordinate(centerX, centerZ);
    const next = this.createWindow(center);
    const added: Readonly<ChunkCoordinate>[] = [];
    const removed: Readonly<ChunkCoordinate>[] = [];

    for (const [key, coordinate] of next) {
      if (!this.active.has(key)) {
        added.push(coordinate);
      }
    }
    for (const [key, coordinate] of this.active) {
      if (!next.has(key)) {
        removed.push(coordinate);
      }
    }

    const previousCenter = this.currentCenter;
    this.active = next;
    this.currentCenter = center;
    return Object.freeze({
      previousCenter,
      center,
      added: Object.freeze(added),
      removed: Object.freeze(removed),
    });
  }

  private createWindow(
    center: Readonly<ChunkCoordinate>,
  ): Map<ChunkCoordinateKey, Readonly<ChunkCoordinate>> {
    const window = new Map<ChunkCoordinateKey, Readonly<ChunkCoordinate>>();
    for (let z = center.z - this.radius; z <= center.z + this.radius; z++) {
      for (let x = center.x - this.radius; x <= center.x + this.radius; x++) {
        const coordinate = createChunkCoordinate(x, z);
        window.set(toChunkCoordinateKey(coordinate), coordinate);
      }
    }
    return window;
  }
}
