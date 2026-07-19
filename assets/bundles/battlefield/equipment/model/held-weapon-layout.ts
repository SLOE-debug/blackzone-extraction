const MODEL_SCALE = 0.16;
const MODEL_ORIGIN_FORWARD_OFFSET = 0.09;
const MODEL_ORIGIN_HEIGHT_OFFSET = 0.07;
// 两个局部坐标必须与沙漠之鹰网格中的八边形膛口中心保持一致。
const MUZZLE_LOCAL_FORWARD = 1.615;
const MUZZLE_LOCAL_HEIGHT = 0.205;

/** 手枪模型相对掌心挂点的握持位置，以及由真实几何枪口推导的弹道起点。 */
export const HELD_WEAPON_LAYOUT = Object.freeze({
  modelScale: MODEL_SCALE,
  modelOriginForwardOffset: MODEL_ORIGIN_FORWARD_OFFSET,
  modelOriginHeightOffset: MODEL_ORIGIN_HEIGHT_OFFSET,
  muzzleForwardFromSocket: MODEL_ORIGIN_FORWARD_OFFSET
    + MUZZLE_LOCAL_FORWARD * MODEL_SCALE,
  muzzleHeightFromSocket: MODEL_ORIGIN_HEIGHT_OFFSET
    + MUZZLE_LOCAL_HEIGHT * MODEL_SCALE,
});
