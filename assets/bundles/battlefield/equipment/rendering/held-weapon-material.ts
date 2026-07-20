import { Color, type Material } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../../../core/rendering/standard-vertex-color-material-factory';

/** 创建玩家手持装备独占的受光金属材质。 */
export function createHeldWeaponMaterial(template: Material): Material {
  return StandardVertexColorMaterialFactory.create(template, {
    name: 'HeldWeaponSurfaceMaterial',
    mainColor: new Color(255, 255, 255, 255),
    roughness: 0.4,
    metallic: 0.62,
    specularIntensity: 0.76,
    emissive: new Color(5, 2, 9, 255),
  });
}
