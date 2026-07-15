import { Color, Material } from 'cc';

/** 创建供纯色动态几何使用的内置 Unlit 材质。 */
export class UnlitMaterialFactory {
  /**
   * 创建关闭纹理、顶点色和透明测试的纯色材质。
   */
  public static create(name: string, color: Readonly<Color>): Material {
    const material = new Material();
    material.name = name;
    material.initialize({
      effectName: 'builtin-unlit',
      defines: {
        USE_TEXTURE: false,
        USE_VERTEX_COLOR: false,
        USE_ALPHA_TEST: false,
      },
    });
    material.setProperty('mainColor', color);
    return material;
  }
}
