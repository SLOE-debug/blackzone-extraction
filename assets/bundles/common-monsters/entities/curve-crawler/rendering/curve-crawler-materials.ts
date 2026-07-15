import { Color, type Material } from 'cc';
import { UnlitMaterialFactory } from '../../../../../core/rendering/unlit-material-factory';

/** 管理 Curve Crawler 合并表面的统一材质生命周期。 */
export class CurveCrawlerMaterials {
  public readonly surface: Material;

  private disposed = false;

  constructor() {
    this.surface = UnlitMaterialFactory.create('CurveCrawlerSurfaceUnlit3D', {
      mainColor: new Color(255, 255, 255, 255),
      useVertexColor: true,
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
