import { type Material, Node, Quat, Vec3 } from 'cc';
import { WeaponAction } from '../../../../core/equipment/equipment';
import { StaticSurfaceMesh } from '../../../../core/rendering/static-surface-mesh';
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
  private readonly rigRotation = new Quat();
  private readonly profileRotation = new Quat();
  private readonly actionRotation = new Quat();
  private readonly composedRotation = new Quat();
  private readonly finalRotation = new Quat();
  private readonly profileOffset = new Vec3();
  private readonly worldOffset = new Vec3();
  private visualX = 0;
  private visualY = 0;
  private visualZ = 0;
  private poseInitialized = false;
  private disposed = false;

  constructor(parent: Node, equipmentId: WeaponEquipmentId, material: Material) {
    const prototype = getBattlefieldEquipmentPrototype(equipmentId);
    this.profile = prototype.held;
    this.profileOffset.set(
      this.profile.originRightOffset,
      this.profile.originHeightOffset,
      this.profile.originForwardOffset,
    );
    Quat.fromEuler(
      this.profileRotation,
      this.profile.rotationXDegrees,
      this.profile.rotationYDegrees,
      this.profile.rotationZDegrees,
    );
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

  /** 待机时保留轻微惯性拖曳，攻击时立即服从预制动作曲线。 */
  public setRigPose(
    deltaTime: number,
    action: WeaponAction,
    progress: number,
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
    this.rigRotation.set(rotationX, rotationY, rotationZ, rotationW);
    Vec3.transformQuat(this.worldOffset, this.profileOffset, this.rigRotation);
    const targetX = x + this.worldOffset.x;
    const targetY = y + this.worldOffset.y;
    const targetZ = z + this.worldOffset.z;
    if (!this.poseInitialized || action !== WeaponAction.Idle) {
      this.visualX = targetX;
      this.visualY = targetY;
      this.visualZ = targetZ;
      this.poseInitialized = true;
    } else {
      const follow = 1 - Math.exp(-Math.max(0, deltaTime) * 11);
      this.visualX += (targetX - this.visualX) * follow;
      this.visualY += (targetY - this.visualY) * follow;
      this.visualZ += (targetZ - this.visualZ) * follow;
    }
    this.root.setPosition(this.visualX, this.visualY, this.visualZ);
    writeActionRotation(this.actionRotation, action, progress);
    Quat.multiply(this.composedRotation, this.rigRotation, this.actionRotation);
    Quat.multiply(this.finalRotation, this.composedRotation, this.profileRotation);
    this.root.setRotation(this.finalRotation);
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

function writeActionRotation(result: Quat, action: WeaponAction, progress: number): void {
  const t = Math.max(0, Math.min(1, progress));
  let pitch = 0;
  let yaw = 0;
  let roll = 0;
  switch (action) {
    case WeaponAction.WindupLeft:
      yaw = -105 * smooth(t);
      roll = -24 * smooth(t);
      break;
    case WeaponAction.SwingLeft:
      yaw = -105 + 210 * smooth(t);
      roll = -24 + 38 * Math.sin(t * Math.PI);
      break;
    case WeaponAction.WindupRight:
      yaw = 105 * smooth(t);
      roll = 24 * smooth(t);
      break;
    case WeaponAction.SwingRight:
      yaw = 105 - 210 * smooth(t);
      roll = 24 - 38 * Math.sin(t * Math.PI);
      break;
    case WeaponAction.Uppercut:
      pitch = -145 * Math.sin(Math.min(1, t * 1.35) * Math.PI * 0.5);
      roll = 18 * Math.sin(t * Math.PI);
      break;
    case WeaponAction.Spin:
      yaw = t * 1080;
      roll = 58;
      break;
    case WeaponAction.Recover:
      yaw = 24 * (1 - smooth(t));
      break;
    case WeaponAction.Idle:
      break;
  }
  Quat.fromEuler(result, pitch, yaw, roll);
}

function smooth(value: number): number {
  return value * value * (3 - value * 2);
}
