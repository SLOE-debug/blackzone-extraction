import { WeaponSkillCommand } from '../../../../core/equipment/equipment';

/** 物品栏矢量图标清单。 */
export enum EquipmentIconId {
  Sledgehammer = 'sledgehammer',
}

/** 武器技能矢量图标清单。 */
export enum SkillIconId {
  HammerWhirlwind = 'hammer-whirlwind',
  HammerGroundSlam = 'hammer-ground-slam',
  HammerUppercut = 'hammer-uppercut',
}

/** 径向技能扇区中的稳定位置。 */
export type WeaponSkillHudPosition = 0 | 1 | 2;

/** 单枚技能按钮由装备原型提供的展示与命令契约。 */
export interface WeaponSkillHudProfile {
  readonly command: WeaponSkillCommand;
  readonly icon: SkillIconId;
  readonly label: string;
  readonly position: WeaponSkillHudPosition;
}

/** 一件装备向物品栏和技能区提供的完整 HUD 配置。 */
export interface EquipmentHudProfile {
  readonly inventoryIcon: EquipmentIconId;
  readonly skills: readonly Readonly<WeaponSkillHudProfile>[];
}
