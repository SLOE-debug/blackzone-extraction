import { Color, Material } from 'cc';

const BUILTIN_STANDARD_EFFECT_NAME = 'builtin-standard';

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
    const material = new Material();
    try {
      const effectAsset = template.effectAsset;
      if (effectAsset === null) {
        throw new Error('大厅表面材质没有有效 EffectAsset。');
      }
      if (effectAsset.name !== BUILTIN_STANDARD_EFFECT_NAME) {
        throw new Error(
          `大厅表面材质必须使用 ${BUILTIN_STANDARD_EFFECT_NAME}，当前为 ${effectAsset.name}。`,
        );
      }
      material.name = 'LobbySurface';
      material.copy(template, {
        defines: {
          USE_VERTEX_COLOR: true,
          USE_ALBEDO_MAP: false,
          USE_NORMAL_MAP: false,
          USE_PBR_MAP: false,
          USE_OCCLUSION_MAP: false,
          USE_EMISSIVE_MAP: false,
          USE_ALPHA_TEST: false,
        },
      });
      material.setProperty('mainColor', LOBBY_SURFACE_MATERIAL.mainColor);
      material.setProperty('roughness', LOBBY_SURFACE_MATERIAL.roughness);
      material.setProperty('metallic', LOBBY_SURFACE_MATERIAL.metallic);
      material.setProperty('specularIntensity', LOBBY_SURFACE_MATERIAL.specularIntensity);
      material.setProperty('emissive', LOBBY_SURFACE_MATERIAL.emissive);
      return material;
    } catch (error: unknown) {
      material.destroy();
      throw error;
    }
  }
}
