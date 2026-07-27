import { type HammerActionControlProfile } from './battlefield-hammer-action-control';

/** 大锤动作时间轴向角色控制层提交的无分配控制快照。 */
export interface BattlefieldHammerActionControlEffect extends HammerActionControlProfile {
  readonly desiredHeading: number;
  readonly remainingSeconds: number;
}
