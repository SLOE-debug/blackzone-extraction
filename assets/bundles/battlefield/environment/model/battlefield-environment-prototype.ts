/** 战场环境实体的稳定原型标识。 */
export enum BattlefieldEnvironmentPrototype {
  DeadTree,
  LuminousMushroom,
  CrystalCluster,
  RockFormation,
  VehicleWreck,
  GlowPlant,
  CorruptedPool,
  RitualAltar,
  MonsterNest,
}

/** 按稳定原型顺序遍历环境 Archetype。 */
export const BATTLEFIELD_ENVIRONMENT_PROTOTYPES = Object.freeze([
  BattlefieldEnvironmentPrototype.DeadTree,
  BattlefieldEnvironmentPrototype.LuminousMushroom,
  BattlefieldEnvironmentPrototype.CrystalCluster,
  BattlefieldEnvironmentPrototype.RockFormation,
  BattlefieldEnvironmentPrototype.VehicleWreck,
  BattlefieldEnvironmentPrototype.GlowPlant,
  BattlefieldEnvironmentPrototype.CorruptedPool,
  BattlefieldEnvironmentPrototype.RitualAltar,
  BattlefieldEnvironmentPrototype.MonsterNest,
] as const);
