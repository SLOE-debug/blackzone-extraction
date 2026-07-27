import { WeaponAction } from '../../../../core/equipment/equipment';
import { type EquipmentHudProfile } from '../catalog/equipment-hud-profile';
import { EquipmentId } from '../catalog/equipment-id';

/** 当前手持装备向 HUD 提交的同帧技能、图标和充能快照。 */
export interface EquippedWeaponPresentation {
  readonly equipmentId: EquipmentId;
  readonly itemInstanceSeed: number;
  readonly hud: Readonly<EquipmentHudProfile>;
  readonly hitCount: number;
  readonly requiredHits: number;
  readonly momentumReady: boolean;
  readonly action: WeaponAction;
  readonly actionProgress: number;
}
