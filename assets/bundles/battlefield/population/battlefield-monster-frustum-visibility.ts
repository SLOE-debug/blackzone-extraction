import { Camera, geometry } from 'cc';
import {
  type PlanarCircleVisibility,
  PlanarVisibilityDetail,
} from '../../../core/contracts/planar-circle-visibility';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';

const CULLING_CENTER_HEIGHT = 1.1;
const CULLING_PADDING = 2.4;
const FULL_DETAIL_ENTER_DISTANCE_SQUARED = 8 * 8;
const FULL_DETAIL_LEAVE_DISTANCE_SQUARED = 10 * 10;
const MINIMAL_DETAIL_ENTER_DISTANCE_SQUARED = 18 * 18;
const MINIMAL_DETAIL_LEAVE_DISTANCE_SQUARED = 16 * 16;

/**
 * 把 Curve Crawler 局部 XY 平面圆转换为战场世界球，并与当前相机视锥相交测试。
 *
 * 单个可复用 Sphere 服务全部怪物，不在逐实体路径创建 Cocos 数学对象。
 */
export class BattlefieldMonsterFrustumVisibility implements PlanarCircleVisibility {
  private readonly sphere = geometry.Sphere.create(0, 0, 0, 1);
  private detailCenterWorldX = 0;
  private detailCenterWorldZ = 0;

  constructor(private readonly camera: Camera) {}

  /** 相机节点移动后显式刷新底层渲染相机矩阵与 Frustum。 */
  public synchronize(detailCenterWorldX: number, detailCenterWorldZ: number): void {
    if (!Number.isFinite(detailCenterWorldX) || !Number.isFinite(detailCenterWorldZ)) {
      throw new Error('怪物细节中心必须使用有限世界坐标。');
    }
    this.detailCenterWorldX = detailCenterWorldX;
    this.detailCenterWorldZ = detailCenterWorldZ;
    this.camera.camera.update(true);
  }

  /** 判断局部平面中的怪物保守圆是否落入相机世界视锥。 */
  public isCircleVisible(centerX: number, centerY: number, radius: number): boolean {
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    geometry.Sphere.set(
      this.sphere,
      centerX * scale,
      CULLING_CENTER_HEIGHT,
      -centerY * scale,
      radius * scale + CULLING_PADDING,
    );
    return geometry.intersect.sphereFrustum(
      this.sphere,
      this.camera.camera.frustum,
    ) !== 0;
  }

  /** 按玩家中心而不是相机偏移位置分档，避免跟随镜头导致近处怪物误降级。 */
  public resolveDetail(
    centerX: number,
    centerY: number,
    current: PlanarVisibilityDetail,
  ): PlanarVisibilityDetail {
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const deltaX = centerX * scale - this.detailCenterWorldX;
    const deltaZ = -centerY * scale - this.detailCenterWorldZ;
    const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
    if (current === PlanarVisibilityDetail.Full
      && distanceSquared <= FULL_DETAIL_LEAVE_DISTANCE_SQUARED) {
      return PlanarVisibilityDetail.Full;
    }
    if (current === PlanarVisibilityDetail.Minimal
      && distanceSquared > MINIMAL_DETAIL_LEAVE_DISTANCE_SQUARED) {
      return PlanarVisibilityDetail.Minimal;
    }
    if (distanceSquared <= FULL_DETAIL_ENTER_DISTANCE_SQUARED) {
      return PlanarVisibilityDetail.Full;
    }
    return distanceSquared > MINIMAL_DETAIL_ENTER_DISTANCE_SQUARED
      ? PlanarVisibilityDetail.Minimal
      : PlanarVisibilityDetail.Reduced;
  }
}
