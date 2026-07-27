import { BATTLEFIELD_INVENTORY_CAPACITY } from '../model/battlefield-inventory-state';

export const BATTLEFIELD_INVENTORY_SLOT_SIZE = 44;
export const BATTLEFIELD_INVENTORY_SLOT_GAP = 7;
export const BATTLEFIELD_INVENTORY_SECURED_GAP = 16;

/** 底部物品栏全部命中中心和丢弃边界。 */
export interface BattlefieldInventoryLayout {
  readonly slotCentersX: readonly number[];
  readonly securedCenterX: number;
  readonly centerY: number;
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumY: number;
  readonly maximumY: number;
}

/** 根据 Canvas 尺寸计算固定五格和撤离锁定格的居中布局。 */
export function createBattlefieldInventoryLayout(
  width: number,
  height: number,
): Readonly<BattlefieldInventoryLayout> {
  const normalWidth = BATTLEFIELD_INVENTORY_CAPACITY * BATTLEFIELD_INVENTORY_SLOT_SIZE
    + (BATTLEFIELD_INVENTORY_CAPACITY - 1) * BATTLEFIELD_INVENTORY_SLOT_GAP;
  const totalWidth = normalWidth + BATTLEFIELD_INVENTORY_SECURED_GAP
    + BATTLEFIELD_INVENTORY_SLOT_SIZE;
  const startX = -totalWidth * 0.5 + BATTLEFIELD_INVENTORY_SLOT_SIZE * 0.5;
  const centerY = -height * 0.5 + BATTLEFIELD_INVENTORY_SLOT_SIZE * 0.5 + 14;
  const slotCentersX = Array.from(
    { length: BATTLEFIELD_INVENTORY_CAPACITY },
    (_, index) => startX + index * (
      BATTLEFIELD_INVENTORY_SLOT_SIZE + BATTLEFIELD_INVENTORY_SLOT_GAP
    ),
  );
  const securedCenterX = startX + normalWidth + BATTLEFIELD_INVENTORY_SECURED_GAP;
  const half = BATTLEFIELD_INVENTORY_SLOT_SIZE * 0.72;
  return Object.freeze({
    slotCentersX: Object.freeze(slotCentersX),
    securedCenterX,
    centerY,
    minimumX: startX - half,
    maximumX: securedCenterX + half,
    minimumY: centerY - half,
    maximumY: centerY + half,
  });
}

/** 返回触点覆盖的普通格索引。 */
export function findBattlefieldInventorySlotAt(
  layout: Readonly<BattlefieldInventoryLayout>,
  x: number,
  y: number,
): number {
  const hitHalf = BATTLEFIELD_INVENTORY_SLOT_SIZE * 0.7;
  if (Math.abs(y - layout.centerY) > hitHalf) {
    return -1;
  }
  for (let index = 0; index < layout.slotCentersX.length; index++) {
    if (Math.abs(x - (layout.slotCentersX[index] ?? 0)) <= hitHalf) {
      return index;
    }
  }
  return -1;
}

export function isOverBattlefieldSecuredSlot(
  layout: Readonly<BattlefieldInventoryLayout>,
  x: number,
  y: number,
): boolean {
  const hitHalf = BATTLEFIELD_INVENTORY_SLOT_SIZE * 0.7;
  return Math.abs(x - layout.securedCenterX) <= hitHalf
    && Math.abs(y - layout.centerY) <= hitHalf;
}

export function isOutsideBattlefieldInventory(
  layout: Readonly<BattlefieldInventoryLayout>,
  x: number,
  y: number,
): boolean {
  return x < layout.minimumX
    || x > layout.maximumX
    || y < layout.minimumY
    || y > layout.maximumY;
}
