/** 接收 WeaponAimRoot 世界位置与旋转的可写结构。 */
export interface MutableVanguardWeaponRigPose {
  rootX: number;
  rootY: number;
  rootZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rotationW: number;
  muzzleX: number;
  muzzleY: number;
  muzzleZ: number;
  forwardX: number;
  forwardY: number;
  forwardZ: number;
}
