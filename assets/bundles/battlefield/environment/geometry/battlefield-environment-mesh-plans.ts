import { BattlefieldEnvironmentPrototype } from '../model/battlefield-environment-prototype';
import { type BattlefieldEnvironmentMeshPlan } from './battlefield-environment-mesh-plan';
import {
  createDeadTreeMeshPlan,
  createGlowPlantMeshPlan,
  createLuminousMushroomMeshPlan,
} from './recipes/organic-environment-recipes';
import {
  createCorruptedPoolMeshPlan,
  createCrystalClusterMeshPlan,
  createRockFormationMeshPlan,
} from './recipes/mineral-environment-recipes';
import {
  createRitualAltarMeshPlan,
  createVehicleWreckMeshPlan,
} from './recipes/ruin-environment-recipes';

/** 环境原型到一次性编译固定拓扑的完整映射。 */
export const BATTLEFIELD_ENVIRONMENT_MESH_PLANS = Object.freeze({
  [BattlefieldEnvironmentPrototype.DeadTree]: createDeadTreeMeshPlan(),
  [BattlefieldEnvironmentPrototype.LuminousMushroom]: createLuminousMushroomMeshPlan(),
  [BattlefieldEnvironmentPrototype.CrystalCluster]: createCrystalClusterMeshPlan(),
  [BattlefieldEnvironmentPrototype.RockFormation]: createRockFormationMeshPlan(),
  [BattlefieldEnvironmentPrototype.VehicleWreck]: createVehicleWreckMeshPlan(),
  [BattlefieldEnvironmentPrototype.GlowPlant]: createGlowPlantMeshPlan(),
  [BattlefieldEnvironmentPrototype.CorruptedPool]: createCorruptedPoolMeshPlan(),
  [BattlefieldEnvironmentPrototype.RitualAltar]: createRitualAltarMeshPlan(),
} satisfies Readonly<Record<BattlefieldEnvironmentPrototype, BattlefieldEnvironmentMeshPlan>>);
