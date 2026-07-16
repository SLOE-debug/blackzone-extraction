import { Color, type Material } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../../core/rendering/standard-vertex-color-material-factory';
import { UnlitMaterialFactory } from '../../../core/rendering/unlit-material-factory';

/** 管理主角金属装甲与发光传感器的独占运行时材质。 */
export class VanguardMaterials {
  public readonly armor: Material;
  public readonly sensor: Material;
  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    const armor = StandardVertexColorMaterialFactory.create(surfaceMaterialTemplate, {
      name: 'VanguardArmor',
      mainColor: new Color(255, 255, 255, 255),
      roughness: 0.51,
      metallic: 0.46,
      specularIntensity: 0.62,
      emissive: new Color(0, 0, 0, 255),
    });
    let sensor: Material | null = null;
    try {
      sensor = UnlitMaterialFactory.create('VanguardSensor', {
        mainColor: new Color(255, 255, 255, 255),
        useVertexColor: true,
      });
      this.armor = armor;
      this.sensor = sensor;
    } catch (error: unknown) {
      sensor?.destroy();
      armor.destroy();
      throw error;
    }
  }

  /** 释放主角渲染器创建的全部运行时材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.sensor.destroy();
    this.armor.destroy();
    this.disposed = true;
  }
}
