import { Color, type Material } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../../core/rendering/standard-vertex-color-material-factory';

/** 管理战场程序化岩地独占的运行时材质。 */
export class BattlefieldMaterials {
  public readonly ground: Material;
  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    this.ground = StandardVertexColorMaterialFactory.create(surfaceMaterialTemplate, {
      name: 'BattlefieldGround',
      mainColor: new Color(255, 255, 255, 255),
      roughness: 0.93,
      metallic: 0,
      specularIntensity: 0.18,
      emissive: new Color(0, 0, 0, 255),
    });
  }

  /** 释放战场地面材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.ground.destroy();
    this.disposed = true;
  }
}
