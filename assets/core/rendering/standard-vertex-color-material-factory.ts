import { Color, Material } from 'cc';

const BUILTIN_STANDARD_EFFECT_NAME = 'builtin-standard';

/** 创建 Standard 顶点色材质所需的稳定表面参数。 */
export interface StandardVertexColorMaterialOptions {
  readonly name: string;
  readonly mainColor: Color;
  readonly roughness: number;
  readonly metallic: number;
  readonly specularIntensity: number;
  readonly emissive: Color;
}

/** 从编辑器提供的 Standard 模板创建独占运行时材质。 */
export class StandardVertexColorMaterialFactory {
  /** 校验 Effect 后复制模板，并关闭当前程序化网格不使用的纹理分支。 */
  public static create(
    template: Material,
    options: Readonly<StandardVertexColorMaterialOptions>,
  ): Material {
    validateOptions(options);
    const material = new Material();
    try {
      const effectAsset = template.effectAsset;
      if (effectAsset === null) {
        throw new Error('Standard 材质模板没有有效 EffectAsset。');
      }
      if (effectAsset.name !== BUILTIN_STANDARD_EFFECT_NAME) {
        throw new Error(
          `程序化受光表面必须使用 ${BUILTIN_STANDARD_EFFECT_NAME}，当前为 ${effectAsset.name}。`,
        );
      }
      material.name = options.name;
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
      material.setProperty('mainColor', options.mainColor);
      material.setProperty('roughness', options.roughness);
      material.setProperty('metallic', options.metallic);
      material.setProperty('specularIntensity', options.specularIntensity);
      material.setProperty('emissive', options.emissive);
      return material;
    } catch (error: unknown) {
      material.destroy();
      throw error;
    }
  }
}

/** 校验 PBR 标量，避免把非法参数交给运行时 Effect。 */
function validateOptions(options: Readonly<StandardVertexColorMaterialOptions>): void {
  if (options.name.length === 0) {
    throw new Error('Standard 顶点色材质名称不能为空。');
  }
  if (![options.roughness, options.metallic, options.specularIntensity].every(Number.isFinite)) {
    throw new Error('Standard 顶点色材质参数必须是有限数值。');
  }
}
