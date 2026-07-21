import { AmmunitionType } from '../../../../core/equipment/equipment';
import { type WeaponEquipmentId } from '../catalog/equipment-id';

/** HUD 使用的稳定口径短名；协议标识不直接作为玩家可见文本。 */
export const AMMUNITION_CALIBER_LABEL = Object.freeze({
  [AmmunitionType.FiftyActionExpress]: '.50 AE',
  [AmmunitionType.TwelveGauge]: '12 GA',
  [AmmunitionType.FortyFiveAcp]: '.45 ACP',
  [AmmunitionType.FiveFiveSixNato]: '5.56×45',
  [AmmunitionType.SevenSixTwoByThirtyNine]: '7.62×39',
} satisfies Readonly<Record<AmmunitionType, string>>);

/** 武器运行时向 HUD 暴露的只读弹药快照。 */
export interface WeaponAmmunitionStatus {
  readonly equipmentId: WeaponEquipmentId;
  readonly weaponName: string;
  readonly caliber: string;
  readonly roundsRemaining: number;
  readonly magazineCapacity: number;
  readonly reserveRounds: number;
  readonly reloading: boolean;
  readonly reloadProgress: number;
}

/** 运行时原地复用的可写弹药快照，避免每帧创建临时对象。 */
export interface MutableWeaponAmmunitionStatus extends WeaponAmmunitionStatus {
  equipmentId: WeaponEquipmentId;
  weaponName: string;
  caliber: string;
  roundsRemaining: number;
  magazineCapacity: number;
  reserveRounds: number;
  reloading: boolean;
  reloadProgress: number;
}
