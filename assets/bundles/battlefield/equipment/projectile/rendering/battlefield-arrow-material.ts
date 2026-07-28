import { Color, gfx, Material } from 'cc';

/** 创建双面箭体与弦网共享的顶点色材质，避免回程反向后被背面裁剪。 */
export function createBattlefieldArrowMaterial(): Material {
  const material = new Material();
  try {
    material.name = 'BattlefieldArrowMaterial';
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
      },
    });
    material.setProperty('mainColor', new Color(255, 255, 255, 255));
    return material;
  } catch (error: unknown) {
    material.destroy();
    throw error;
  }
}
