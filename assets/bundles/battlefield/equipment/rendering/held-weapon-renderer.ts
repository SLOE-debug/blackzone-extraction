import { type Material, Node } from 'cc';
import { EquipmentId } from '../../../../core/equipment/equipment';
import { StaticSurfaceMesh } from '../../../../core/rendering/static-surface-mesh';
import {
  getHeldWeaponProfile,
  type HeldWeaponProfile,
} from '../model/held-weapon-profile';
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
  private readonly profile: Readonly<HeldWeaponProfile>;
  private disposed = false;

  constructor(
    parent: Node,
    equipmentId: EquipmentId,
    material: Material,
  ) {
    this.profile = getHeldWeaponProfile(equipmentId);
    const root = new Node('HeldWeapon');
    parent.addChild(root);
    root.setScale(
      this.profile.heldScale,
      this.profile.heldScale,
      this.profile.heldScale,
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
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);
    const profile = this.profile;
    this.root.setPosition(
      x + rightX * profile.originRightOffset + forwardX * profile.originForwardOffset,
      y + profile.originHeightOffset,
      z + rightZ * profile.originRightOffset + forwardZ * profile.originForwardOffset,
    );
    this.root.setRotationFromEuler(
      profile.rotationXDegrees,
      heading * DEGREES_PER_RADIAN + profile.rotationYDegrees,
      profile.rotationZDegrees,
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
