import { Color, type Material } from 'cc';
import { UnlitMaterialFactory } from '../../../../core/rendering/unlit-material-factory';

/** 管理全部可裁剪 Chunk 批次共享的一份 Unlit 顶点色材质。 */
export class BattlefieldEnvironmentMaterials {
  public readonly unified: Material;
  private disposed = false;

  constructor() {
    this.unified = UnlitMaterialFactory.create('BattlefieldEnvironmentChunks', {
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
