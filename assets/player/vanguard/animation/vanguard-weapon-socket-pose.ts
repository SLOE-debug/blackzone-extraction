import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../model/vanguard-bone';
import { type VanguardState } from '../model/vanguard-state';
import { type MutableVanguardWeaponSocketPosition } from '../model/vanguard-weapon-socket';

// 从右手骨骼起点沿掌骨方向推进，避免武器停在手腕关节上。
const MAIN_HAND_SOCKET_DISTANCE = 0.17;

/** 从右手骨骼矩阵写出掌心附近的主手武器挂点。 */
export function writeVanguardMainHandWeaponSocket(
  state: VanguardState,
  entityIndex: number,
  result: MutableVanguardWeaponSocketPosition,
): void {
  const matrices = state.data.pose.boneMatrices;
  const entityOffset = entityIndex
    * VanguardBone.Count
    * VANGUARD_BONE_MATRIX_COMPONENTS;
  const handOffset = entityOffset
    + VanguardBone.RightHand * VANGUARD_BONE_MATRIX_COMPONENTS;
  result.x = (matrices[handOffset + 9] ?? 0)
    + (matrices[handOffset + 3] ?? 0) * MAIN_HAND_SOCKET_DISTANCE;
  result.y = (matrices[handOffset + 10] ?? 0)
    + (matrices[handOffset + 4] ?? 0) * MAIN_HAND_SOCKET_DISTANCE;
  result.z = (matrices[handOffset + 11] ?? 0)
    + (matrices[handOffset + 5] ?? 0) * MAIN_HAND_SOCKET_DISTANCE;
}
