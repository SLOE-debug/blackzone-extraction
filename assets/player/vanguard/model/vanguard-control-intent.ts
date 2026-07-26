import { VanguardWeaponPose } from './vanguard-weapon-pose';
import { VanguardWeaponAction } from './vanguard-weapon-action';

/** 主角单帧使用的世界平面移动与攻击朝向意图。 */
export interface VanguardControlIntent {
  /** 世界 X 轴上的移动输入，完整输入范围为负一至一。 */
  readonly moveX: number;
  /** 世界 Z 轴上的移动输入，完整输入范围为负一至一。 */
  readonly moveZ: number;
  /** 世界 X 轴上的归一化攻击方向。 */
  readonly attackX: number;
  /** 世界 Z 轴上的归一化攻击方向。 */
  readonly attackZ: number;
  /** 是否应由攻击方向而非移动方向控制角色朝向。 */
  readonly attacking: boolean;
  /** 是否由外部 Effect 在移动求解前锁定人物朝向。 */
  readonly facingLocked: boolean;
  /** 朝向锁定生效时使用的世界 Y 轴弧度。 */
  readonly lockedHeading: number;
  /** 当前装备要求的类型化上身武器姿态。 */
  readonly weaponPose: VanguardWeaponPose;
  /** 当前武器正在执行的强类型动作。 */
  readonly weaponAction: VanguardWeaponAction;
  /** 当前武器动作从零到一的归一化进度。 */
  readonly weaponActionProgress: number;
}

/** 校验场景写入的控制值，避免无效输入污染连续状态。 */
export function validateVanguardControlIntent(
  intent: Readonly<VanguardControlIntent>,
): void {
  if (!Number.isFinite(intent.moveX)
    || !Number.isFinite(intent.moveZ)
    || !Number.isFinite(intent.attackX)
    || !Number.isFinite(intent.attackZ)
    || !Number.isFinite(intent.lockedHeading)) {
    throw new Error('主角移动和攻击意图必须是有限数值。');
  }
  if (Math.hypot(intent.moveX, intent.moveZ) > 1.0001) {
    throw new Error('主角移动意图长度不能超过一。');
  }
  const attackLength = Math.hypot(intent.attackX, intent.attackZ);
  if (intent.attacking && Math.abs(attackLength - 1) > 0.001) {
    throw new Error('生效的主角攻击方向必须归一化。');
  }
  if (!Number.isInteger(intent.weaponPose)
    || intent.weaponPose < VanguardWeaponPose.Unarmed
    || intent.weaponPose > VanguardWeaponPose.OneHandHeavy
    || !Number.isInteger(intent.weaponAction)
    || intent.weaponAction < VanguardWeaponAction.Idle
    || intent.weaponAction > VanguardWeaponAction.Recover
    || !Number.isFinite(intent.weaponActionProgress)
    || intent.weaponActionProgress < 0
    || intent.weaponActionProgress > 1) {
    throw new Error('主角武器姿态或动作进度不符合稳定契约。');
  }
}
