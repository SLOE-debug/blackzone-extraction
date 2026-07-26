import { EquipmentId } from '../catalog/equipment-id';
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
}

/** 拾取事务依赖的固定容量物品栏门面。 */
export interface BattlefieldEquipmentInventory {
  tryInsert(equipmentId: EquipmentId, stackCount?: number, instanceSeed?: number): boolean;
}

/** 把最近掉落物查询适配为拾取交互，并保证满包时地面物品不会丢失。 */
export class BattlefieldEquipmentPickupSystem implements BattlefieldInteractionProvider {
  private readonly inspection: MutableDroppedEquipmentInspection = {
    instanceId: -1,
    equipmentId: EquipmentId.Sledgehammer,
    x: 0,
    y: 0,
    z: 0,
  };

  constructor(
    private readonly source: BattlefieldEquipmentPickupSource,
    private readonly inventory: BattlefieldEquipmentInventory,
  ) {}

  public writeNearestInteraction(
    playerX: number,
    playerZ: number,
    result: MutableBattlefieldInteractionCandidate,
  ): boolean {
    if (!this.source.writeNearestEquipmentInspection(playerX, playerZ, this.inspection)) {
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
    const equipmentId = this.source.getDroppedEquipmentId(sourceId);
    if (equipmentId === null) {
      return false;
    }
    // 实例标识同时作为拾取种子，Chunk 重载后仍能保持同一世界物品身份。
    if (!this.inventory.tryInsert(equipmentId, 1, sourceId)) {
      return false;
    }
    if (!this.source.removeDroppedEquipment(sourceId)) {
      throw new Error('物品栏提交成功后未能移除对应的战场掉落物。');
    }
    return true;
  }
}
