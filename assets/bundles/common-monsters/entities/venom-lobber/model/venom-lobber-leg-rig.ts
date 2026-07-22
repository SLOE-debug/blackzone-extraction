/** Venom Lobber 固定六足标识，顺序与程序化几何生成顺序一致。 */
export enum VenomLobberLegId {
  LeftFront,
  LeftMiddle,
  LeftRear,
  RightFront,
  RightMiddle,
  RightRear,
}

/** 每条腿从身体到脚掌的三个刚性段。 */
export enum VenomLobberLegSegment {
  Coxa,
  Femur,
  Tibia,
}

export const VENOM_LOBBER_LEG_COUNT = 6;
export const VENOM_LOBBER_LEG_SEGMENT_COUNT = 3;
export const VENOM_LOBBER_LEG_JOINT_COUNT = 4;
export const VENOM_LOBBER_LEG_RADIAL_SEGMENTS = 6;
export const VENOM_LOBBER_LEG_JOINT_COMPONENT_COUNT = VENOM_LOBBER_LEG_COUNT
  * VENOM_LOBBER_LEG_JOINT_COUNT;

export type VenomLobberLegPathPoint = readonly [
  x: number,
  y: number,
  z: number,
  radius: number,
];

export type VenomLobberLegPath = readonly [
  VenomLobberLegPathPoint,
  VenomLobberLegPathPoint,
  VenomLobberLegPathPoint,
  VenomLobberLegPathPoint,
];

/** 六条腿的确定性静止关节与变截面半径。 */
export const VENOM_LOBBER_LEG_PATHS = Object.freeze([
  Object.freeze([
    [2.7, 1.1, 1.8, 0.45],
    [3.1, 2.7, 1.35, 0.38],
    [2.45, 4.35, 0.55, 0.3],
    [2.8, 5.15, 0.16, 0.2],
  ] as const),
  Object.freeze([
    [0.75, 1.55, 1.65, 0.52],
    [0.65, 3.25, 1.18, 0.42],
    [-0.15, 5, 0.48, 0.31],
    [0.12, 5.72, 0.14, 0.2],
  ] as const),
  Object.freeze([
    [-1.55, 1.45, 1.72, 0.5],
    [-2.25, 3, 1.24, 0.41],
    [-3.5, 4.48, 0.44, 0.3],
    [-3.55, 5.25, 0.13, 0.19],
  ] as const),
  Object.freeze([
    [2.85, -1.02, 1.75, 0.44],
    [3.38, -2.65, 1.3, 0.37],
    [2.9, -4.42, 0.5, 0.3],
    [3.16, -5.18, 0.15, 0.19],
  ] as const),
  Object.freeze([
    [0.55, -1.52, 1.62, 0.51],
    [0.2, -3.3, 1.12, 0.42],
    [-0.82, -4.9, 0.45, 0.31],
    [-0.72, -5.76, 0.14, 0.2],
  ] as const),
  Object.freeze([
    [-1.7, -1.34, 1.7, 0.49],
    [-2.55, -2.82, 1.18, 0.4],
    [-3.95, -4.12, 0.42, 0.29],
    [-4.08, -4.98, 0.13, 0.18],
  ] as const),
]) satisfies readonly VenomLobberLegPath[];

/** 返回指定腿与关节在扁平姿态流中的索引。 */
export function getVenomLobberLegJointIndex(legId: number, jointId: number): number {
  return legId * VENOM_LOBBER_LEG_JOINT_COUNT + jointId;
}

/** 交替三足 A 组：左前、右中、左后。 */
export function isVenomLobberTripodA(legId: number): boolean {
  return legId === VenomLobberLegId.LeftFront
    || legId === VenomLobberLegId.RightMiddle
    || legId === VenomLobberLegId.LeftRear;
}
