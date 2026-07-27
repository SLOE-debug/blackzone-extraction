import {
  VanguardBone,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import {
  getVanguardWeaponRigProfile,
  VanguardWeaponRigSocket,
} from '../model/vanguard-weapon-rig';
import { writeYawPitchFrame } from './vanguard-pose-frame';
import { VANGUARD_WEAPON_SOCKET_DISTANCE } from './vanguard-weapon-socket-pose';

const POSITION_EPSILON = 0.000001;

/** 让武器根刚性跟随右掌挂点，避免手持装备再由 IK 拉扯人体关节。 */
export function writeVanguardWeaponRootFrame(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  weaponPose: VanguardWeaponPose,
  wristX: number,
  wristY: number,
  wristZ: number,
  handX: number,
  handY: number,
  handZ: number,
  actionYaw: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
): void {
  const handDirectionX = handX - wristX;
  const handDirectionY = handY - wristY;
  const handDirectionZ = handZ - wristZ;
  const inverseHandLength = 1 / Math.max(
    Math.hypot(handDirectionX, handDirectionY, handDirectionZ),
    POSITION_EPSILON,
  );
  const gripX = wristX
    + handDirectionX * inverseHandLength * VANGUARD_WEAPON_SOCKET_DISTANCE;
  const gripY = wristY
    + handDirectionY * inverseHandLength * VANGUARD_WEAPON_SOCKET_DISTANCE;
  const gripZ = wristZ
    + handDirectionZ * inverseHandLength * VANGUARD_WEAPON_SOCKET_DISTANCE;
  const profile = getVanguardWeaponRigProfile(weaponPose);
  const mainGrip = profile.sockets[VanguardWeaponRigSocket.MainGrip];
  const pitch = profile.readyPitch;
  const pitchCosine = Math.cos(pitch);
  const pitchSine = Math.sin(pitch);
  const yawCosine = Math.cos(actionYaw);
  const yawSine = Math.sin(actionYaw);
  const pitchedGripY = mainGrip.y * pitchCosine - mainGrip.z * pitchSine;
  const pitchedGripZ = mainGrip.y * pitchSine + mainGrip.z * pitchCosine;
  const rootX = gripX - mainGrip.x * yawCosine - pitchedGripZ * yawSine;
  const rootY = gripY - pitchedGripY;
  const rootZ = gripZ + mainGrip.x * yawSine - pitchedGripZ * yawCosine;
  writeYawPitchFrame(
    matrices,
    entityOffset,
    VanguardBone.WeaponRoot,
    rootX,
    rootY,
    rootZ,
    actionYaw,
    pitch,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
}
