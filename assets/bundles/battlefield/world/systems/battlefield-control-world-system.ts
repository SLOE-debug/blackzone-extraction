import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPlayerAimController } from '../../combat/battlefield-player-aim-controller';
import {
  BattlefieldPerformanceEvent,
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { BattlefieldInteractionAction } from '../../interaction/model/battlefield-interaction';
import {
  toVanguardWeaponAction,
  toVanguardWeaponPose,
} from '../../scene/battlefield-vanguard-weapon-adapter';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 采集 HUD 输入、交互事件并生成玩家移动和开火意图。 */
export class BattlefieldControlWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Input;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Control;
  private readonly playerAim = new BattlefieldPlayerAimController();

  protected execute(world: BattlefieldWorld): void {
    const { controls, interaction, performance, player, monsters, camera, weapon } =
      world.resources;
    controls.update();
    const interactionAction = interaction.consumeActionInput();
    if (interactionAction === BattlefieldInteractionAction.OpenContainer) {
      performance.recordEvent(BattlefieldPerformanceEvent.ChestOpened);
    } else if (interactionAction === BattlefieldInteractionAction.PickupEquipment) {
      performance.recordEvent(BattlefieldPerformanceEvent.EquipmentPicked);
    }
    if (!player.isAlive) {
      world.weaponFiringRequested = false;
      return;
    }
    world.weaponFiringRequested = this.playerAim.apply(
      player,
      camera,
      controls.state,
      toVanguardWeaponPose(weapon.weaponGrip),
      toVanguardWeaponAction(weapon.weaponAction),
      weapon.weaponActionProgress,
      monsters.playerMovementSpeedMultiplier,
      world.weaponFireDirection,
    );
  }
}
