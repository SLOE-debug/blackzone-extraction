import {
  type WeaponAmmunitionDefinition,
  WeaponAmmunitionMode,
} from '../../../../core/equipment/equipment';

/** 武器射击系统依赖的可替换弹药消耗策略。 */
export interface WeaponAmmunition {
  /** 尝试为一次射击消耗弹药；库存不足时返回 false。 */
  tryConsumeShot(): boolean;
}

/** 默认无限弹药策略不会创建弹匣或备弹状态。 */
class InfiniteWeaponAmmunition implements WeaponAmmunition {
  public tryConsumeShot(): boolean {
    return true;
  }
}

/** 根据武器定义创建独占的弹药运行时，为后续有限弹药规则保留替换边界。 */
export function createWeaponAmmunition(
  definition: Readonly<WeaponAmmunitionDefinition>,
): WeaponAmmunition {
  switch (definition.mode) {
    case WeaponAmmunitionMode.Infinite:
      return new InfiniteWeaponAmmunition();
  }
  throw new Error('武器定义包含尚未实现的弹药规则。');
}
