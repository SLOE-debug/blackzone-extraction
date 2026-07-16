import { Color, Material } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../core/rendering/standard-vertex-color-material-factory';

/** 大厅内置 Standard 材质的稳定运行时参数。 */
const LOBBY_SURFACE_MATERIAL = Object.freeze({
  mainColor: new Color(255, 255, 255, 255),
  roughness: 0.62,
  metallic: 0,
  specularIntensity: 0.46,
  emissive: new Color(0, 0, 0, 255),
});

/** 根据编辑器引用的内置 Standard 模板创建大厅受光材质。 */
export class LobbySurfaceMaterialFactory {
  /** 创建由调用方独占并负责销毁的 Standard 材质副本。 */
  public static create(template: Material): Material {
    return StandardVertexColorMaterialFactory.create(template, {
      name: 'LobbySurface',
      ...LOBBY_SURFACE_MATERIAL,
    });
  }
}
