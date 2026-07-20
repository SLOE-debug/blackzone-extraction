import { BattlefieldEnvironmentPrototype } from '../../environment/catalog/battlefield-environment-catalog';

/** 宝箱生成必须避开的蘑菇、发光草和岩石原型。 */
export const BATTLEFIELD_TREASURE_CHEST_ENVIRONMENT_BLOCKERS = Object.freeze([
  BattlefieldEnvironmentPrototype.LuminousMushroom,
  BattlefieldEnvironmentPrototype.GlowPlant,
  BattlefieldEnvironmentPrototype.RockFormation,
] as const);
