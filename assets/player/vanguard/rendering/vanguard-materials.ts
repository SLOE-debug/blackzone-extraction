import { Color, type Material } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../../core/rendering/standard-vertex-color-material-factory';

/** 管理主角哑光皮肤衣物与金属长剑的独占运行时材质。 */
export class VanguardMaterials {
  public readonly matte: Material;
  public readonly metal: Material;
  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    const matte = StandardVertexColorMaterialFactory.create(surfaceMaterialTemplate, {
      name: 'VanguardMatte',
      mainColor: new Color(255, 255, 255, 255),
      roughness: 0.8,
      metallic: 0,
      specularIntensity: 0.28,
      emissive: new Color(0, 0, 0, 255),
    });
    let metal: Material | null = null;
    try {
      metal = StandardVertexColorMaterialFactory.create(surfaceMaterialTemplate, {
        name: 'VanguardMetal',
        mainColor: new Color(255, 255, 255, 255),
        roughness: 0.34,
        metallic: 0.78,
        specularIntensity: 0.72,
        emissive: new Color(0, 0, 0, 255),
      });
      this.matte = matte;
      this.metal = metal;
    } catch (error: unknown) {
      metal?.destroy();
      matte.destroy();
      throw error;
    }
  }

  /** 释放主角渲染器创建的全部运行时材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.metal.destroy();
    this.matte.destroy();
    this.disposed = true;
  }
}
