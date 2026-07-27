import { type GeometryBounds } from '../../../../core/geometry/buffer-geometry';
import { BATTLEFIELD_LAYOUT } from '../../model/battlefield-layout';

const HORIZONTAL_EFFECT_MARGIN = 8;
const MAXIMUM_VISIBLE_HEIGHT = 12;
const PREWARM_HIDDEN_DEPTH = -24;

/**
 * 覆盖完整战场、宝箱爆散、玩家丢弃与加载期真实绘制预热的固定包围盒。
 *
 * 两个掉落 Draw Call 使用该保守边界，运行期移动不再触发 Mesh 几何变更。
 */
export const DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS = Object.freeze({
  minX: -BATTLEFIELD_LAYOUT.groundHalfExtent - HORIZONTAL_EFFECT_MARGIN,
  minY: PREWARM_HIDDEN_DEPTH,
  minZ: -BATTLEFIELD_LAYOUT.groundHalfExtent - HORIZONTAL_EFFECT_MARGIN,
  maxX: BATTLEFIELD_LAYOUT.groundHalfExtent + HORIZONTAL_EFFECT_MARGIN,
  maxY: MAXIMUM_VISIBLE_HEIGHT,
  maxZ: BATTLEFIELD_LAYOUT.groundHalfExtent + HORIZONTAL_EFFECT_MARGIN,
}) satisfies Readonly<GeometryBounds>;

/** 预热几何位于地面下且仍落在固定包围盒内。 */
export const DROPPED_EQUIPMENT_PREWARM_Y = -16;
