import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../../core/entities/entity-schema';
import { type EntityTable } from '../../../../core/entities/entity-table';

/** 单一携带槽位的战场操作状态 Schema。 */
export const BATTLEFIELD_MANIPULATION_SCHEMA = defineEntitySchema({
  reference: {
    active: entityField(Uint8Array, 1),
    populationId: entityField(Uint32Array, 1),
    entityId: entityField(Uint32Array, 1),
    tags: entityField(Uint32Array, 1),
  },
  carried: {
    active: entityField(Uint8Array, 1),
    carrierEntityId: entityField(Uint32Array, 1),
    offsetX: entityField(Float32Array, 1),
    offsetY: entityField(Float32Array, 1),
    offsetZ: entityField(Float32Array, 1),
    duration: entityField(Float32Array, 1),
    throwAllowed: entityField(Uint8Array, 1),
    x: entityField(Float32Array, 1),
    y: entityField(Float32Array, 1),
    z: entityField(Float32Array, 1),
  },
  carrying: {
    active: entityField(Uint8Array, 1),
    carriedPopulationId: entityField(Uint32Array, 1),
    carriedEntityId: entityField(Uint32Array, 1),
    actionPhase: entityField(Uint8Array, 1),
    skillContext: entityField(Uint8Array, 1),
  },
  throwable: {
    mass: entityField(Float32Array, 1),
    maximumDistance: entityField(Float32Array, 1),
    collisionRadius: entityField(Float32Array, 1),
    impactStrength: entityField(Float32Array, 1),
  },
  thrown: {
    active: entityField(Uint8Array, 1),
    startX: entityField(Float32Array, 1),
    startY: entityField(Float32Array, 1),
    startZ: entityField(Float32Array, 1),
    previousX: entityField(Float32Array, 1),
    previousY: entityField(Float32Array, 1),
    previousZ: entityField(Float32Array, 1),
    x: entityField(Float32Array, 1),
    y: entityField(Float32Array, 1),
    z: entityField(Float32Array, 1),
    directionX: entityField(Float32Array, 1),
    directionZ: entityField(Float32Array, 1),
    velocityX: entityField(Float32Array, 1),
    velocityY: entityField(Float32Array, 1),
    velocityZ: entityField(Float32Array, 1),
    throwerEntityId: entityField(Uint32Array, 1),
    traveledDistance: entityField(Float32Array, 1),
    maximumDistance: entityField(Float32Array, 1),
    duration: entityField(Float32Array, 1),
    elapsed: entityField(Float32Array, 1),
    arcHeight: entityField(Float32Array, 1),
  },
} as const);

export type BattlefieldManipulationData = EntityData<typeof BATTLEFIELD_MANIPULATION_SCHEMA>;
export type BattlefieldManipulationTable = EntityTable<typeof BATTLEFIELD_MANIPULATION_SCHEMA>;
