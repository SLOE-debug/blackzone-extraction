/** 战场地形、玩家、相机和怪物生成共享的空间布局。 */
export const BATTLEFIELD_LAYOUT = Object.freeze({
  groundHalfExtent: 225,
  groundColumns: 100,
  groundRows: 100,
  playerPosition: Object.freeze({
    x: 0,
    y: 0.05,
    z: 0,
  }),
  camera: Object.freeze({
    distance: 30,
    azimuthAngle: Math.atan2(17, 20),
    pitchDegrees: 35,
    minimumPitchDegrees: 20,
    maximumPitchDegrees: 75,
    targetOffsetY: 1.3,
  }),
});
