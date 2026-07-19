import { EquipmentId } from '../../../../core/equipment/equipment';
import { type MutableDroppedEquipmentInspection } from '../../equipment/population/dropped-equipment-population';
import { BattlefieldTreasurePopulation } from '../../treasure-chest/population/battlefield-treasure-population';
import { BattlefieldControlHud } from '../../ui/battlefield-control-hud';
import { BattlefieldInteractionResolver } from './battlefield-interaction-resolver';

/** 连接场景交互解析、右摇杆动作图案和装备世界标签。 */
export class BattlefieldSceneInteractionSystem {
  private readonly resolver = new BattlefieldInteractionResolver();
  private readonly equipmentInspection: MutableDroppedEquipmentInspection = {
    equipmentId: EquipmentId.DesertEagle,
    x: 0,
    y: 0,
    z: 0,
  };
  private disposed = false;

  constructor(
    private readonly treasures: BattlefieldTreasurePopulation,
    private readonly hud: BattlefieldControlHud,
  ) {
    this.resolver.register(treasures);
  }

  /** 消费 HUD 的一次性操作输入并路由给上次解析到的提供者。 */
  public consumeActionInput(): void {
    if (!this.disposed && this.hud.consumeContextActionPress()) {
      this.resolver.activateCurrent();
    }
  }

  /** 按玩家最新位置刷新操作图案和最近落地装备标签。 */
  public synchronize(playerX: number, playerZ: number): void {
    if (this.disposed) {
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

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.hud.setContextAction(null);
    this.hud.presentEquipmentLabel(null);
  }
}
