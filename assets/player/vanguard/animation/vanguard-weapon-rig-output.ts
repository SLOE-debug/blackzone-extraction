import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../model/vanguard-bone';
import { type VanguardState } from '../model/vanguard-state';
import { type MutableVanguardWeaponRigPose } from '../model/vanguard-weapon-rig-pose';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import {
  getVanguardWeaponRigProfile,
  VanguardWeaponRigSocket,
} from '../model/vanguard-weapon-rig';

const EPSILON = 0.000001;

/** 从 WeaponRoot 最终 FK 矩阵写出武器运行时的权威根姿态。 */
export function writeVanguardWeaponRigPose(
  state: VanguardState,
  entityIndex: number,
  result: MutableVanguardWeaponRigPose,
): void {
  const matrices = state.data.pose.boneMatrices;
  const offset = entityIndex
    * VanguardBone.Count
    * VANGUARD_BONE_MATRIX_COMPONENTS
    + VanguardBone.WeaponRoot * VANGUARD_BONE_MATRIX_COMPONENTS;
  const scale = Math.max(Math.hypot(
    matrices[offset] ?? 1,
    matrices[offset + 1] ?? 0,
    matrices[offset + 2] ?? 0,
  ), EPSILON);
  result.rootX = matrices[offset + 9] ?? 0;
  result.rootY = matrices[offset + 10] ?? 0;
  result.rootZ = matrices[offset + 11] ?? 0;
  result.forwardX = (matrices[offset + 6] ?? 0) / scale;
  result.forwardY = (matrices[offset + 7] ?? 0) / scale;
  result.forwardZ = (matrices[offset + 8] ?? 1) / scale;
  const weaponPose = state.data.animation.weaponPose[entityIndex] as VanguardWeaponPose;
  const profile = getVanguardWeaponRigProfile(weaponPose);
  writeSocketPosition(
    matrices,
    offset,
    profile.sockets[VanguardWeaponRigSocket.MainGrip],
    result,
    true,
  );
  writeSocketPosition(
    matrices,
    offset,
    profile.sockets[VanguardWeaponRigSocket.SupportGrip],
    result,
    false,
  );
  writeBasisQuaternion(
    result,
    (matrices[offset] ?? 1) / scale,
    (matrices[offset + 1] ?? 0) / scale,
    (matrices[offset + 2] ?? 0) / scale,
    (matrices[offset + 3] ?? 0) / scale,
    (matrices[offset + 4] ?? 1) / scale,
    (matrices[offset + 5] ?? 0) / scale,
    (matrices[offset + 6] ?? 0) / scale,
    (matrices[offset + 7] ?? 0) / scale,
    (matrices[offset + 8] ?? 1) / scale,
  );
}

function writeSocketPosition(
  matrices: Float32Array,
  offset: number,
  socket: Readonly<{ x: number; y: number; z: number }>,
  result: MutableVanguardWeaponRigPose,
  main: boolean,
): void {
  const x = (matrices[offset + 9] ?? 0)
    + (matrices[offset] ?? 1) * socket.x
    + (matrices[offset + 3] ?? 0) * socket.y
    + (matrices[offset + 6] ?? 0) * socket.z;
  const y = (matrices[offset + 10] ?? 0)
    + (matrices[offset + 1] ?? 0) * socket.x
    + (matrices[offset + 4] ?? 1) * socket.y
    + (matrices[offset + 7] ?? 0) * socket.z;
  const z = (matrices[offset + 11] ?? 0)
    + (matrices[offset + 2] ?? 0) * socket.x
    + (matrices[offset + 5] ?? 0) * socket.y
    + (matrices[offset + 8] ?? 1) * socket.z;
  if (main) {
    result.mainGripX = x;
    result.mainGripY = y;
    result.mainGripZ = z;
  } else {
    result.supportGripX = x;
    result.supportGripY = y;
    result.supportGripZ = z;
  }
}

function writeBasisQuaternion(
  result: MutableVanguardWeaponRigPose,
  rightX: number,
  rightY: number,
  rightZ: number,
  upX: number,
  upY: number,
  upZ: number,
  forwardX: number,
  forwardY: number,
  forwardZ: number,
): void {
  const trace = rightX + upY + forwardZ;
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    result.rotationX = (upZ - forwardY) / scale;
    result.rotationY = (forwardX - rightZ) / scale;
    result.rotationZ = (rightY - upX) / scale;
    result.rotationW = scale * 0.25;
    return;
  }
  if (rightX > upY && rightX > forwardZ) {
    const scale = Math.sqrt(1 + rightX - upY - forwardZ) * 2;
    result.rotationX = scale * 0.25;
    result.rotationY = (rightY + upX) / scale;
    result.rotationZ = (rightZ + forwardX) / scale;
    result.rotationW = (upZ - forwardY) / scale;
    return;
  }
  if (upY > forwardZ) {
    const scale = Math.sqrt(1 + upY - rightX - forwardZ) * 2;
    result.rotationX = (rightY + upX) / scale;
    result.rotationY = scale * 0.25;
    result.rotationZ = (upZ + forwardY) / scale;
    result.rotationW = (forwardX - rightZ) / scale;
    return;
  }
  const scale = Math.sqrt(1 + forwardZ - rightX - upY) * 2;
  result.rotationX = (rightZ + forwardX) / scale;
  result.rotationY = (upZ + forwardY) / scale;
  result.rotationZ = scale * 0.25;
  result.rotationW = (rightY - upX) / scale;
}
