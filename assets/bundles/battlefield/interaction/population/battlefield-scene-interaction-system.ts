import { EquipmentId } from '../../equipment/catalog/equipment-id';
import { BattlefieldInteractionAction } from '../model/battlefield-interaction';
import { type BattlefieldEquipmentPickupSystem } from '../../equipment/population/battlefield-equipment-pickup-system';
import { type MutableDroppedEquipmentInspection } from '../../equipment/population/dropped-equipment-population';
import { type BattlefieldTreasurePopulation } from '../../treasure-chest/population/battlefield-treasure-population';
import { type BattlefieldControlHud } from '../../ui/battlefield-control-hud';
import { BattlefieldInteractionResolver } from './battlefield-interaction-resolver';

/** 连接场景交互解析、独立操作按钮和装备世界标签。 */
export class BattlefieldSceneInteractionSystem {
  private readonly resolver = new BattlefieldInteractionResolver();
  private readonly equipmentInspection: MutableDroppedEquipmentInspection = {
    instanceId: -1,
    equipmentId: EquipmentId.DesertEagle,
    x: 0,
    y: 0,
    z: 0,
  };
  private active = true;
  private disposed = false;

  constructor(
    private readonly treasures: BattlefieldTreasurePopulation,
    equipmentPickup: BattlefieldEquipmentPickupSystem,
    private readonly hud: BattlefieldControlHud,
  ) {
    this.resolver.register(treasures);
    this.resolver.register(equipmentPickup);
  }

  /** 消费 HUD 的一次性操作输入并路由给上次解析到的提供者。 */
  public consumeActionInput(): BattlefieldInteractionAction | null {
    if (this.disposed || !this.active || !this.hud.consumeContextActionPress()) {
      return null;
    }
    const action = this.resolver.currentAction;
    return action !== null && this.resolver.activateCurrent() ? action : null;
  }

  /** 按玩家最新位置刷新操作图案和最近落地装备标签。 */
  public synchronize(playerX: number, playerZ: number): void {
    if (this.disposed || !this.active) {
      return;
    }
    this.treasures.synchronizeAttention(playerX, playerZ);
    const interaction = this.resolver.resolve(playerX, playerZ);
    this.hud.setContextAction(interaction?.action ?? null);
    if (this.treasures.writeNearestEquipmentInspection(
      playerX,
      playerZ,
      this.equipmentInspection,
    )) {
      this.hud.presentEquipmentLabel(this.equipmentInspection);
    } else {
      this.hud.presentEquipmentLabel(null);
    }
  }

  /** 玩家死亡后停止解析交互，并立即清除操作图案与世界标签。 */
  public suspend(): void {
    if (this.disposed || !this.active) {
      return;
    }
    this.active = false;
    this.hud.setContextAction(null);
    this.hud.presentEquipmentLabel(null);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.hud.setContextAction(null);
    this.hud.presentEquipmentLabel(null);
  }
}
