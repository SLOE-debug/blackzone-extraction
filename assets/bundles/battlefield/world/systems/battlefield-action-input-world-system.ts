import { WorldPhase } from '../../../../core/world/world-phase';
import { type BattlefieldCombatModuleIntent } from '../../action-modules/model/battlefield-combat-module-intent';
import { BattlefieldCombatModuleId } from '../../action-modules/model/battlefield-combat-module';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type MutableBattlefieldPlanarDirection } from '../../scene/battlefield-camera-direction';
import {
  type MutableBattlefieldSkillWheelInput,
} from '../../ui/battlefield-skill-wheel';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** Input 阶段把技能轮盘手势转换为唯一世界方向模块意图。 */
export class BattlefieldActionInputWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Input;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Control;
  private readonly input: MutableBattlefieldSkillWheelInput = {
    moduleId: BattlefieldCombatModuleId.Grab,
    active: false,
    released: false,
    x: 0,
    y: 0,
    amplitude: 0,
  };
  private readonly direction: MutableBattlefieldPlanarDirection = { x: 0, z: 1 };
  private readonly intent: BattlefieldCombatModuleIntent = {
    moduleId: BattlefieldCombatModuleId.Grab,
    active: false,
    released: false,
    directionX: 0,
    directionZ: 1,
    amplitude: 0,
  };

  protected execute(world: BattlefieldWorld): void {
    const { controls, camera, player, actions } = world.resources;
    controls.consumeCombatModuleInput(this.input);
    const hasSkillDirection = this.input.amplitude > 0.000001;
    const hasAimDirection = controls.state.aiming;
    if (hasSkillDirection) {
      camera.writeWorldPlanarDirection(this.input.x, this.input.y, this.direction);
    } else if (hasAimDirection) {
      camera.writeWorldPlanarDirection(
        controls.state.aimX,
        controls.state.aimY,
        this.direction,
      );
    } else {
      this.direction.x = Math.sin(player.heading);
      this.direction.z = Math.cos(player.heading);
    }
    this.intent.moduleId = this.input.moduleId;
    this.intent.active = this.input.active;
    this.intent.released = this.input.released;
    this.intent.directionX = this.direction.x;
    this.intent.directionZ = this.direction.z;
    this.intent.amplitude = hasSkillDirection
      ? this.input.amplitude
      : hasAimDirection && (this.input.active || this.input.released) ? 1 : 0;
    actions.captureIntent(this.intent);
    if (this.input.active || this.input.released) {
      world.weaponFiringRequested = false;
    }
  }
}
