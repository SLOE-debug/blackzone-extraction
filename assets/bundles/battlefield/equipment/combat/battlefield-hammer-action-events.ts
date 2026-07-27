/** 单次动作更新产生的无分配事件快照。 */
export interface MutableHammerActionEvents {
  uppercutImpact: boolean;
  groundSlamImpact: boolean;
  spinPulse: boolean;
  spinFinal: boolean;
}

/** 清空本帧动作事件，不重新分配快照。 */
export function resetHammerActionEvents(events: MutableHammerActionEvents): void {
  events.uppercutImpact = false;
  events.groundSlamImpact = false;
  events.spinPulse = false;
  events.spinFinal = false;
}

/** 返回可循环且保留零为未初始化值的下一序列号。 */
export function nextHammerActionSequence(current: number): number {
  return current >= 0xffffffff ? 1 : current + 1;
}
