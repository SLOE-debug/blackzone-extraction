import { type EffectAsset, Material, type Texture2D, Vec4 } from 'cc';
import { CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT } from './curve-crawler-gpu-pose-layout';

const LIGHT_X = 0.36;
const LIGHT_Y = -0.42;
const LIGHT_Z = 0.832826;

/** 管理 GPU 形变与分档光照 Effect 的材质参数。 */
export class CurveCrawlerGpuMaterial {
  public readonly surface: Material;
  private readonly poseTextureSize = new Vec4();
  private disposed = false;

  constructor(effect: EffectAsset, poseTexture: Texture2D, entityCapacity: number) {
    const material = new Material('CurveCrawlerGpuSurfaceMaterial');
    material.initialize({ effectAsset: effect });
    material.setProperty('lightDirection', new Vec4(LIGHT_X, LIGHT_Y, LIGHT_Z, 0));
    material.setProperty('shadeBands', new Vec4(0.58, 0.7, 0.82, 0.94));
    this.surface = material;
    this.setPoseTexture(poseTexture, entityCapacity);
  }

  /** 在姿态纹理容量变化后重新绑定资源与精确 Texel 尺寸。 */
  public setPoseTexture(texture: Texture2D, entityCapacity: number): void {
    if (this.disposed
      || !Number.isInteger(entityCapacity)
      || entityCapacity <= 0) {
      throw new Error('Curve Crawler GPU 材质姿态纹理参数无效。');
    }
    this.poseTextureSize.set(
      CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT,
      entityCapacity,
      1 / CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT,
      1 / entityCapacity,
    );
    this.surface.setProperty('poseTexture', texture);
    this.surface.setProperty('poseTextureSize', this.poseTextureSize);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.surface.destroy();
  }
}
