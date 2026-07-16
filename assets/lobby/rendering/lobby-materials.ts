import { Color, Material } from 'cc';
import { UnlitMaterialFactory } from '../../core/rendering/unlit-material-factory';
import { LobbySurfaceMaterialFactory } from './lobby-surface-material-factory';

/** 管理大厅真实受光表面和灯具发光面的运行时材质。 */
export class LobbyMaterials {
  public readonly surface: Material;
  public readonly glow: Material;

  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    const createdMaterials: Material[] = [];
    try {
      const surface = LobbySurfaceMaterialFactory.create(surfaceMaterialTemplate);
      createdMaterials.push(surface);
      const glow = UnlitMaterialFactory.create('LobbyLampGlowVertexColor', {
        mainColor: new Color(255, 255, 255, 255),
        useVertexColor: true,
      });
      createdMaterials.push(glow);
      this.surface = surface;
      this.glow = glow;
    } catch (error: unknown) {
      for (let index = createdMaterials.length - 1; index >= 0; index--) {
        createdMaterials[index]?.destroy();
      }
      throw error;
    }
  }

  /** 释放大厅渲染器创建的全部材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.glow.destroy();
    this.surface.destroy();
    this.disposed = true;
  }
}
