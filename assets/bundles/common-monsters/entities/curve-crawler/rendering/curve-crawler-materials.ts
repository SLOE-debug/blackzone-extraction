import { Color, type Material } from 'cc';
import { UnlitMaterialFactory } from '../../../../../core/rendering/unlit-material-factory';

/** 管理 Curve Crawler 渲染层独占的材质生命周期。 */
export class CurveCrawlerMaterials {
  public readonly body: Material;
  public readonly eyes: Material;

  private disposed = false;

  constructor() {
    this.body = UnlitMaterialFactory.create(
      'CurveCrawlerBodyUnlit',
      new Color(4, 4, 5, 255),
    );
    this.eyes = UnlitMaterialFactory.create(
      'CurveCrawlerEyesUnlit',
      new Color(255, 28, 36, 255),
    );
  }

  /** 释放该怪物渲染器创建的全部材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.body.destroy();
    this.eyes.destroy();
    this.disposed = true;
  }
}
