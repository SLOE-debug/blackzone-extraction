import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldPerformanceEvent,
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { BattlefieldInteractionAction } from '../../interaction/model/battlefield-interaction';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 采集 HUD 输入并把交互动作提交给场景交互系统。 */
export class BattlefieldControlWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Input;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Control;
  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { controls, interaction, performance } = world.resources;
    controls.update(deltaTime);
    const interactionAction = interaction.consumeActionInput();
    if (interactionAction === BattlefieldInteractionAction.OpenContainer) {
      performance.recordEvent(BattlefieldPerformanceEvent.ChestOpened);
    } else if (interactionAction === BattlefieldInteractionAction.PickupEquipment) {
      performance.recordEvent(BattlefieldPerformanceEvent.EquipmentPicked);
    }
  }
}
