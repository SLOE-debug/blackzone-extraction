import { WorldPhase } from '../../../../core/world/world-phase';
import { type BattlefieldActionPlayerPose } from '../../action-modules/model/battlefield-combat-module-intent';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** ActionExecution 阶段执行抓取/投掷并同步携带姿态。 */
export class BattlefieldActionExecutionWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PreSimulation;
  public readonly order = 5;
  protected readonly performanceStage = BattlefieldPerformanceStage.Player;
  private readonly pose: BattlefieldActionPlayerPose = {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    alive: true,
  };

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const player = world.resources.player;
    this.pose.x = player.positionX;
    this.pose.y = player.positionY;
    this.pose.z = player.positionZ;
    this.pose.heading = player.heading;
    this.pose.alive = player.isAlive;
    world.resources.actions.executeActions(this.pose, deltaTime);
  }
}
