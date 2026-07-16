import { Color, type Material } from 'cc';
import { UnlitMaterialFactory } from '../../core/rendering/unlit-material-factory';
import { LobbySurfaceMaterialFactory } from './lobby-surface-material-factory';

/** 管理大厅真实受光表面和合批发光面的运行时材质。 */
export class LobbyMaterials {
  public readonly surface: Material;
  public readonly emissive: Material;

  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    const surface = LobbySurfaceMaterialFactory.create(surfaceMaterialTemplate);
    try {
      this.emissive = UnlitMaterialFactory.create('LobbyEmissiveVertexColor', {
        mainColor: new Color(255, 255, 255, 255),
        useVertexColor: true,
      });
      this.surface = surface;
    } catch (error: unknown) {
      surface.destroy();
      throw error;
    }
  }

  /** 释放大厅渲染器创建的全部运行时材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.emissive.destroy();
    this.surface.destroy();
    this.disposed = true;
  }
}
