import { type Material, Node } from 'cc';
import { EquipmentId } from '../../../../core/equipment/equipment';
import { StaticSurfaceMesh } from '../../../../core/rendering/static-surface-mesh';
import { HELD_WEAPON_LAYOUT } from '../model/held-weapon-layout';
import { getBattlefieldEquipmentGeometry } from './battlefield-equipment-geometry';

const DEGREES_PER_RADIAN = 180 / Math.PI;
const HELD_WEAPON_SURFACE_OPTIONS = Object.freeze({
  castShadows: true,
  receiveShadows: true,
  uploadLightingAttributes: true,
});

/** 把一件程序化武器固定到玩家右手掌心，并始终与玩家朝向一致。 */
export class HeldWeaponRenderer {
  private readonly root: Node;
  private readonly mesh = new StaticSurfaceMesh();
  private disposed = false;

  constructor(
    parent: Node,
    equipmentId: EquipmentId,
    material: Material,
  ) {
    const root = new Node('HeldWeapon');
    parent.addChild(root);
    root.setScale(
      HELD_WEAPON_LAYOUT.modelScale,
      HELD_WEAPON_LAYOUT.modelScale,
      HELD_WEAPON_LAYOUT.modelScale,
    );
    this.root = root;
    try {
      this.mesh.initialize(
        root,
        'HeldWeaponSurface',
        getBattlefieldEquipmentGeometry(equipmentId),
        material,
        HELD_WEAPON_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** 根据右手掌心挂点与世界 Y 轴朝向同步武器姿态。 */
  public setSocketPose(x: number, y: number, z: number, heading: number): void {
    if (this.disposed) {
      return;
    }
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);
    this.root.setPosition(
      x + forwardX * HELD_WEAPON_LAYOUT.modelOriginForwardOffset,
      y + HELD_WEAPON_LAYOUT.modelOriginHeightOffset,
      z + forwardZ * HELD_WEAPON_LAYOUT.modelOriginForwardOffset,
    );
    // 沙漠之鹰枪管沿局部 +X，减去九十度后与角色局部 +Z 前向重合。
    this.root.setRotationFromEuler(
      0,
      (heading - Math.PI * 0.5) * DEGREES_PER_RADIAN,
      0,
    );
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.mesh.dispose();
    if (this.root.isValid) {
      this.root.destroy();
    }
  }
}
