import { VanguardWeaponAction } from '../model/vanguard-weapon-action';

/** 把多阶段武器动作统一映射为上身发力权重。 */
export function getVanguardWeaponAttackAmount(
  action: VanguardWeaponAction,
  progress: number,
): number {
  switch (action) {
    case VanguardWeaponAction.WindupLeft:
    case VanguardWeaponAction.WindupRight:
      return progress * 0.72;
    case VanguardWeaponAction.SwingLeft:
    case VanguardWeaponAction.SwingRight:
      return 1 - progress * 0.35;
    case VanguardWeaponAction.Uppercut:
    case VanguardWeaponAction.GroundSlam:
      return Math.sin(progress * Math.PI);
    case VanguardWeaponAction.Spin:
      return 0.82;
    case VanguardWeaponAction.Recover:
      return (1 - progress) * 0.45;
    case VanguardWeaponAction.Idle:
      return 0;
  }
}

/** 保留左右横扫和恢复阶段的有符号发力方向。 */
export function getVanguardWeaponAttackSide(
  action: VanguardWeaponAction,
  side: -1 | 0 | 1,
): -1 | 0 | 1 {
  switch (action) {
    case VanguardWeaponAction.WindupLeft:
    case VanguardWeaponAction.SwingLeft:
      return -1;
    case VanguardWeaponAction.WindupRight:
    case VanguardWeaponAction.SwingRight:
      return 1;
    case VanguardWeaponAction.Recover:
      return side;
    case VanguardWeaponAction.Idle:
    case VanguardWeaponAction.Uppercut:
    case VanguardWeaponAction.GroundSlam:
    case VanguardWeaponAction.Spin:
      return 0;
  }
}
