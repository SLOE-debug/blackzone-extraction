import { VanguardWeaponPose } from './vanguard-weapon-pose';
import { VanguardWeaponAction } from './vanguard-weapon-action';

/** 主角单帧使用的世界平面移动与瞄准意图。 */
export interface VanguardControlIntent {
  /** 世界 X 轴上的移动输入，完整输入范围为负一至一。 */
  readonly moveX: number;
  /** 世界 Z 轴上的移动输入，完整输入范围为负一至一。 */
  readonly moveZ: number;
  /** 世界 X 轴上的归一化瞄准方向。 */
  readonly aimX: number;
  /** 世界 Z 轴上的归一化瞄准方向。 */
  readonly aimZ: number;
  /** 枪口相对水平面的瞄准俯仰角。 */
  readonly aimPitch: number;
  /** 是否应由瞄准方向而非移动方向控制角色朝向。 */
  readonly aiming: boolean;
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
    || !Number.isFinite(intent.aimX)
    || !Number.isFinite(intent.aimZ)
    || !Number.isFinite(intent.aimPitch)) {
    throw new Error('主角移动和瞄准意图必须是有限数值。');
  }
  if (Math.hypot(intent.moveX, intent.moveZ) > 1.0001) {
    throw new Error('主角移动意图长度不能超过一。');
  }
  const aimLength = Math.hypot(intent.aimX, intent.aimZ);
  if (intent.aiming && Math.abs(aimLength - 1) > 0.001) {
    throw new Error('生效的主角瞄准方向必须归一化。');
  }
  if (Math.abs(intent.aimPitch) > Math.PI * 0.45) {
    throw new Error('主角瞄准俯仰角超出人体与武器约束范围。');
  }
  if (!Number.isInteger(intent.weaponPose)
    || intent.weaponPose < VanguardWeaponPose.Unarmed
    || intent.weaponPose > VanguardWeaponPose.Shotgun
    || !Number.isInteger(intent.weaponAction)
    || intent.weaponAction < VanguardWeaponAction.Ready
    || intent.weaponAction > VanguardWeaponAction.Reload
    || !Number.isFinite(intent.weaponActionProgress)
    || intent.weaponActionProgress < 0
    || intent.weaponActionProgress > 1) {
    throw new Error('主角武器姿态或动作进度不符合稳定契约。');
  }
}
