import { BattlefieldEnvironmentPrototype } from './battlefield-environment-prototype';

/** 一个环境 Archetype 的固定容量、渲染和占地契约。 */
export interface BattlefieldEnvironmentPrototypeConfig {
  readonly capacity: number;
  readonly baseCollisionRadius: number;
  readonly blocksPlayer: boolean;
  readonly minimumScale: number;
  readonly maximumScale: number;
}

/** 环境原型到批处理配置的完整强类型映射。 */
export const BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG = Object.freeze({
  [BattlefieldEnvironmentPrototype.DeadTree]: Object.freeze({
    capacity: 192,
    baseCollisionRadius: 0.58,
    blocksPlayer: true,
    minimumScale: 0.78,
    maximumScale: 1.28,
  }),
  [BattlefieldEnvironmentPrototype.LuminousMushroom]: Object.freeze({
    capacity: 160,
    baseCollisionRadius: 0,
    blocksPlayer: false,
    minimumScale: 0.72,
    maximumScale: 1.18,
  }),
  [BattlefieldEnvironmentPrototype.CrystalCluster]: Object.freeze({
    capacity: 64,
    baseCollisionRadius: 0.92,
    blocksPlayer: true,
    minimumScale: 0.78,
    maximumScale: 1.18,
  }),
  [BattlefieldEnvironmentPrototype.RockFormation]: Object.freeze({
    capacity: 96,
    baseCollisionRadius: 1.08,
    blocksPlayer: true,
    minimumScale: 0.78,
    maximumScale: 1.35,
  }),
  [BattlefieldEnvironmentPrototype.VehicleWreck]: Object.freeze({
    capacity: 16,
    baseCollisionRadius: 2.45,
    blocksPlayer: true,
    minimumScale: 0.88,
    maximumScale: 1.08,
  }),
  [BattlefieldEnvironmentPrototype.GlowPlant]: Object.freeze({
    capacity: 192,
    baseCollisionRadius: 0,
    blocksPlayer: false,
    minimumScale: 0.7,
    maximumScale: 1.22,
  }),
  [BattlefieldEnvironmentPrototype.CorruptedPool]: Object.freeze({
    capacity: 32,
    baseCollisionRadius: 0,
    blocksPlayer: false,
    minimumScale: 0.72,
    maximumScale: 1.18,
  }),
  [BattlefieldEnvironmentPrototype.RitualAltar]: Object.freeze({
    capacity: 12,
    baseCollisionRadius: 1.85,
    blocksPlayer: true,
    minimumScale: 0.9,
    maximumScale: 1.12,
  }),
} satisfies Readonly<Record<
  BattlefieldEnvironmentPrototype,
  BattlefieldEnvironmentPrototypeConfig
>>);

/** 战场无限环境窗口的确定性分块参数。 */
export const BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG = Object.freeze({
  seed: 0x6e71c39,
  chunkSize: 45,
  activeChunkRadius: 2,
  obstacleCellSize: 8,
  playerSafeRadius: 7.5,
});
