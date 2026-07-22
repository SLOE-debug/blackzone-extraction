import { geometry, type Mat4, Vec3 } from 'cc';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { type CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';

const LOCAL_VISIBILITY_CENTER_HEIGHT = 3;
const LOCAL_VISIBILITY_RADIUS = 28;

/** 维护通过世界相机视锥测试的逐实体紧凑清单。 */
export class CurveCrawlerVisibilityLayout {
  public readonly entityIndices: Uint32Array;
  private readonly visibleEntities: Uint8Array;
  private readonly nextVisibleEntities: Uint8Array;
  private readonly changedEntities: Uint8Array;
  private readonly localCenter = new Vec3();
  private readonly worldCenter = new Vec3();
  private readonly sphere = new geometry.Sphere();
  private visibleCount = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Curve Crawler 可见布局容量必须是正整数。');
    }
    this.entityIndices = new Uint32Array(capacity);
    this.visibleEntities = new Uint8Array(capacity);
    this.nextVisibleEntities = new Uint8Array(capacity);
    this.changedEntities = new Uint8Array(capacity);
  }

  /** 当前通过视锥测试的驻留实体数量。 */
  public get count(): number {
    return this.visibleCount;
  }

  /** 返回实体本帧是否进入或离开了可见集合。 */
  public didEntityChange(entityIndex: number): boolean {
    return (this.changedEntities[entityIndex] ?? 0) !== 0;
  }

  /** 使用同一帧已经刷新的相机视锥同步可见清单。 */
  public synchronize(
    state: CurveCrawlerState,
    residents: CurveCrawlerResidentLayout,
    worldMatrix: Readonly<Mat4>,
    maximumWorldScale: number,
    frustum: geometry.Frustum,
  ): boolean {
    if (!Number.isFinite(maximumWorldScale) || maximumWorldScale <= 0) {
      throw new Error('Curve Crawler 可见布局世界缩放必须是有限正数。');
    }
    this.changedEntities.fill(0);
    this.nextVisibleEntities.fill(0);
    let nextCount = 0;
    let changed = false;
    const { transform } = state.data;
    for (let packedIndex = 0; packedIndex < residents.count; packedIndex++) {
      const entityIndex = residents.entityIndices[packedIndex];
      if (entityIndex === undefined || entityIndex >= state.count) {
        throw new Error('Curve Crawler 可见布局包含越界实体。');
      }
      this.localCenter.set(
        transform.x[entityIndex] ?? 0,
        transform.y[entityIndex] ?? 0,
        LOCAL_VISIBILITY_CENTER_HEIGHT,
      );
      Vec3.transformMat4(this.worldCenter, this.localCenter, worldMatrix);
      geometry.Sphere.set(
        this.sphere,
        this.worldCenter.x,
        this.worldCenter.y,
        this.worldCenter.z,
        LOCAL_VISIBILITY_RADIUS * maximumWorldScale,
      );
      if (geometry.intersect.sphereFrustum(this.sphere, frustum) === 0) {
        continue;
      }
      this.nextVisibleEntities[entityIndex] = 1;
      this.entityIndices[nextCount++] = entityIndex;
    }
    for (let entityIndex = 0; entityIndex < state.count; entityIndex++) {
      if ((this.nextVisibleEntities[entityIndex] ?? 0)
        === (this.visibleEntities[entityIndex] ?? 0)) {
        continue;
      }
      this.changedEntities[entityIndex] = 1;
      changed = true;
    }
    this.visibleEntities.set(this.nextVisibleEntities);
    if (nextCount !== this.visibleCount) {
      changed = true;
    }
    this.visibleCount = nextCount;
    return changed;
  }
}
