const DEGREES_TO_RADIANS = Math.PI / 180;

/** 右摇杆激活后用于查找纵向修正候选的参数。 */
export const BATTLEFIELD_AIM_ASSIST = Object.freeze({
  maximumAngleRadians: 6 * DEGREES_TO_RADIANS,
  maximumDistance: 16,
});
