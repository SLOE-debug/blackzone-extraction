import { Color, type Material } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../../../core/rendering/standard-vertex-color-material-factory';

/** 创建全部战场掉落装备共享的受光顶点色材质。 */
export function createDroppedEquipmentMaterial(template: Material): Material {
  return StandardVertexColorMaterialFactory.create(template, {
    name: 'DroppedEquipmentSurfaceMaterial',
    mainColor: new Color(255, 255, 255, 255),
    roughness: 0.43,
    metallic: 0.58,
    specularIntensity: 0.72,
    emissive: new Color(6, 2, 10, 255),
  });
}
