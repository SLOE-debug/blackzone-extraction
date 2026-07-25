import {
  createBattlefieldActionPreview,
  type MutableBattlefieldActionPreview,
} from '../action-modules/model/battlefield-action-preview';

/** 为表现层创建与玩法状态隔离的预览快照。 */
export function createBattlefieldActionPreviewSnapshot(): MutableBattlefieldActionPreview {
  return createBattlefieldActionPreview();
}

/** 判断两个预览快照的全部可见字段是否一致。 */
export function equalsBattlefieldActionPreview(
  left: Readonly<MutableBattlefieldActionPreview>,
  right: Readonly<MutableBattlefieldActionPreview>,
): boolean {
  return left.type === right.type
    && left.active === right.active
    && left.valid === right.valid
    && left.blocked === right.blocked
    && left.startX === right.startX
    && left.startY === right.startY
    && left.startZ === right.startZ
    && left.endX === right.endX
    && left.endY === right.endY
    && left.endZ === right.endZ
    && left.targetX === right.targetX
    && left.targetY === right.targetY
    && left.targetZ === right.targetZ
    && left.impactRadius === right.impactRadius
    && left.arcHeight === right.arcHeight;
}

/** 把玩法预览复制到表现层独占的可写快照。 */
export function copyBattlefieldActionPreview(
  source: Readonly<MutableBattlefieldActionPreview>,
  target: MutableBattlefieldActionPreview,
): void {
  target.type = source.type;
  target.active = source.active;
  target.valid = source.valid;
  target.blocked = source.blocked;
  target.startX = source.startX;
  target.startY = source.startY;
  target.startZ = source.startZ;
  target.endX = source.endX;
  target.endY = source.endY;
  target.endZ = source.endZ;
  target.targetX = source.targetX;
  target.targetY = source.targetY;
  target.targetZ = source.targetZ;
  target.impactRadius = source.impactRadius;
  target.arcHeight = source.arcHeight;
}
