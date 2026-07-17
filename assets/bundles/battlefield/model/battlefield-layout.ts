/** 战场地形、玩家、相机和怪物生成共享的空间布局。 */
export const BATTLEFIELD_LAYOUT = Object.freeze({
  groundHalfExtent: 26,
  groundColumns: 14,
  groundRows: 14,
  centralSafeRadius: 16,
  playerPosition: Object.freeze({
    x: 0,
    y: 0.05,
    z: 0,
  }),
  cameraPosition: Object.freeze({
    x: 17,
    y: 15,
    z: 20,
  }),
  cameraTarget: Object.freeze({
    x: 0,
    y: 1.35,
    z: 0,
  }),
});
