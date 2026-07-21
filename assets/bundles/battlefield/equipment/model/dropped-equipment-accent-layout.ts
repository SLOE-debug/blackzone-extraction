import { VANGUARD_ANATOMY } from '../../../../player/vanguard/model/vanguard-anatomy';

/** 毛笔形光管每一高度圈相对掉落物中心的非均匀偏移。 */
export interface DroppedEquipmentBeamRingOffset {
  readonly x: number;
  readonly z: number;
}

/** 掉落装备毛笔形 Unlit 信标的稳定布局。 */
export const DROPPED_EQUIPMENT_ACCENT_LAYOUT = Object.freeze({
  beamHeight: VANGUARD_ANATOMY.height,
  beamSegments: 7,
  beamRingHeights: Object.freeze([
    0, 0.28, 0.78, 1.42, 2.18, 3.1, VANGUARD_ANATOMY.height,
  ]),
  beamRingRadii: Object.freeze([0.22, 0.31, 0.27, 0.23, 0.17, 0.095, 0.018]),
  beamRingAlphas: Object.freeze([1, 0.9, 0.72, 0.52, 0.32, 0.14, 0]),
  beamRingOffsets: Object.freeze([
    Object.freeze({ x: 0, z: 0 }),
    Object.freeze({ x: 0.025, z: -0.018 }),
    Object.freeze({ x: -0.035, z: 0.028 }),
    Object.freeze({ x: 0.045, z: 0.04 }),
    Object.freeze({ x: 0.015, z: -0.055 }),
    Object.freeze({ x: -0.07, z: -0.025 }),
    Object.freeze({ x: -0.1, z: 0.035 }),
  ] satisfies readonly Readonly<DroppedEquipmentBeamRingOffset>[]),
  beamRingTwists: Object.freeze([
    0, 0.07, -0.04, 0.11, -0.08, 0.16, 0.23,
  ]),
  beamSegmentRadiusScales: Object.freeze([
    0.82, 1.18, 0.73, 1.08, 0.9, 1.24, 0.77,
  ]),
  beamBaseOffsetY: 0.16,
});
