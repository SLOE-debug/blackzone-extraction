import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在玩家移动后刷新跟随相机与交互范围。 */
export class BattlefieldCameraWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Simulation;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.CameraAndInteraction;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, camera, interaction } = world.resources;
    camera.setFollowTarget(player.positionX, player.positionY, player.positionZ);
    camera.update(deltaTime);
    interaction.synchronize(player.positionX, player.positionZ);
  }
}
