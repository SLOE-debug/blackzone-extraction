import { type BattlefieldEnvironmentMeshPlan } from '../geometry/battlefield-environment-mesh-plan';
import {
  createCorruptedPoolMeshPlan,
  createCrystalClusterMeshPlan,
  createRockFormationMeshPlan,
} from '../geometry/recipes/mineral-environment-recipes';
import {
  createDeadTreeMeshPlan,
  createGlowPlantMeshPlan,
  createLuminousMushroomMeshPlan,
} from '../geometry/recipes/organic-environment-recipes';
import {
  createRitualAltarMeshPlan,
  createVehicleWreckMeshPlan,
} from '../geometry/recipes/ruin-environment-recipes';

/** Catalog 定义在冻结前必须满足的完整字段形状。 */
interface BattlefieldEnvironmentPrototypeDefinitionShape {
  readonly key: string;
  readonly prototype: string;
  readonly capacity: number;
  readonly baseCollisionRadius: number;
  readonly blocksPlayer: boolean;
  readonly minimumScale: number;
  readonly maximumScale: number;
  readonly compilePlan: () => BattlefieldEnvironmentMeshPlan;
}

/**
 * 环境原型的唯一有序 Catalog。
 *
 * 稳定 ID、类型化键、容量、碰撞、缩放和编译入口均由此元组派生，调用方不得另建清单。
 */
export const BATTLEFIELD_ENVIRONMENT_CATALOG = defineEnvironmentCatalog([
  {
    key: 'DeadTree',
    prototype: 'dead-tree',
    capacity: 192,
    baseCollisionRadius: 0.58,
    blocksPlayer: true,
    minimumScale: 0.78,
    maximumScale: 1.28,
    compilePlan: createDeadTreeMeshPlan,
  },
  {
    key: 'LuminousMushroom',
    prototype: 'luminous-mushroom',
    capacity: 160,
    baseCollisionRadius: 0,
    blocksPlayer: false,
    minimumScale: 0.72,
    maximumScale: 1.18,
    compilePlan: createLuminousMushroomMeshPlan,
  },
  {
    key: 'CrystalCluster',
    prototype: 'crystal-cluster',
    capacity: 64,
    baseCollisionRadius: 0.92,
    blocksPlayer: true,
    minimumScale: 0.78,
    maximumScale: 1.18,
    compilePlan: createCrystalClusterMeshPlan,
  },
  {
    key: 'RockFormation',
    prototype: 'rock-formation',
    capacity: 96,
    baseCollisionRadius: 1.08,
    blocksPlayer: true,
    minimumScale: 0.78,
    maximumScale: 1.35,
    compilePlan: createRockFormationMeshPlan,
  },
  {
    key: 'VehicleWreck',
    prototype: 'vehicle-wreck',
    capacity: 16,
    baseCollisionRadius: 2.45,
    blocksPlayer: true,
    minimumScale: 0.88,
    maximumScale: 1.08,
    compilePlan: createVehicleWreckMeshPlan,
  },
  {
    key: 'GlowPlant',
    prototype: 'glow-plant',
    capacity: 192,
    baseCollisionRadius: 0,
    blocksPlayer: false,
    minimumScale: 0.7,
    maximumScale: 1.22,
    compilePlan: createGlowPlantMeshPlan,
  },
  {
    key: 'CorruptedPool',
    prototype: 'corrupted-pool',
    capacity: 32,
    baseCollisionRadius: 0,
    blocksPlayer: false,
    minimumScale: 0.72,
    maximumScale: 1.18,
    compilePlan: createCorruptedPoolMeshPlan,
  },
  {
    key: 'RitualAltar',
    prototype: 'ritual-altar',
    capacity: 12,
    baseCollisionRadius: 1.85,
    blocksPlayer: true,
    minimumScale: 0.9,
    maximumScale: 1.12,
    compilePlan: createRitualAltarMeshPlan,
  },
] as const satisfies readonly BattlefieldEnvironmentPrototypeDefinitionShape[]);

/** 唯一 Catalog 派生的稳定原型 ID 联合。 */
export type BattlefieldEnvironmentPrototype =
  typeof BATTLEFIELD_ENVIRONMENT_CATALOG[number]['prototype'];

/** 唯一 Catalog 中任一原型的精确只读定义。 */
export type BattlefieldEnvironmentPrototypeDefinition =
  typeof BATTLEFIELD_ENVIRONMENT_CATALOG[number];

/** 从 Catalog 自动派生的具名强类型原型键。 */
export const BattlefieldEnvironmentPrototype = createPrototypeKeys(
  BATTLEFIELD_ENVIRONMENT_CATALOG,
);

const DEFINITION_BY_PROTOTYPE = new Map<
  BattlefieldEnvironmentPrototype,
  BattlefieldEnvironmentPrototypeDefinition
>(BATTLEFIELD_ENVIRONMENT_CATALOG.map(
  (definition) => [definition.prototype, definition] as const,
));

/** 按稳定原型 ID 读取唯一 Catalog 定义。 */
export function getBattlefieldEnvironmentDefinition(
  prototype: BattlefieldEnvironmentPrototype,
): BattlefieldEnvironmentPrototypeDefinition {
  const definition = DEFINITION_BY_PROTOTYPE.get(prototype);
  if (definition === undefined) {
    throw new Error(`环境原型 Catalog 不存在：${prototype}。`);
  }
  return definition;
}

/** 冻结定义并验证稳定键、ID 与配置的完整性。 */
function defineEnvironmentCatalog<
  const TCatalog extends readonly BattlefieldEnvironmentPrototypeDefinitionShape[],
>(catalog: TCatalog): TCatalog {
  if (catalog.length === 0) {
    throw new Error('环境原型 Catalog 不能为空。');
  }

  const keys = new Set<string>();
  const prototypes = new Set<string>();
  const frozen = catalog.map((definition) => {
    if (keys.has(definition.key) || prototypes.has(definition.prototype)) {
      throw new Error(`环境原型 Catalog 包含重复键或 ID：${definition.prototype}。`);
    }
    keys.add(definition.key);
    prototypes.add(definition.prototype);
    if (!Number.isInteger(definition.capacity) || definition.capacity <= 0) {
      throw new Error(`环境原型容量无效：${definition.prototype}。`);
    }
    if (definition.minimumScale <= 0
      || definition.maximumScale < definition.minimumScale
      || definition.baseCollisionRadius < 0) {
      throw new Error(`环境原型生成或碰撞参数无效：${definition.prototype}。`);
    }
    return Object.freeze({ ...definition });
  });
  return Object.freeze(frozen) as unknown as TCatalog;
}

/** 将 Catalog 的 key/id 对自动转换为只读具名键对象。 */
function createPrototypeKeys<
  const TCatalog extends readonly BattlefieldEnvironmentPrototypeDefinitionShape[],
>(catalog: TCatalog): Readonly<{
  [TDefinition in TCatalog[number] as TDefinition['key']]: TDefinition['prototype'];
}> {
  const keys: Record<string, string> = {};
  for (const definition of catalog) {
    keys[definition.key] = definition.prototype;
  }
  return Object.freeze(keys) as Readonly<{
    [TDefinition in TCatalog[number] as TDefinition['key']]: TDefinition['prototype'];
  }>;
}
