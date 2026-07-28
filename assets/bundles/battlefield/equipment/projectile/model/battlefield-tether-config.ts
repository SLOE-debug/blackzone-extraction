import { BATTLEFIELD_GROUND_Y } from '../../../model/battlefield-layout';

/** 猎场弦网固定在地面上方的高度。 */
export const BATTLEFIELD_TETHER_GROUND_HEIGHT = 0.16;

/** 猎场弦网碰撞与渲染共享的世界 Y。 */
export const BATTLEFIELD_TETHER_WORLD_Y = BATTLEFIELD_GROUND_Y
  + BATTLEFIELD_TETHER_GROUND_HEIGHT;

/** 弦线碰撞的平面半径。 */
export const BATTLEFIELD_TETHER_COLLISION_RADIUS = 0.18;
