import {
  VanguardBone,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import {
  getVanguardWeaponRigProfile,
  VanguardWeaponRigSocket,
} from '../model/vanguard-weapon-rig';
import { writePitchFrame } from './vanguard-pose-frame';
import { VANGUARD_WEAPON_SOCKET_DISTANCE } from './vanguard-weapon-socket-pose';

const POSITION_EPSILON = 0.000001;

/** 让武器根刚性跟随右掌挂点，避免持枪时再由 IK 拉扯人体关节。 */
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
  aimPitch: number,
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
  const pitch = profile.readyPitch - aimPitch;
  const pitchCosine = Math.cos(pitch);
  const pitchSine = Math.sin(pitch);
  const rootX = gripX - mainGrip.x;
  const rootY = gripY - mainGrip.y * pitchCosine + mainGrip.z * pitchSine;
  const rootZ = gripZ - mainGrip.y * pitchSine - mainGrip.z * pitchCosine;
  writePitchFrame(
    matrices,
    entityOffset,
    VanguardBone.WeaponAimRoot,
    rootX,
    rootY,
    rootZ,
    pitch,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
}
