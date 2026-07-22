import { type HeldWeaponProfile } from '../catalog/battlefield-equipment-prototype';

/** 射击求解只需要的枪口世界坐标。 */
export interface BattlefieldWeaponMuzzlePose {
  readonly muzzleX: number;
  readonly muzzleY: number;
  readonly muzzleZ: number;
}

/** 枪口求解读取的 WeaponAimRoot 世界姿态。 */
export interface BattlefieldWeaponRootPose {
  readonly rootX: number;
  readonly rootY: number;
  readonly rootZ: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly rotationW: number;
}

/** 调用方原地复用的枪口世界坐标。 */
export interface MutableBattlefieldWeaponMuzzlePose extends BattlefieldWeaponMuzzlePose {
  muzzleX: number;
  muzzleY: number;
  muzzleZ: number;
}

/** 把当前枪型的真实局部枪口偏移旋转到 WeaponAimRoot 世界姿态。 */
export function writeBattlefieldWeaponMuzzlePose(
  root: Readonly<BattlefieldWeaponRootPose>,
  profile: Readonly<HeldWeaponProfile>,
  result: MutableBattlefieldWeaponMuzzlePose,
): void {
  const right = profile.muzzleRightOffset;
  const height = profile.muzzleHeightOffset;
  const forward = profile.muzzleForwardOffset;
  const rotationX = root.rotationX;
  const rotationY = root.rotationY;
  const rotationZ = root.rotationZ;
  const rotationW = root.rotationW;
  const twiceCrossX = 2 * (rotationY * forward - rotationZ * height);
  const twiceCrossY = 2 * (rotationZ * right - rotationX * forward);
  const twiceCrossZ = 2 * (rotationX * height - rotationY * right);
  result.muzzleX = root.rootX + right
    + rotationW * twiceCrossX
    + rotationY * twiceCrossZ
    - rotationZ * twiceCrossY;
  result.muzzleY = root.rootY + height
    + rotationW * twiceCrossY
    + rotationZ * twiceCrossX
    - rotationX * twiceCrossZ;
  result.muzzleZ = root.rootZ + forward
    + rotationW * twiceCrossZ
    + rotationX * twiceCrossY
    - rotationY * twiceCrossX;
}
