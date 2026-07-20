import { VanguardWeaponPose } from './vanguard-weapon-pose';

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
  /** 是否应由瞄准方向而非移动方向控制角色朝向。 */
  readonly aiming: boolean;
  /** 当前装备要求的类型化上身武器姿态。 */
  readonly weaponPose: VanguardWeaponPose;
  /** 最近一次真实攻击留下的零到一姿态脉冲。 */
  readonly weaponAttackAmount: number;
}

/** 校验场景写入的控制值，避免无效输入污染连续状态。 */
export function validateVanguardControlIntent(
  intent: Readonly<VanguardControlIntent>,
): void {
  if (!Number.isFinite(intent.moveX)
    || !Number.isFinite(intent.moveZ)
    || !Number.isFinite(intent.aimX)
    || !Number.isFinite(intent.aimZ)) {
    throw new Error('主角移动和瞄准意图必须是有限数值。');
  }
  if (Math.hypot(intent.moveX, intent.moveZ) > 1.0001) {
    throw new Error('主角移动意图长度不能超过一。');
  }
  const aimLength = Math.hypot(intent.aimX, intent.aimZ);
  if (intent.aiming && Math.abs(aimLength - 1) > 0.001) {
    throw new Error('生效的主角瞄准方向必须归一化。');
  }
  if (!Number.isInteger(intent.weaponPose)
    || intent.weaponPose < VanguardWeaponPose.Unarmed
    || intent.weaponPose > VanguardWeaponPose.Handgun
    || !Number.isFinite(intent.weaponAttackAmount)
    || intent.weaponAttackAmount < 0
    || intent.weaponAttackAmount > 1) {
    throw new Error('主角武器姿态或攻击脉冲不符合稳定契约。');
  }
}
