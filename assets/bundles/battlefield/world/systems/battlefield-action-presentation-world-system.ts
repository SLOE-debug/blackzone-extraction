import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldCombatModuleId,
} from '../../action-modules/model/battlefield-combat-module';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

const MODULE_IDS = Object.freeze([
  BattlefieldCombatModuleId.Grab,
  BattlefieldCombatModuleId.Throw,
  BattlefieldCombatModuleId.Reserved,
]);

/** Presentation 阶段同步轮盘上下文、禁用原因和世界预览投影。 */
export class BattlefieldActionPresentationWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Presentation;
  public readonly order = 5;
  protected readonly performanceStage = BattlefieldPerformanceStage.Status;

  protected execute(world: BattlefieldWorld): void {
    const { actions, controls } = world.resources;
    controls.setCombatModuleContext(
      actions.carrying ? BattlefieldCombatModuleId.Throw : null,
    );
    for (const moduleId of MODULE_IDS) {
      controls.presentCombatModuleAvailability(
        moduleId,
        actions.getUnavailableReason(moduleId),
      );
    }
    controls.presentCombatModulePreview(actions.preview);
  }
}
