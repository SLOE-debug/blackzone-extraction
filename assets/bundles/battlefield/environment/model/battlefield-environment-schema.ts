import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../../core/entities/entity-schema';
import { type EntityTable } from '../../../../core/entities/entity-table';

/** 同一环境原型使用的固定容量 SoA Schema。 */
export const BATTLEFIELD_ENVIRONMENT_SCHEMA = defineEntitySchema({
  identity: {
    id: entityField(Uint32Array, 1),
    active: entityField(Uint8Array, 1),
    randomSeed: entityField(Uint32Array, 1),
  },
  transform: {
    x: entityField(Float32Array, 1),
    y: entityField(Float32Array, 1),
    z: entityField(Float32Array, 1),
    heading: entityField(Float32Array, 1),
    scale: entityField(Float32Array, 1),
  },
  appearance: {
    tintRed: entityField(Float32Array, 1),
    tintGreen: entityField(Float32Array, 1),
    tintBlue: entityField(Float32Array, 1),
  },
  collision: {
    radius: entityField(Float32Array, 1),
    blocksPlayer: entityField(Uint8Array, 1),
  },
  chunk: {
    x: entityField(Int32Array, 1),
    z: entityField(Int32Array, 1),
  },
} as const);

/** 环境 Archetype 的完整 SoA 数据类型。 */
export type BattlefieldEnvironmentData = EntityData<typeof BATTLEFIELD_ENVIRONMENT_SCHEMA>;

/** 环境 Archetype 的强类型实体表。 */
export type BattlefieldEnvironmentTable = EntityTable<typeof BATTLEFIELD_ENVIRONMENT_SCHEMA>;
