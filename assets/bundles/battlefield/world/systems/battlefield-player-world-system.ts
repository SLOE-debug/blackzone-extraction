import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { BattlefieldPlayerControlController } from '../../combat/battlefield-player-control-controller';
import {
  toVanguardWeaponAction,
  toVanguardWeaponPose,
} from '../../scene/battlefield-vanguard-weapon-adapter';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在锤击状态确定后提交角色控制意图，再推进移动与动画。 */
export class BattlefieldPlayerWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PreSimulation;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Player;
  private readonly controller = new BattlefieldPlayerControlController();

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, camera, controls, weapon, monsters } = world.resources;
    this.controller.apply(
      player,
      camera,
      controls.state,
      toVanguardWeaponPose(weapon.weaponGrip),
      toVanguardWeaponAction(weapon.weaponAction, weapon.weaponGrip),
      weapon.weaponActionProgress,
      weapon.weaponActionSide,
      monsters.playerMovementSpeedMultiplier,
      weapon.actionControl,
    );
    player.update(deltaTime);
  }
}
