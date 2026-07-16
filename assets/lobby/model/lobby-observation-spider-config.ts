import { LOBBY_LAYOUT } from './lobby-layout';

/** 墙后巨型蜘蛛的缩放、运动范围与探头节奏。 */
export const LOBBY_OBSERVATION_SPIDER_CONFIG = Object.freeze({
  initialScale: 0.5,
  minimumScale: 0.5,
  maximumScale: 10,
  floorY: 0.04,
  glassZ: LOBBY_LAYOUT.observationGlassZ,
  forwardReachPerScale: 12.2,
  watchingClearance: 0.55,
  retreatDepthPerScale: 10,
  roamingHorizontalAmplitude: 4.2,
  watchingSideOffset: 2.15,
  watchingInwardYaw: 0.24,
  minimumRoamingDuration: 10,
  roamingDurationRange: 9,
  sidePositioningDuration: 3.6,
  turningDuration: 2.8,
  approachDuration: 4.2,
  watchingDuration: 5.2,
  retreatDuration: 2.1,
  watchingDriftAmplitude: 0.14,
  localSpawnWidth: 0.52,
  localSpawnHeight: 0.24,
  seed: 0x5a17c3,
});
