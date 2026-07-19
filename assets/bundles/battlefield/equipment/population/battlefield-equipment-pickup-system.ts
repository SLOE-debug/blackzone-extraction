import { EquipmentId } from '../../../../core/equipment/equipment';
import {
  BattlefieldInteractionAction,
  type BattlefieldInteractionProvider,
  type MutableBattlefieldInteractionCandidate,
} from '../../interaction/model/battlefield-interaction';
import { type BattlefieldTreasurePopulation } from '../../treasure-chest/population/battlefield-treasure-population';
import { type BattlefieldPlayerWeaponRuntime } from './battlefield-player-weapon-runtime';
import { type MutableDroppedEquipmentInspection } from './dropped-equipment-population';

/** 把宝箱掉落物查询适配为拾取交互，并在成功后替换玩家唯一武器槽。 */
export class BattlefieldEquipmentPickupSystem implements BattlefieldInteractionProvider {
  private readonly inspection: MutableDroppedEquipmentInspection = {
    instanceId: -1,
    equipmentId: EquipmentId.DesertEagle,
    x: 0,
    y: 0,
    z: 0,
  };

  constructor(
    private readonly treasures: BattlefieldTreasurePopulation,
    private readonly playerWeapon: BattlefieldPlayerWeaponRuntime,
  ) {}

  public writeNearestInteraction(
    playerX: number,
    playerZ: number,
    result: MutableBattlefieldInteractionCandidate,
  ): boolean {
    if (!this.treasures.writeNearestEquipmentInspection(
      playerX,
      playerZ,
      this.inspection,
    )) {
      return false;
    }
    const deltaX = this.inspection.x - playerX;
    const deltaZ = this.inspection.z - playerZ;
    result.sourceId = this.inspection.instanceId;
    result.action = BattlefieldInteractionAction.PickupEquipment;
    result.x = this.inspection.x;
    result.z = this.inspection.z;
    result.distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
    return true;
  }

  public activateInteraction(
    sourceId: number,
    action: BattlefieldInteractionAction,
  ): boolean {
    if (action !== BattlefieldInteractionAction.PickupEquipment) {
      return false;
    }
    const equipmentId = this.treasures.getDroppedEquipmentId(sourceId);
    if (equipmentId === null) {
      return false;
    }
    this.playerWeapon.equip(equipmentId);
    if (!this.treasures.removeDroppedEquipment(sourceId)) {
      throw new Error('玩家装备成功后未能移除对应的战场掉落物。');
    }
    return true;
  }
}
