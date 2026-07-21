import { type Material, Node, Quat } from 'cc';
import { type WeaponEquipmentId } from '../../../../core/equipment/equipment';
import { StaticSurfaceMesh } from '../../../../core/rendering/static-surface-mesh';
import {
  getHeldWeaponProfile,
  type HeldWeaponProfile,
} from '../model/held-weapon-profile';
import { getBattlefieldEquipmentGeometry } from './battlefield-equipment-geometry';

const HELD_WEAPON_SURFACE_OPTIONS = Object.freeze({
  castShadows: false,
  receiveShadows: false,
  uploadLightingAttributes: false,
});

/** 把一件程序化武器渲染到玩家 WeaponAimRoot 提供的权威姿态。 */
export class HeldWeaponRenderer {
  private readonly root: Node;
  private readonly mesh = new StaticSurfaceMesh();
  private readonly profile: Readonly<HeldWeaponProfile>;
  private readonly rigRotation = new Quat();
  private readonly profileRotation = new Quat();
  private readonly composedRotation = new Quat();
  private disposed = false;

  constructor(
    parent: Node,
    equipmentId: WeaponEquipmentId,
    material: Material,
  ) {
    this.profile = getHeldWeaponProfile(equipmentId);
    Quat.fromEuler(
      this.profileRotation,
      this.profile.rotationXDegrees,
      this.profile.rotationYDegrees,
      this.profile.rotationZDegrees,
    );
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

  /** 根据 WeaponAimRoot 世界四元数同步武器，不再从任一只手反推枪身。 */
  public setRigPose(
    x: number,
    y: number,
    z: number,
    rotationX: number,
    rotationY: number,
    rotationZ: number,
    rotationW: number,
  ): void {
    if (this.disposed) {
      return;
    }
    const profile = this.profile;
    const rightOffset = profile.originRightOffset;
    const heightOffset = profile.originHeightOffset;
    const forwardOffset = profile.originForwardOffset;
    const twiceCrossX = 2 * (rotationY * forwardOffset - rotationZ * heightOffset);
    const twiceCrossY = 2 * (rotationZ * rightOffset - rotationX * forwardOffset);
    const twiceCrossZ = 2 * (rotationX * heightOffset - rotationY * rightOffset);
    this.root.setPosition(
      x + rightOffset
        + rotationW * twiceCrossX
        + rotationY * twiceCrossZ
        - rotationZ * twiceCrossY,
      y + heightOffset
        + rotationW * twiceCrossY
        + rotationZ * twiceCrossX
        - rotationX * twiceCrossZ,
      z + forwardOffset
        + rotationW * twiceCrossZ
        + rotationX * twiceCrossY
        - rotationY * twiceCrossX,
    );
    this.rigRotation.set(rotationX, rotationY, rotationZ, rotationW);
    Quat.multiply(
      this.composedRotation,
      this.rigRotation,
      this.profileRotation,
    );
    this.root.setRotation(this.composedRotation);
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
