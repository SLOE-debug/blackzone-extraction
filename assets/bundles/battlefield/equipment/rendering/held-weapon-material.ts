import { Color, type Material } from 'cc';
import { UnlitMaterialFactory } from '../../../../core/rendering/unlit-material-factory';

/** 创建玩家手持装备独占的 Unlit 顶点色材质。 */
export function createHeldWeaponMaterial(): Material {
  return UnlitMaterialFactory.create('HeldWeaponSurfaceMaterial', {
    mainColor: new Color(255, 255, 255, 255),
    useVertexColor: true,
  });
}
