import { WeaponGrip } from '../../../../core/equipment/equipment';
import { type HeldEquipmentProfile } from '../catalog/battlefield-equipment-prototype';

const SUPPORT_GRIP_TOLERANCE = 0.025;

/** 角色双臂 IK 与 WeaponRoot 输出的大锤双握点世界姿态。 */
export interface BattlefieldHammerGripPose {
  readonly rootX: number;
  readonly rootY: number;
  readonly rootZ: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly rotationW: number;
  readonly mainGripX: number;
  readonly mainGripY: number;
  readonly mainGripZ: number;
  readonly supportGripX: number;
  readonly supportGripY: number;
  readonly supportGripZ: number;
}

/** 求解器写出的模型根变换与真实锤头世界位置。 */
export interface MutableBattlefieldHammerWorldPose {
  rootX: number;
  rootY: number;
  rootZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rotationW: number;
  headX: number;
  headY: number;
  headZ: number;
}

/**
 * 用角色权威 WeaponRoot 放置模型，并校验模型主、副握点同时贴合双手。
 *
 * 动作轨迹只在角色动画层求解一次；本层不再叠加 actionYaw 或第二套锤头曲线。
 */
export class BattlefieldHammerPoseSolver {
  private readonly rotated = new Float64Array(3);

  public solve(
    profile: Readonly<HeldEquipmentProfile>,
    grip: Readonly<BattlefieldHammerGripPose>,
    result: MutableBattlefieldHammerWorldPose,
  ): void {
    if (profile.grip !== WeaponGrip.TwoHandHeavy) {
      throw new Error('大锤姿态求解器只接受双手重武器握持。');
    }
    result.rotationX = grip.rotationX;
    result.rotationY = grip.rotationY;
    result.rotationZ = grip.rotationZ;
    result.rotationW = grip.rotationW;
    this.rotateProfilePoint(profile.attachmentPoints.mainGrip, profile, grip);
    result.rootX = grip.mainGripX - (this.rotated[0] ?? 0);
    result.rootY = grip.mainGripY - (this.rotated[1] ?? 0);
    result.rootZ = grip.mainGripZ - (this.rotated[2] ?? 0);

    this.rotateProfilePoint(profile.attachmentPoints.supportGrip, profile, grip);
    const supportError = Math.hypot(
      result.rootX + (this.rotated[0] ?? 0) - grip.supportGripX,
      result.rootY + (this.rotated[1] ?? 0) - grip.supportGripY,
      result.rootZ + (this.rotated[2] ?? 0) - grip.supportGripZ,
    );
    if (supportError > SUPPORT_GRIP_TOLERANCE) {
      throw new Error(`大锤副握点未贴合左手，误差：${supportError.toFixed(4)}`);
    }

    const impactHead = profile.attachmentPoints.impactHead;
    if (impactHead === undefined) {
      throw new Error('大锤姿态求解器要求 impactHead 语义挂点。');
    }
    this.rotateProfilePoint(impactHead, profile, grip);
    result.headX = result.rootX + (this.rotated[0] ?? 0);
    result.headY = result.rootY + (this.rotated[1] ?? 0);
    result.headZ = result.rootZ + (this.rotated[2] ?? 0);
  }

  private rotateProfilePoint(
    point: Readonly<{ x: number; y: number; z: number }>,
    profile: Readonly<HeldEquipmentProfile>,
    rotation: Readonly<BattlefieldHammerGripPose>,
  ): void {
    const x = point.x * profile.heldScale;
    const y = point.y * profile.heldScale;
    const z = point.z * profile.heldScale;
    const doubledX = 2 * (rotation.rotationY * z - rotation.rotationZ * y);
    const doubledY = 2 * (rotation.rotationZ * x - rotation.rotationX * z);
    const doubledZ = 2 * (rotation.rotationX * y - rotation.rotationY * x);
    this.rotated[0] = x + rotation.rotationW * doubledX
      + rotation.rotationY * doubledZ - rotation.rotationZ * doubledY;
    this.rotated[1] = y + rotation.rotationW * doubledY
      + rotation.rotationZ * doubledX - rotation.rotationX * doubledZ;
    this.rotated[2] = z + rotation.rotationW * doubledZ
      + rotation.rotationX * doubledY - rotation.rotationY * doubledX;
  }
}
