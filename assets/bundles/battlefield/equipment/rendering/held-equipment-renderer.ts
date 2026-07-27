import { type Material, Node, Quat } from 'cc';
import { StaticSurfaceMesh } from '../../../../core/rendering/static-surface-mesh';
import {
  BattlefieldHammerPoseSolver,
  type BattlefieldHammerGripPose,
  type MutableBattlefieldHammerWorldPose,
} from '../animation/battlefield-hammer-pose-solver';
import { getBattlefieldEquipmentPrototype } from '../catalog/battlefield-equipment-catalog';
import { type HeldEquipmentProfile } from '../catalog/battlefield-equipment-prototype';
import { type WeaponEquipmentId } from '../catalog/equipment-id';

const HELD_EQUIPMENT_SURFACE_OPTIONS = Object.freeze({
  castShadows: false,
  receiveShadows: false,
  uploadLightingAttributes: false,
});

/** 把程序化装备渲染到角色手部权威姿态，并叠加大锤动作曲线。 */
export class HeldEquipmentRenderer {
  private readonly root: Node;
  private readonly mesh = new StaticSurfaceMesh();
  private readonly profile: Readonly<HeldEquipmentProfile>;
  private readonly poseSolver = new BattlefieldHammerPoseSolver();
  private readonly finalRotation = new Quat();
  private readonly worldPose: MutableBattlefieldHammerWorldPose = {
    rootX: 0,
    rootY: 0,
    rootZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    rotationW: 1,
    headX: 0,
    headY: 0,
    headZ: 0,
  };
  private disposed = false;

  constructor(parent: Node, equipmentId: WeaponEquipmentId, material: Material) {
    const prototype = getBattlefieldEquipmentPrototype(equipmentId);
    this.profile = prototype.held;
    const root = new Node('HeldEquipment');
    parent.addChild(root);
    root.setScale(this.profile.heldScale, this.profile.heldScale, this.profile.heldScale);
    this.root = root;
    try {
      this.mesh.initialize(
        root,
        'HeldEquipmentSurface',
        prototype.geometry,
        material,
        HELD_EQUIPMENT_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  public get hammerHeadRadius(): number {
    return this.profile.hammerHeadRadius * this.profile.heldScale;
  }

  /** 用主握点与锤头轨迹反解模型变换，并返回同源锤头权威位置。 */
  public setRigPose(
    grip: Readonly<BattlefieldHammerGripPose>,
  ): Readonly<MutableBattlefieldHammerWorldPose> {
    if (this.disposed) {
      throw new Error('手持装备渲染器已经释放。');
    }
    this.poseSolver.solve(this.profile, grip, this.worldPose);
    this.root.setPosition(this.worldPose.rootX, this.worldPose.rootY, this.worldPose.rootZ);
    this.finalRotation.set(
      this.worldPose.rotationX,
      this.worldPose.rotationY,
      this.worldPose.rotationZ,
      this.worldPose.rotationW,
    );
    this.root.setRotation(this.finalRotation);
    return this.worldPose;
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
