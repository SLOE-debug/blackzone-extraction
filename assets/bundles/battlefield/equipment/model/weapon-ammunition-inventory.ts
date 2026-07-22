import {
  type AmmunitionEquipmentDefinition,
  type WeaponEquipmentDefinition,
} from '../../../../core/equipment/equipment';
import {
  type AmmunitionEquipmentId,
  type WeaponEquipmentId,
} from '../catalog/equipment-id';
import {
  createWeaponAmmunition,
  type WeaponAmmunition,
} from './weapon-ammunition';
import { WeaponAmmunitionReserve } from './weapon-ammunition-reserve';

/**
 * 管理玩家按口径共享的备用弹药，并为每件拾取武器创建独立满弹仓。
 *
 * 世界掉落物没有携带旧武器实例状态，因此再次拾取同枪型时不得复用曾被打空的弹仓。
 */
export class WeaponAmmunitionInventory {
  private readonly reserve = new WeaponAmmunitionReserve();
  private readonly provisionedWeaponTypes = new Set<WeaponEquipmentId>();

  /** 为刚拾取的武器创建全新满弹仓，不在资源准备成功前改变共享库存。 */
  public createFreshMagazine(
    definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>>,
  ): WeaponAmmunition {
    return createWeaponAmmunition(definition.ammunition, this.reserve);
  }

  /** 在武器渲染与弹体资源成功创建后，只为首次获得的枪型发放初始备用弹。 */
  public provisionFirstAcquisition(
    definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>>,
  ): void {
    if (!this.provisionedWeaponTypes.has(definition.id)) {
      this.provisionedWeaponTypes.add(definition.id);
      if (definition.ammunition.initialReserveRounds > 0) {
        this.reserve.add(
          definition.ammunition.ammunitionType,
          definition.ammunition.initialReserveRounds,
        );
      }
    }
  }

  /** 把世界弹药拾取物按口径加入共享库存。 */
  public receive(
    definition: Readonly<AmmunitionEquipmentDefinition<AmmunitionEquipmentId>>,
  ): void {
    this.reserve.add(definition.ammunitionType, definition.rounds);
  }
}
