import { Color, type Material } from 'cc';
import { UnlitMaterialFactory } from '../../core/rendering/unlit-material-factory';
import { TransparentUnlitMaterialFactory } from '../../core/rendering/transparent-unlit-material-factory';
import { LobbySurfaceMaterialFactory } from './lobby-surface-material-factory';

/** 管理大厅受光表面、合批发光面和透明观察面的运行时材质。 */
export class LobbyMaterials {
  public readonly surface: Material;
  public readonly emissive: Material;
  public readonly glass: Material;

  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    const surface = LobbySurfaceMaterialFactory.create(surfaceMaterialTemplate);
    let emissive: Material | null = null;
    let glass: Material | null = null;
    try {
      emissive = UnlitMaterialFactory.create('LobbyEmissiveVertexColor', {
        mainColor: new Color(255, 255, 255, 255),
        useVertexColor: true,
      });
      glass = TransparentUnlitMaterialFactory.create({
        name: 'LobbyObservationGlass',
        mainColor: new Color(78, 116, 126, 54),
        useVertexColor: false,
      });
      this.surface = surface;
      this.emissive = emissive;
      this.glass = glass;
    } catch (error: unknown) {
      glass?.destroy();
      emissive?.destroy();
      surface.destroy();
      throw error;
    }
  }

  /** 释放大厅渲染器创建的全部运行时材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.glass.destroy();
    this.emissive.destroy();
    this.surface.destroy();
    this.disposed = true;
  }
}
