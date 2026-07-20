import { Color, type Material } from 'cc';
import { UnlitMaterialFactory } from '../../../../core/rendering/unlit-material-factory';

/** 管理整个环境大网格独占的一份 Unlit 顶点色材质。 */
export class BattlefieldEnvironmentMaterials {
  public readonly unified: Material;
  private disposed = false;

  constructor() {
    this.unified = UnlitMaterialFactory.create('BattlefieldEnvironmentMegaBatch', {
      mainColor: new Color(255, 255, 255, 255),
      useVertexColor: true,
    });
  }

  /** 释放统一环境材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.unified.destroy();
    this.disposed = true;
  }
}
