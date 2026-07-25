/** 抓取按住会话锁定的稳定实体身份与最近一次合法世界姿态。 */
export interface MutableBattlefieldGrabTargetLock {
  active: boolean;
  populationId: number;
  entityId: number;
  lastValidX: number;
  lastValidY: number;
  lastValidZ: number;
}

/** 创建未持有任何实体的抓取锁定状态。 */
export function createBattlefieldGrabTargetLock(): MutableBattlefieldGrabTargetLock {
  return {
    active: false,
    populationId: 0,
    entityId: -1,
    lastValidX: 0,
    lastValidY: 0,
    lastValidZ: 0,
  };
}

/** 记录新获取目标，后续帧只按稳定实体身份复验。 */
export function acquireBattlefieldGrabTargetLock(
  lock: MutableBattlefieldGrabTargetLock,
  populationId: number,
  entityId: number,
  x: number,
  y: number,
  z: number,
): void {
  lock.active = true;
  lock.populationId = populationId;
  lock.entityId = entityId;
  updateBattlefieldGrabTargetLockPosition(lock, x, y, z);
}

/** 更新锁定实体最近一次通过复验的世界姿态。 */
export function updateBattlefieldGrabTargetLockPosition(
  lock: MutableBattlefieldGrabTargetLock,
  x: number,
  y: number,
  z: number,
): void {
  lock.lastValidX = x;
  lock.lastValidY = y;
  lock.lastValidZ = z;
}

/** 结束抓取会话并清除稳定实体身份。 */
export function clearBattlefieldGrabTargetLock(
  lock: MutableBattlefieldGrabTargetLock,
): void {
  lock.active = false;
  lock.populationId = 0;
  lock.entityId = -1;
  lock.lastValidX = 0;
  lock.lastValidY = 0;
  lock.lastValidZ = 0;
}
