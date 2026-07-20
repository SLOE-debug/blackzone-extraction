import { VanguardWeaponPose } from './vanguard-weapon-pose';

/** 武器姿态系统使用的类型化局部挂点。 */
export enum VanguardWeaponRigSocket {
  MainGrip,
  SupportGrip,
  Muzzle,
  PumpHandle,
  Magazine,
}

export interface VanguardWeaponRigPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 一类武器的姿态根、握把、动作挂点和重量参数。 */
export interface VanguardWeaponRigProfile {
  readonly pose: VanguardWeaponPose;
  readonly readyRoot: Readonly<VanguardWeaponRigPoint>;
  readonly runningRoot: Readonly<VanguardWeaponRigPoint>;
  readonly readyPitch: number;
  readonly runningPitch: number;
  readonly runningRoll: number;
  readonly mainHandInfluence: number;
  readonly supportHandInfluence: number;
  readonly sockets: Readonly<Record<VanguardWeaponRigSocket, Readonly<VanguardWeaponRigPoint>>>;
  readonly mainHandAxis: Readonly<VanguardWeaponRigPoint>;
  readonly supportHandAxis: Readonly<VanguardWeaponRigPoint>;
  readonly mainElbowPole: Readonly<VanguardWeaponRigPoint>;
  readonly supportElbowPole: Readonly<VanguardWeaponRigPoint>;
  readonly pumpTravel: number;
  readonly reloadLowering: number;
  readonly reloadTuck: number;
  readonly recoilPitchImpulse: number;
  readonly recoilBackImpulse: number;
  readonly recoilStiffness: number;
  readonly recoilDamping: number;
}

const ORIGIN = point(0, 0, 0);

const UNARMED_RIG = profile({
  pose: VanguardWeaponPose.Unarmed,
  readyRoot: point(0, 2.4, 0.5),
  runningRoot: point(0, 2.32, 0.42),
  readyPitch: 0,
  runningPitch: 0,
  runningRoll: 0,
  mainHandInfluence: 0,
  supportHandInfluence: 0,
  sockets: sockets(ORIGIN, ORIGIN, ORIGIN, ORIGIN, ORIGIN),
  mainHandAxis: point(0, -0.2, 0.98),
  supportHandAxis: point(0, -0.2, 0.98),
  mainElbowPole: point(0.5, -0.3, -0.1),
  supportElbowPole: point(-0.5, -0.3, -0.1),
  pumpTravel: 0,
  reloadLowering: 0,
  reloadTuck: 0,
  recoilPitchImpulse: 0,
  recoilBackImpulse: 0,
  recoilStiffness: 0,
  recoilDamping: 0,
});

const HANDGUN_RIG = profile({
  pose: VanguardWeaponPose.Handgun,
  readyRoot: point(0.29, 2.38, 1.12),
  runningRoot: point(0.3, 2.26, 1.02),
  readyPitch: -0.015,
  runningPitch: 0.055,
  runningRoll: -0.025,
  mainHandInfluence: 1,
  supportHandInfluence: 0,
  sockets: sockets(
    ORIGIN,
    point(-0.18, 0.02, 0.16),
    point(0, 0.1028, 0.3484),
    point(0, 0, 0.08),
    point(-0.08, -0.4, 0.08),
  ),
  mainHandAxis: point(0, -0.18, 0.984),
  supportHandAxis: point(0.2, -0.2, 0.96),
  mainElbowPole: point(0.52, -0.32, -0.16),
  supportElbowPole: point(-0.48, -0.35, -0.08),
  pumpTravel: 0,
  reloadLowering: 0.16,
  reloadTuck: 0.12,
  recoilPitchImpulse: 1.35,
  recoilBackImpulse: 0.42,
  recoilStiffness: 105,
  recoilDamping: 18,
});

const SHOTGUN_RIG = profile({
  pose: VanguardWeaponPose.Shotgun,
  readyRoot: point(0.28, 2.34, 0.96),
  runningRoot: point(0.29, 2.2, 0.83),
  readyPitch: 0.025,
  runningPitch: 0.09,
  runningRoll: -0.055,
  mainHandInfluence: 1,
  supportHandInfluence: 1,
  sockets: sockets(
    ORIGIN,
    point(-0.57, 0.03, 0.52),
    point(0, 0.118, 0.998),
    point(-0.57, 0.03, 0.52),
    point(-0.19, -0.65, -0.25),
  ),
  mainHandAxis: point(0, -0.2, 0.98),
  supportHandAxis: point(-0.12, -0.16, 0.98),
  mainElbowPole: point(0.5, -0.34, -0.18),
  supportElbowPole: point(-0.62, -0.3, 0.02),
  pumpTravel: 0.34,
  reloadLowering: 0.2,
  reloadTuck: 0.16,
  recoilPitchImpulse: 2.15,
  recoilBackImpulse: 0.78,
  recoilStiffness: 82,
  recoilDamping: 15,
});

const VANGUARD_WEAPON_RIGS = Object.freeze({
  [VanguardWeaponPose.Unarmed]: UNARMED_RIG,
  [VanguardWeaponPose.Handgun]: HANDGUN_RIG,
  [VanguardWeaponPose.Shotgun]: SHOTGUN_RIG,
} satisfies Readonly<Record<VanguardWeaponPose, Readonly<VanguardWeaponRigProfile>>>);

/** 返回由武器姿态枚举登记的完整 Rig 配置。 */
export function getVanguardWeaponRigProfile(
  pose: VanguardWeaponPose,
): Readonly<VanguardWeaponRigProfile> {
  return VANGUARD_WEAPON_RIGS[pose];
}

function sockets(
  mainGrip: Readonly<VanguardWeaponRigPoint>,
  supportGrip: Readonly<VanguardWeaponRigPoint>,
  muzzle: Readonly<VanguardWeaponRigPoint>,
  pumpHandle: Readonly<VanguardWeaponRigPoint>,
  magazine: Readonly<VanguardWeaponRigPoint>,
): Readonly<Record<VanguardWeaponRigSocket, Readonly<VanguardWeaponRigPoint>>> {
  return Object.freeze({
    [VanguardWeaponRigSocket.MainGrip]: mainGrip,
    [VanguardWeaponRigSocket.SupportGrip]: supportGrip,
    [VanguardWeaponRigSocket.Muzzle]: muzzle,
    [VanguardWeaponRigSocket.PumpHandle]: pumpHandle,
    [VanguardWeaponRigSocket.Magazine]: magazine,
  });
}

function profile(value: VanguardWeaponRigProfile): Readonly<VanguardWeaponRigProfile> {
  return Object.freeze(value);
}

function point(x: number, y: number, z: number): Readonly<VanguardWeaponRigPoint> {
  return Object.freeze({ x, y, z });
}
