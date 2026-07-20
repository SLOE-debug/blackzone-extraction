import { Color, type Material } from 'cc';
import { UnlitMaterialFactory } from '../../../core/rendering/unlit-material-factory';

/** 管理战场程序化岩地独占的运行时材质。 */
export class BattlefieldMaterials {
  public readonly ground: Material;
  private disposed = false;

  constructor() {
    this.ground = UnlitMaterialFactory.create('BattlefieldGround', {
      mainColor: new Color(255, 255, 255, 255),
      useVertexColor: true,
    });
  }

  /** 释放战场地面材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.ground.destroy();
    this.disposed = true;
  }
}
