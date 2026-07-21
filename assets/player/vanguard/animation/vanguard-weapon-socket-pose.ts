import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../model/vanguard-bone';
import { type VanguardState } from '../model/vanguard-state';
import { type MutableVanguardWeaponSocketPose } from '../model/vanguard-weapon-socket';

// 从手部骨骼起点沿掌骨方向推进，避免武器停在手腕关节上。
export const VANGUARD_WEAPON_SOCKET_DISTANCE = 0.17;

/** 从左右手骨骼矩阵一次写出两个掌心武器挂点。 */
export function writeVanguardWeaponSockets(
  state: VanguardState,
  entityIndex: number,
  result: MutableVanguardWeaponSocketPose,
): void {
  const matrices = state.data.pose.boneMatrices;
  const entityOffset = entityIndex
    * VanguardBone.Count
    * VANGUARD_BONE_MATRIX_COMPONENTS;
  const leftOffset = entityOffset
    + VanguardBone.LeftHand * VANGUARD_BONE_MATRIX_COMPONENTS;
  const rightOffset = entityOffset
    + VanguardBone.RightHand * VANGUARD_BONE_MATRIX_COMPONENTS;
  result.leftX = readSocketAxis(matrices, leftOffset, 9, 3);
  result.leftY = readSocketAxis(matrices, leftOffset, 10, 4);
  result.leftZ = readSocketAxis(matrices, leftOffset, 11, 5);
  result.rightX = readSocketAxis(matrices, rightOffset, 9, 3);
  result.rightY = readSocketAxis(matrices, rightOffset, 10, 4);
  result.rightZ = readSocketAxis(matrices, rightOffset, 11, 5);
}

function readSocketAxis(
  matrices: Float32Array,
  boneOffset: number,
  positionComponent: number,
  directionComponent: number,
): number {
  return (matrices[boneOffset + positionComponent] ?? 0)
    + (matrices[boneOffset + directionComponent] ?? 0)
      * VANGUARD_WEAPON_SOCKET_DISTANCE;
}
