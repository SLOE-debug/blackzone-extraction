import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldMeleeTargetResolver,
  createMutableMeleeAttackDirection,
  type BattlefieldMeleeAttackDirectionRequest,
} from '../../combat/battlefield-melee-target-resolver';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type MutableBattlefieldPlanarDirection } from '../../scene/battlefield-camera-direction';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';
import { WeaponKind } from '../../../../core/equipment/equipment';

const AUTO_TARGET_RADIUS_PADDING = 1.1;
const AIM_DIRECTION_EPSILON_SQUARED = 0.0001;

/** 把无方向普攻、独立技能键与近战自动瞄准转换为大锤命令。 */
export class BattlefieldWeaponInputWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Input;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Control;
  private readonly movementDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 0 };
  private readonly bowAimDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 1 };
  private readonly targetResolver = new BattlefieldMeleeTargetResolver();
  private readonly aim = createMutableMeleeAttackDirection();
  private readonly attackDirectionRequest: Mutable<BattlefieldMeleeAttackDirectionRequest> = {
    originX: 0,
    originZ: 0,
    acquireRadius: 1,
    attackReach: 1,
    attackArcRadians: Math.PI,
    currentHeading: 0,
    previousAttackHeading: null,
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
    const skills = controls.consumeSkillCommands();
    const skillRequested = skills.spinRequested
      || skills.groundSlamRequested
      || skills.recallAllRequested
      || skills.huntingTetherRequested;
    if (!player.isAlive
      || !weapon.equipped
      || (!controlState.attackHeld && !controlState.attackPressed)
      || skillRequested) {
      this.targetResolver.releaseTarget();
    }
    weapon.commands.setAttackHeld(player.isAlive && weapon.equipped && controlState.attackHeld);
    if (!player.isAlive || !weapon.equipped) {
      return;
    }
    const attackRequested = controlState.attackPressed || controlState.attackHeld;
    if (weapon.weaponKind === WeaponKind.ReturningBow) {
      if (!skillRequested && attackRequested) {
        this.writeBowJoystickDirection(world);
        weapon.commands.requestSwing(this.bowAimDirection.x, this.bowAimDirection.z);
      }
      if (weapon.acceptingSkillCommand) {
        if (skills.recallAllRequested) {
          weapon.commands.requestRecallAll();
        }
        if (skills.huntingTetherRequested) {
          weapon.commands.requestHuntingTether();
        }
      }
      return;
    }
    if (!skillRequested
      && attackRequested
      && (weapon.actionControl.autoTargetAllowed || weapon.canBufferNextSwing)
      && (weapon.needsInitialSwingAim || weapon.canBufferNextSwing)) {
      this.writeAttackDirection(world, weapon.canBufferNextSwing ? weapon.attackHeading : null);
      weapon.commands.requestSwing(this.aim.directionX, this.aim.directionZ);
    }
    if (!weapon.acceptingSkillCommand) {
      return;
    }
    if (skills.spinRequested) {
      weapon.commands.requestSpin();
    }
    if (skills.groundSlamRequested) {
      this.writeAttackDirection(world, null);
      weapon.commands.requestGroundSlam(this.aim.directionX, this.aim.directionZ);
    }
  }

  /** 把右摇杆屏幕方向转换为世界攻击方向；键盘攻击沿当前角色朝向。 */
  private writeBowJoystickDirection(world: BattlefieldWorld): void {
    const { player, camera, controls } = world.resources;
    const aimX = controls.state.attackAimX;
    const aimY = controls.state.attackAimY;
    if (aimX * aimX + aimY * aimY <= AIM_DIRECTION_EPSILON_SQUARED) {
      this.bowAimDirection.x = Math.sin(player.heading);
      this.bowAimDirection.z = Math.cos(player.heading);
      return;
    }
    camera.writeWorldPlanarUnitDirection(aimX, aimY, this.bowAimDirection);
  }

  /** 为普通横扫和重砸统一解析一次动作开始方向。 */
  private writeAttackDirection(
    world: BattlefieldWorld,
    previousAttackHeading: number | null,
  ): void {
    const { player, weapon, monsters } = world.resources;
    const request = this.attackDirectionRequest;
    request.originX = player.positionX;
    request.originZ = player.positionZ;
    request.acquireRadius = weapon.meleeReach + AUTO_TARGET_RADIUS_PADDING;
    request.attackReach = weapon.meleeReach;
    request.attackArcRadians = weapon.meleeHitArcRadians;
    request.currentHeading = player.heading;
    request.previousAttackHeading = previousAttackHeading;
    this.targetResolver.writeBestAttackDirection(
      monsters.meleeTargeting,
      request,
      this.aim,
    );
  }
}

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
