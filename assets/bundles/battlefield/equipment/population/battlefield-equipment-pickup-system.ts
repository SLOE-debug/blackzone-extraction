import { EquipmentId } from '../../../../core/equipment/equipment';
import {
  BattlefieldInteractionAction,
  type BattlefieldInteractionProvider,
  type MutableBattlefieldInteractionCandidate,
} from '../../interaction/model/battlefield-interaction';
import { type MutableDroppedEquipmentInspection } from './dropped-equipment-population';

/** 拾取系统依赖的世界掉落物门面。 */
export interface BattlefieldEquipmentPickupSource {
  writeNearestEquipmentInspection(
    playerX: number,
    playerZ: number,
    result: MutableDroppedEquipmentInspection,
  ): boolean;
  getDroppedEquipmentId(instanceId: number): EquipmentId | null;
  removeDroppedEquipment(instanceId: number): boolean;
  spawnPlayerDiscard(
    equipmentId: EquipmentId,
    x: number,
    y: number,
    z: number,
    heading: number,
  ): void;
}

/** 拾取系统依赖的唯一武器槽门面。 */
export interface BattlefieldEquipmentWeaponSlot {
  equip(equipmentId: EquipmentId): EquipmentId | null;
}

/** 武器替换系统读取的玩家世界姿态。 */
export interface BattlefieldEquipmentCarrier {
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly heading: number;
}

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
    private readonly treasures: BattlefieldEquipmentPickupSource,
    private readonly playerWeapon: BattlefieldEquipmentWeaponSlot,
    private readonly carrier: BattlefieldEquipmentCarrier,
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
    const replacedEquipmentId = this.playerWeapon.equip(equipmentId);
    if (!this.treasures.removeDroppedEquipment(sourceId)) {
      throw new Error('玩家装备成功后未能移除对应的战场掉落物。');
    }
    if (replacedEquipmentId !== null) {
      this.treasures.spawnPlayerDiscard(
        replacedEquipmentId,
        this.carrier.positionX,
        this.carrier.positionY + 1.35,
        this.carrier.positionZ,
        this.carrier.heading,
      );
    }
    return true;
  }
}
