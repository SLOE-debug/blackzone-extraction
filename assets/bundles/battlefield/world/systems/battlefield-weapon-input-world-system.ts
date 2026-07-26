import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { BattlefieldSkillButtonCommand } from '../../ui/battlefield-skill-button';
import { type MutableBattlefieldPlanarDirection } from '../../scene/battlefield-camera-direction';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 把右摇杆和独立技能键转换为大锤命令。 */
export class BattlefieldWeaponInputWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Input;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Control;
  private readonly attackDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 1 };

  protected execute(world: BattlefieldWorld): void {
    const { player, camera, controls, weapon } = world.resources;
    if (!player.isAlive) {
      controls.consumeSkillCommand();
      return;
    }
    const controlState = controls.state;
    if (controlState.attacking) {
      camera.writeWorldPlanarDirection(
        controlState.attackX,
        controlState.attackY,
        this.attackDirection,
      );
      weapon.commands.requestSwing(
        this.attackDirection.x,
        this.attackDirection.z,
        controlState.attackX > 0.15 ? true : controlState.attackX < -0.15 ? false : null,
      );
    }
    switch (controls.consumeSkillCommand()) {
      case BattlefieldSkillButtonCommand.Uppercut:
        weapon.commands.requestUppercut();
        break;
      case BattlefieldSkillButtonCommand.Spin:
        weapon.commands.requestSpin();
        break;
      case BattlefieldSkillButtonCommand.None:
        break;
    }
  }
}
