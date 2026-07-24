import { type ChunkRuntimeRegistry } from '../../../core/world/chunk-runtime-registry';
import { type VanguardPopulation } from '../../../player/vanguard';
import { type BattlefieldPerformanceLogger } from '../debug/battlefield-performance-logger';
import { type BattlefieldEnvironmentPopulation } from '../environment/population/battlefield-environment-population';
import { type BattlefieldPlayerWeaponRuntime } from '../equipment/population/battlefield-player-weapon-runtime';
import { type BattlefieldSceneInteractionSystem } from '../interaction/population/battlefield-scene-interaction-system';
import { type BattlefieldMonsterPopulation } from '../population/battlefield-monster-population';
import { type BattlefieldGroundRenderer } from '../rendering/battlefield-ground-renderer';
import { type BattlefieldCameraRig } from '../scene/battlefield-camera';
import { type BattlefieldTreasurePopulation } from '../treasure-chest/population/battlefield-treasure-population';
import { type BattlefieldControlHud } from '../ui/battlefield-control-hud';
import {
  type BattlefieldCombatModuleRuntime,
} from '../action-modules/population/battlefield-combat-module-runtime';

/** BattlefieldWorld 统一持有的稳定运行时资源引用。 */
export interface BattlefieldWorldResources {
  readonly performance: BattlefieldPerformanceLogger;
  readonly player: VanguardPopulation;
  readonly camera: BattlefieldCameraRig;
  readonly environment: BattlefieldEnvironmentPopulation;
  readonly chunks: ChunkRuntimeRegistry<BattlefieldEnvironmentPopulation>;
  readonly ground: BattlefieldGroundRenderer;
  readonly weapon: BattlefieldPlayerWeaponRuntime;
  readonly monsters: BattlefieldMonsterPopulation;
  readonly treasures: BattlefieldTreasurePopulation;
  readonly controls: BattlefieldControlHud;
  readonly interaction: BattlefieldSceneInteractionSystem;
  readonly actions: BattlefieldCombatModuleRuntime;
}
