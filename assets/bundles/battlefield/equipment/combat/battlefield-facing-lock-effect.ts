/** 能够占有人物朝向的稳定来源。 */
export enum BattlefieldFacingLockSource {
  HammerSwing = 'hammer-swing',
  HammerUppercut = 'hammer-uppercut',
  HammerGroundSlam = 'hammer-ground-slam',
  HammerSpin = 'hammer-spin',
}

/** 左摇杆仍可移动时独立锁定人物朝向的 Effect。 */
export interface BattlefieldFacingLockEffect {
  readonly source: BattlefieldFacingLockSource;
  readonly lockedHeading: number;
  readonly remainingSeconds: number;
}
