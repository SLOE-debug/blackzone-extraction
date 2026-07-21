/** 接收 WeaponAimRoot 世界位置、旋转与前向轴的可写结构。 */
export interface MutableVanguardWeaponRigPose {
  rootX: number;
  rootY: number;
  rootZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rotationW: number;
  forwardX: number;
  forwardY: number;
  forwardZ: number;
}
