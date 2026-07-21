import { Camera, geometry } from 'cc';
import { type PlanarCircleVisibility } from '../../../core/contracts/planar-circle-visibility';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';

const CULLING_CENTER_HEIGHT = 1.1;
const CULLING_PADDING = 2.4;

/**
 * 把 Curve Crawler 局部 XY 平面圆转换为战场世界球，并与当前相机视锥相交测试。
 *
 * 单个可复用 Sphere 服务全部怪物，不在逐实体路径创建 Cocos 数学对象。
 */
export class BattlefieldMonsterFrustumVisibility implements PlanarCircleVisibility {
  private readonly sphere = geometry.Sphere.create(0, 0, 0, 1);

  constructor(private readonly camera: Camera) {}

  /** 相机节点移动后显式刷新底层渲染相机矩阵与 Frustum。 */
  public synchronize(): void {
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
}
