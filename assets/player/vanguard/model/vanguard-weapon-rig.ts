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

const HANDGUN_RIG = profile({
  pose: VanguardWeaponPose.Handgun,
  readyPitch: -0.015,
  sockets: sockets(
    ORIGIN,
    point(-0.18, 0.02, 0.16),
  ),
});

const LONG_GUN_RIG = profile({
  pose: VanguardWeaponPose.LongGun,
  readyPitch: 0.025,
  sockets: sockets(
    ORIGIN,
    point(-0.57, 0.03, 0.52),
  ),
});

const VANGUARD_WEAPON_RIGS = Object.freeze({
  [VanguardWeaponPose.Unarmed]: UNARMED_RIG,
  [VanguardWeaponPose.Handgun]: HANDGUN_RIG,
  [VanguardWeaponPose.LongGun]: LONG_GUN_RIG,
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
