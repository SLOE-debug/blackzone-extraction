import { WorldPhase } from '../../../../core/world/world-phase';
import { type BattlefieldCombatModuleIntent } from '../../action-modules/model/battlefield-combat-module-intent';
import { BattlefieldCombatModuleId } from '../../action-modules/model/battlefield-combat-module';
import { BattlefieldActionReleaseSource } from '../../action-modules/model/battlefield-action-release-source';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type MutableBattlefieldPlanarDirection } from '../../scene/battlefield-camera-direction';
import {
  type MutableBattlefieldSkillWheelInput,
} from '../../ui/battlefield-skill-wheel';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

const SKILL_DIRECTION_DEAD_ZONE = 0.18;

/** Input 阶段把技能轮盘手势转换为唯一世界方向模块意图。 */
export class BattlefieldActionInputWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Input;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Control;
  private readonly input: MutableBattlefieldSkillWheelInput = {
    moduleId: BattlefieldCombatModuleId.Grab,
    active: false,
    released: false,
    releaseSource: BattlefieldActionReleaseSource.None,
    x: 0,
    y: 0,
    amplitude: 0,
  };
  private readonly direction: MutableBattlefieldPlanarDirection = { x: 0, z: 1 };
  private readonly lastCombatAimDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 1 };
  private hasLastCombatAimDirection = false;
  private readonly intent: BattlefieldCombatModuleIntent = {
    moduleId: BattlefieldCombatModuleId.Grab,
    active: false,
    released: false,
    releaseSource: BattlefieldActionReleaseSource.None,
    directionX: 0,
    directionZ: 1,
    amplitude: 0,
  };

  protected execute(world: BattlefieldWorld): void {
    const { controls, camera, player, actions } = world.resources;
    controls.consumeCombatModuleInput(this.input);
    const remappedSkillAmplitude = remapSkillAmplitude(this.input.amplitude);
    const hasSkillDirection = remappedSkillAmplitude > 0;
    const hasAimDirection = controls.state.aiming;
    if (hasSkillDirection) {
      camera.writeWorldPlanarDirection(this.input.x, this.input.y, this.direction);
      this.rememberCombatAimDirection();
    } else if (hasAimDirection) {
      camera.writeWorldPlanarDirection(
        controls.state.aimX,
        controls.state.aimY,
        this.direction,
      );
      this.rememberCombatAimDirection();
    } else if (this.hasLastCombatAimDirection) {
      this.direction.x = this.lastCombatAimDirection.x;
      this.direction.z = this.lastCombatAimDirection.z;
    } else {
      this.direction.x = Math.sin(player.heading);
      this.direction.z = Math.cos(player.heading);
    }
    this.intent.moduleId = this.input.moduleId;
    this.intent.active = this.input.active;
    this.intent.released = this.input.released;
    this.intent.releaseSource = this.input.releaseSource;
    this.intent.directionX = this.direction.x;
    this.intent.directionZ = this.direction.z;
    this.intent.amplitude = hasSkillDirection
      ? remappedSkillAmplitude
      : hasAimDirection && (this.input.active || this.input.released) ? 1 : 0;
    actions.captureIntent(this.intent);
    if (this.input.active || this.input.released) {
      world.weaponFiringRequested = false;
    }
  }

  /** 保存最近一次明确的技能拖动或右摇杆世界瞄准方向。 */
  private rememberCombatAimDirection(): void {
    this.lastCombatAimDirection.x = this.direction.x;
    this.lastCombatAimDirection.z = this.direction.z;
    this.hasLastCombatAimDirection = true;
  }
}

/** 输入层唯一负责把物理拖动 Dead Zone 重映射到零到一有效幅度。 */
function remapSkillAmplitude(amplitude: number): number {
  if (amplitude <= SKILL_DIRECTION_DEAD_ZONE) {
    return 0;
  }
  return Math.min(1, (amplitude - SKILL_DIRECTION_DEAD_ZONE) / (1 - SKILL_DIRECTION_DEAD_ZONE));
}
