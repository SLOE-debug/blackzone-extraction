import { Color, type Material } from 'cc';
import { TransparentUnlitMaterialFactory } from '../../core/rendering/transparent-unlit-material-factory';
import { LobbySurfaceMaterialFactory } from './lobby-surface-material-factory';

/** 管理大厅受光表面和统一透明效果批次的运行时材质。 */
export class LobbyMaterials {
  public readonly surface: Material;
  public readonly effects: Material;

  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    const surface = LobbySurfaceMaterialFactory.create(surfaceMaterialTemplate);
    let effects: Material | null = null;
    try {
      effects = TransparentUnlitMaterialFactory.create({
        name: 'LobbyEffectsVertexColor',
        mainColor: new Color(255, 255, 255, 255),
        useVertexColor: true,
      });
      this.surface = surface;
      this.effects = effects;
    } catch (error: unknown) {
      effects?.destroy();
      surface.destroy();
      throw error;
    }
  }

  /** 释放大厅渲染器创建的全部运行时材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.effects.destroy();
    this.surface.destroy();
    this.disposed = true;
  }
}
