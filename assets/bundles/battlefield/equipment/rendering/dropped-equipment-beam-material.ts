import { Color, gfx, Material } from 'cc';

/** 创建关闭深度写入、使用加色混合的掉落装备毛笔形渐隐光管材质。 */
export function createDroppedEquipmentBeamMaterial(): Material {
  const material = new Material();
  try {
    material.name = 'DroppedEquipmentBeamMaterial';
    material.initialize({
      effectName: 'builtin-unlit',
      defines: {
        USE_TEXTURE: false,
        USE_VERTEX_COLOR: true,
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
            blendDst: gfx.BlendFactor.ONE,
            blendSrcAlpha: gfx.BlendFactor.ONE,
            blendDstAlpha: gfx.BlendFactor.ONE,
          }],
        },
      },
    });
    material.setProperty('mainColor', new Color(255, 255, 255, 255));
    return material;
  } catch (error: unknown) {
    material.destroy();
    throw error;
  }
}
