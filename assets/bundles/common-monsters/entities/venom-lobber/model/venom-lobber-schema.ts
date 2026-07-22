import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../../../core/entities/entity-schema';
import { type EntityTable } from '../../../../../core/entities/entity-table';

/** Venom Lobber 的固定 SoA 组件 Schema。 */
export const VENOM_LOBBER_SCHEMA = defineEntitySchema({
  identity: {
    id: entityField(Uint32Array, 1),
    randomState: entityField(Uint32Array, 1),
    appearanceSeed: entityField(Uint32Array, 1),
  },
  transform: {
    x: entityField(Float32Array, 1),
    y: entityField(Float32Array, 1),
    heading: entityField(Float32Array, 1),
    targetHeading: entityField(Float32Array, 1),
  },
  morphology: {
    scale: entityField(Float32Array, 1),
    cruiseSpeed: entityField(Float32Array, 1),
    arcHeight: entityField(Float32Array, 1),
    scatterRadius: entityField(Float32Array, 1),
  },
  vitality: {
    health: entityField(Float32Array, 1),
    state: entityField(Uint8Array, 1),
    stateTime: entityField(Float32Array, 1),
    hitTime: entityField(Float32Array, 1),
  },
  behavior: {
    action: entityField(Uint8Array, 1),
    actionTime: entityField(Float32Array, 1),
    nextTurnTime: entityField(Float32Array, 1),
  },
  combat: {
    engaged: entityField(Uint8Array, 1),
    castTime: entityField(Float32Array, 1),
    castCooldown: entityField(Float32Array, 1),
    projectileReleased: entityField(Uint8Array, 1),
    meleeTime: entityField(Float32Array, 1),
    meleeCooldown: entityField(Float32Array, 1),
    meleeHitApplied: entityField(Uint8Array, 1),
  },
  intent: {
    targetSpeed: entityField(Float32Array, 1),
    turnRate: entityField(Float32Array, 1),
  },
  motion: {
    currentSpeed: entityField(Float32Array, 1),
  },
  animation: {
    gaitPhase: entityField(Float32Array, 1),
    bodyBob: entityField(Float32Array, 1),
    tailCharge: entityField(Float32Array, 1),
    sacPulse: entityField(Float32Array, 1),
    hitFlash: entityField(Float32Array, 1),
  },
} as const);

export type VenomLobberData = EntityData<typeof VENOM_LOBBER_SCHEMA>;
export type VenomLobberTable = EntityTable<typeof VENOM_LOBBER_SCHEMA>;
