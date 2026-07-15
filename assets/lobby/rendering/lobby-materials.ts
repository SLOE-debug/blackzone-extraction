import { Color, Material } from 'cc';
import { UnlitMaterialFactory } from '../../core/rendering/unlit-material-factory';

/** 管理大厅实时受光表面和灯具发光面的无贴图材质。 */
export class LobbyMaterials {
  public readonly surface: Material;
  public readonly glow: Material;

  private disposed = false;

  constructor(surfaceMaterial: Material) {
    this.surface = surfaceMaterial;
    this.glow = UnlitMaterialFactory.create('LobbyLampGlowVertexColor', {
      mainColor: new Color(255, 255, 255, 255),
      useVertexColor: true,
    });
  }

  /** 释放大厅渲染器创建的全部材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.glow.destroy();
    this.disposed = true;
  }
}
