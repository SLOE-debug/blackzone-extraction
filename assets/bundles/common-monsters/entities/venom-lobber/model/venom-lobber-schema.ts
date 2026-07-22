import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../../../core/entities/entity-schema';
import { type EntityTable } from '../../../../../core/entities/entity-table';
import {
  VENOM_LOBBER_LEG_COUNT,
  VENOM_LOBBER_LEG_JOINT_COMPONENT_COUNT,
} from './venom-lobber-leg-rig';

/** Venom Lobber 的固定 SoA 组件 Schema。 */
export const VENOM_LOBBER_SCHEMA = defineEntitySchema({
  identity: {
    id: entityField(Uint32Array, 1),
    randomState: entityField(Uint32Array, 1),
    appearanceSeed: entityField(Uint32Array, 1),
  },
  transform: {
    previousX: entityField(Float32Array, 1),
    previousY: entityField(Float32Array, 1),
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
    timeSinceHit: entityField(Float32Array, 1),
    deathEffectSpawned: entityField(Uint8Array, 1),
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
    attackLock: entityField(Float32Array, 1),
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
    rootForward: entityField(Float32Array, 1),
    rootElevation: entityField(Float32Array, 1),
    bodyCompression: entityField(Float32Array, 1),
    venomSacScale: entityField(Float32Array, 1),
    tailCurl: entityField(Float32Array, 1),
    cocoonOpen: entityField(Float32Array, 1),
    lifecycleLegProgress: entityField(Float32Array, 1),
    legPoseInitialized: entityField(Uint8Array, 1),
    footAnchorX: entityField(Float32Array, VENOM_LOBBER_LEG_COUNT),
    footAnchorY: entityField(Float32Array, VENOM_LOBBER_LEG_COUNT),
    swingStartX: entityField(Float32Array, VENOM_LOBBER_LEG_COUNT),
    swingStartY: entityField(Float32Array, VENOM_LOBBER_LEG_COUNT),
    swingTargetX: entityField(Float32Array, VENOM_LOBBER_LEG_COUNT),
    swingTargetY: entityField(Float32Array, VENOM_LOBBER_LEG_COUNT),
    legSwinging: entityField(Uint8Array, VENOM_LOBBER_LEG_COUNT),
    legJointX: entityField(Float32Array, VENOM_LOBBER_LEG_JOINT_COMPONENT_COUNT),
    legJointY: entityField(Float32Array, VENOM_LOBBER_LEG_JOINT_COMPONENT_COUNT),
    legJointZ: entityField(Float32Array, VENOM_LOBBER_LEG_JOINT_COMPONENT_COUNT),
  },
} as const);

export type VenomLobberData = EntityData<typeof VENOM_LOBBER_SCHEMA>;
export type VenomLobberTable = EntityTable<typeof VENOM_LOBBER_SCHEMA>;
