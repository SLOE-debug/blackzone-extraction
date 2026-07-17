import { Color, type Material } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../../core/rendering/standard-vertex-color-material-factory';

/** 管理主角皮肤、衣物与围巾共用的独占运行时材质。 */
export class VanguardMaterials {
  public readonly character: Material;
  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    this.character = StandardVertexColorMaterialFactory.create(surfaceMaterialTemplate, {
      name: 'VanguardCharacter',
      mainColor: new Color(255, 255, 255, 255),
      roughness: 0.8,
      metallic: 0,
      specularIntensity: 0.28,
      emissive: new Color(0, 0, 0, 255),
    });
  }

  /** 释放主角渲染器创建的运行时材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.character.destroy();
    this.disposed = true;
  }
}
