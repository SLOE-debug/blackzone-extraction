import { BattlefieldEnvironmentMaterialKind } from './battlefield-environment-material-kind';
import { BattlefieldEnvironmentPrototype } from './battlefield-environment-prototype';

/** 一个环境 Archetype 的固定容量、渲染和占地契约。 */
export interface BattlefieldEnvironmentPrototypeConfig {
  readonly nodeName: string;
  readonly capacity: number;
  readonly requestedBatchSize: number;
  readonly materialKind: BattlefieldEnvironmentMaterialKind;
  readonly baseCollisionRadius: number;
  readonly blocksPlayer: boolean;
  readonly minimumScale: number;
  readonly maximumScale: number;
}

/** 环境原型到批处理配置的完整强类型映射。 */
export const BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG = Object.freeze({
  [BattlefieldEnvironmentPrototype.DeadTree]: Object.freeze({
    nodeName: 'BattlefieldDeadTrees',
    capacity: 192,
    requestedBatchSize: 96,
    materialKind: BattlefieldEnvironmentMaterialKind.Organic,
    baseCollisionRadius: 0.58,
    blocksPlayer: true,
    minimumScale: 0.78,
    maximumScale: 1.28,
  }),
  [BattlefieldEnvironmentPrototype.LuminousMushroom]: Object.freeze({
    nodeName: 'BattlefieldLuminousMushrooms',
    capacity: 160,
    requestedBatchSize: 128,
    materialKind: BattlefieldEnvironmentMaterialKind.Glow,
    baseCollisionRadius: 0,
    blocksPlayer: false,
    minimumScale: 0.72,
    maximumScale: 1.18,
  }),
  [BattlefieldEnvironmentPrototype.CrystalCluster]: Object.freeze({
    nodeName: 'BattlefieldCrystalClusters',
    capacity: 64,
    requestedBatchSize: 64,
    materialKind: BattlefieldEnvironmentMaterialKind.Glow,
    baseCollisionRadius: 0.92,
    blocksPlayer: true,
    minimumScale: 0.78,
    maximumScale: 1.18,
  }),
  [BattlefieldEnvironmentPrototype.RockFormation]: Object.freeze({
    nodeName: 'BattlefieldRockFormations',
    capacity: 96,
    requestedBatchSize: 96,
    materialKind: BattlefieldEnvironmentMaterialKind.Mineral,
    baseCollisionRadius: 1.08,
    blocksPlayer: true,
    minimumScale: 0.78,
    maximumScale: 1.35,
  }),
  [BattlefieldEnvironmentPrototype.VehicleWreck]: Object.freeze({
    nodeName: 'BattlefieldVehicleWrecks',
    capacity: 16,
    requestedBatchSize: 16,
    materialKind: BattlefieldEnvironmentMaterialKind.Metal,
    baseCollisionRadius: 2.45,
    blocksPlayer: true,
    minimumScale: 0.88,
    maximumScale: 1.08,
  }),
  [BattlefieldEnvironmentPrototype.GlowPlant]: Object.freeze({
    nodeName: 'BattlefieldGlowPlants',
    capacity: 192,
    requestedBatchSize: 128,
    materialKind: BattlefieldEnvironmentMaterialKind.Glow,
    baseCollisionRadius: 0,
    blocksPlayer: false,
    minimumScale: 0.7,
    maximumScale: 1.22,
  }),
  [BattlefieldEnvironmentPrototype.CorruptedPool]: Object.freeze({
    nodeName: 'BattlefieldCorruptedPools',
    capacity: 32,
    requestedBatchSize: 32,
    materialKind: BattlefieldEnvironmentMaterialKind.Pool,
    baseCollisionRadius: 0,
    blocksPlayer: false,
    minimumScale: 0.72,
    maximumScale: 1.18,
  }),
  [BattlefieldEnvironmentPrototype.RitualAltar]: Object.freeze({
    nodeName: 'BattlefieldRitualAltars',
    capacity: 12,
    requestedBatchSize: 12,
    materialKind: BattlefieldEnvironmentMaterialKind.Metal,
    baseCollisionRadius: 1.85,
    blocksPlayer: true,
    minimumScale: 0.9,
    maximumScale: 1.12,
  }),
  [BattlefieldEnvironmentPrototype.MonsterNest]: Object.freeze({
    nodeName: 'BattlefieldMonsterNests',
    capacity: 8,
    requestedBatchSize: 8,
    materialKind: BattlefieldEnvironmentMaterialKind.Organic,
    baseCollisionRadius: 7.1,
    blocksPlayer: true,
    minimumScale: 0.96,
    maximumScale: 1.06,
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
