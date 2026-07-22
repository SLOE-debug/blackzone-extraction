import { Color, type Material } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../../../../core/rendering/standard-vertex-color-material-factory';

/** 管理 Curve Crawler 合并表面的统一材质生命周期。 */
export class CurveCrawlerMaterials {
  public readonly surface: Material;

  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    this.surface = StandardVertexColorMaterialFactory.create(surfaceMaterialTemplate, {
      name: 'CurveCrawlerSurfaceStandard',
      mainColor: new Color(255, 255, 255, 255),
      roughness: 0.76,
      metallic: 0,
      specularIntensity: 0.3,
      emissive: new Color(0, 0, 0, 255),
    });
  }

  /** 释放该怪物渲染器创建的全部材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.surface.destroy();
    this.disposed = true;
  }
}
