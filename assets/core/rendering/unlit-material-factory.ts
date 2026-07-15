import { Color, Material } from 'cc';

/** 内置 Unlit 材质所需的纯色表面参数。 */
export interface UnlitMaterialOptions {
  readonly mainColor: Readonly<Color>;
  readonly useVertexColor: boolean;
}

/** 创建供纯色动态几何使用的内置 Unlit 材质。 */
export class UnlitMaterialFactory {
  /**
   * 创建关闭纹理和透明测试、可选动态顶点色的纯色材质。
   */
  public static create(name: string, options: Readonly<UnlitMaterialOptions>): Material {
    const material = new Material();
    material.name = name;
    material.initialize({
      effectName: 'builtin-unlit',
      defines: {
        USE_TEXTURE: false,
        USE_VERTEX_COLOR: options.useVertexColor,
        USE_ALPHA_TEST: false,
      },
    });
    material.setProperty('mainColor', options.mainColor);
    return material;
  }
}
