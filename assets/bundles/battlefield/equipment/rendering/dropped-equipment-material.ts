import { Color, type Material } from 'cc';
import { UnlitMaterialFactory } from '../../../../core/rendering/unlit-material-factory';

/** 创建全部战场掉落装备共享的 Unlit 顶点色材质。 */
export function createDroppedEquipmentMaterial(): Material {
  return UnlitMaterialFactory.create('DroppedEquipmentSurfaceMaterial', {
    mainColor: new Color(255, 255, 255, 255),
    useVertexColor: true,
  });
}
