import { Color, gfx, Material } from 'cc';

/** 创建透明 Unlit 材质所需的稳定参数。 */
export interface TransparentUnlitMaterialOptions {
  readonly name: string;
  readonly mainColor: Color;
  readonly useVertexColor: boolean;
}

/** 创建关闭深度写入、使用标准 Alpha 混合的透明材质。 */
export class TransparentUnlitMaterialFactory {
  /** 创建由调用方独占并负责销毁的透明材质。 */
  public static create(options: Readonly<TransparentUnlitMaterialOptions>): Material {
    const material = new Material();
    try {
      material.name = options.name;
      material.initialize({
        effectName: 'builtin-unlit',
        defines: {
          USE_TEXTURE: false,
          USE_VERTEX_COLOR: options.useVertexColor,
          USE_ALPHA_TEST: false,
        },
        states: {
          rasterizerState: {
            cullMode: gfx.CullMode.NONE,
          },
          depthStencilState: {
            depthTest: true,
            depthWrite: false,
          },
          blendState: {
            targets: [{
              blend: true,
              blendSrc: gfx.BlendFactor.SRC_ALPHA,
              blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
              blendSrcAlpha: gfx.BlendFactor.ONE,
              blendDstAlpha: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
            }],
          },
        },
      });
      material.setProperty('mainColor', options.mainColor);
      return material;
    } catch (error: unknown) {
      material.destroy();
      throw error;
    }
  }
}
