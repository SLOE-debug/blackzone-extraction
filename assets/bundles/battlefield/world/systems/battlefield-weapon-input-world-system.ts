import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldMeleeTargetResolver,
  type MutableBattlefieldMeleeAim,
} from '../../combat/battlefield-melee-target-resolver';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type MutableBattlefieldPlanarDirection } from '../../scene/battlefield-camera-direction';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

const AUTO_TARGET_RADIUS_PADDING = 1.1;

/** 把无方向普攻、独立技能键与近战自动瞄准转换为大锤命令。 */
export class BattlefieldWeaponInputWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Input;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Control;
  private readonly movementDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 0 };
  private readonly targetResolver = new BattlefieldMeleeTargetResolver();
  private readonly aim: MutableBattlefieldMeleeAim = {
    directionX: 0,
    directionZ: 1,
    targeted: false,
    populationId: -1,
    entityId: -1,
  };

  protected execute(world: BattlefieldWorld): void {
    const { player, camera, controls, weapon } = world.resources;
    const controlState = controls.state;
    camera.writeWorldPlanarDirection(
      controlState.moveX,
      controlState.moveY,
      this.movementDirection,
    );
    this.targetResolver.observeMovement(
      this.movementDirection.x,
      this.movementDirection.z,
    );
    if (!controlState.attackHeld && !controlState.attackPressed) {
      this.targetResolver.releaseTarget();
    }

    const skills = controls.consumeSkillCommands();
    weapon.commands.setAttackHeld(player.isAlive && weapon.equipped && controlState.attackHeld);
    if (!player.isAlive || !weapon.equipped) {
      return;
    }
    const attackRequested = controlState.attackPressed || controlState.attackHeld;
    if (attackRequested
      && (weapon.needsInitialSwingAim || weapon.canBufferNextSwing)) {
      this.writeAim(world);
      weapon.commands.requestSwing(this.aim.directionX, this.aim.directionZ);
    }
    if (!weapon.acceptingSkillCommand) {
      return;
    }
    if (skills.spinRequested) {
      weapon.commands.requestSpin();
    }
    if (skills.groundSlamRequested) {
      this.writeAim(world);
      weapon.commands.requestGroundSlam(this.aim.directionX, this.aim.directionZ);
    }
    if (skills.uppercutRequested) {
      this.writeAim(world);
      weapon.commands.requestUppercut(this.aim.directionX, this.aim.directionZ);
    }
  }

  /** 为普通横扫、上挑和重砸统一解析一次动作开始方向。 */
  private writeAim(world: BattlefieldWorld): void {
    const { player, weapon, monsters } = world.resources;
    this.targetResolver.writeAim(
      monsters.meleeTargeting,
      player.positionX,
      player.positionZ,
      weapon.meleeReach + AUTO_TARGET_RADIUS_PADDING,
      this.movementDirection.x,
      this.movementDirection.z,
      player.heading,
      this.aim,
    );
  }
}
