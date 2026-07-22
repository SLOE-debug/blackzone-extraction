import { geometry, type Mat4, Vec3 } from 'cc';
import { EntityVisibilitySet } from '../../../../../core/rendering/dynamic-entities/entity-visibility-set';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { type CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';

const LOCAL_VISIBILITY_CENTER_HEIGHT = 3;
const LOCAL_VISIBILITY_RADIUS = 28;

/** 维护通过世界相机视锥测试的逐实体紧凑清单。 */
export class CurveCrawlerVisibilityLayout {
  public readonly entities: EntityVisibilitySet;
  private readonly localCenter = new Vec3();
  private readonly worldCenter = new Vec3();
  private readonly sphere = new geometry.Sphere();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Curve Crawler 可见布局容量必须是正整数。');
    }
    this.entities = new EntityVisibilitySet(capacity);
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
    this.entities.begin();
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
      this.entities.include(entityIndex);
    }
    return this.entities.end();
  }
}
