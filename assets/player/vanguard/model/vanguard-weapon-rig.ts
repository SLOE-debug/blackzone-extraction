import { VanguardWeaponPose } from './vanguard-weapon-pose';

/** 武器根使用的类型化局部挂点。 */
export enum VanguardWeaponRigSocket {
  MainGrip,
  SupportGrip,
}

export interface VanguardWeaponRigPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 一类武器的刚性根俯仰和必要挂点。 */
export interface VanguardWeaponRigProfile {
  readonly pose: VanguardWeaponPose;
  readonly readyPitch: number;
  readonly sockets: Readonly<Record<VanguardWeaponRigSocket, Readonly<VanguardWeaponRigPoint>>>;
}

const ORIGIN = point(0, 0, 0);

const UNARMED_RIG = profile({
  pose: VanguardWeaponPose.Unarmed,
  readyPitch: 0,
  sockets: sockets(ORIGIN, ORIGIN),
});

const ONE_HAND_HEAVY_RIG = profile({
  pose: VanguardWeaponPose.OneHandHeavy,
  readyPitch: -0.035,
  sockets: sockets(
    ORIGIN,
    ORIGIN,
  ),
});

const VANGUARD_WEAPON_RIGS = Object.freeze({
  [VanguardWeaponPose.Unarmed]: UNARMED_RIG,
  [VanguardWeaponPose.OneHandHeavy]: ONE_HAND_HEAVY_RIG,
} satisfies Readonly<Record<VanguardWeaponPose, Readonly<VanguardWeaponRigProfile>>>);

/** 返回由武器姿态枚举登记的刚性挂点配置。 */
export function getVanguardWeaponRigProfile(
  pose: VanguardWeaponPose,
): Readonly<VanguardWeaponRigProfile> {
  return VANGUARD_WEAPON_RIGS[pose];
}

function sockets(
  mainGrip: Readonly<VanguardWeaponRigPoint>,
  supportGrip: Readonly<VanguardWeaponRigPoint>,
): Readonly<Record<VanguardWeaponRigSocket, Readonly<VanguardWeaponRigPoint>>> {
  return Object.freeze({
    [VanguardWeaponRigSocket.MainGrip]: mainGrip,
    [VanguardWeaponRigSocket.SupportGrip]: supportGrip,
  });
}

function profile(value: VanguardWeaponRigProfile): Readonly<VanguardWeaponRigProfile> {
  return Object.freeze(value);
}

function point(x: number, y: number, z: number): Readonly<VanguardWeaponRigPoint> {
  return Object.freeze({ x, y, z });
}
