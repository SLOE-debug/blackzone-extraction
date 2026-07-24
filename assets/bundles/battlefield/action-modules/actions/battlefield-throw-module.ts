import { type MutablePlanarPosition } from '../../../../core/contracts/planar-movement-constraint';
import { type CombatTag } from '../../../../core/contracts/monster-manipulation';
import { BattlefieldCombatEventBuffer } from '../events/battlefield-combat-event-buffer';
import { BattlefieldCombatEventType } from '../events/battlefield-combat-event-type';
import {
  BattlefieldActionPreviewType,
  type MutableBattlefieldActionPreview,
} from '../model/battlefield-action-preview';
import {
  type BattlefieldActionMonsterGateway,
  type BattlefieldThrowMovementConstraint,
} from '../model/battlefield-action-runtime-contracts';
import { BattlefieldCombatModuleId } from '../model/battlefield-combat-module';
import {
  type BattlefieldActionPlayerPose,
  type BattlefieldCombatModuleIntent,
} from '../model/battlefield-combat-module-intent';
import { BattlefieldManipulationState } from '../model/battlefield-manipulation-state';

const PLAYER_POPULATION_ID = 0xfffffffe;
const MINIMUM_INPUT_AMPLITUDE = 0.12;
const MINIMUM_THROW_DISTANCE = 3.2;
const THROW_SPEED = 17;
const LANDING_STEPS = 12;
const OBSTACLE_TOLERANCE = 0.08;

/** 只依赖 Carrying/Throwable 标准状态的投掷预览与执行模块。 */
export class BattlefieldThrowModule {
  private readonly resolved: MutablePlanarPosition = { x: 0, z: 0 };
  private aiming = false;

  constructor(
    private readonly state: BattlefieldManipulationState,
    private readonly monsters: BattlefieldActionMonsterGateway,
    private readonly movement: BattlefieldThrowMovementConstraint,
    private readonly events: BattlefieldCombatEventBuffer,
  ) {}

  public execute(
    intent: Readonly<BattlefieldCombatModuleIntent>,
    player: Readonly<BattlefieldActionPlayerPose>,
    preview: MutableBattlefieldActionPreview,
  ): void {
    if (!this.state.carrying || !player.alive) {
      this.aiming = false;
      return;
    }
    if (intent.active && !this.aiming) {
      this.emitAimingStarted(player, intent);
    }
    this.aiming = intent.active;
    if (!intent.active && !intent.released) {
      return;
    }
    const amplitude = clamp01(intent.amplitude);
    const maximumDistance = this.state.data.throwable.maximumDistance[0] ?? 0;
    const desiredDistance = amplitude < MINIMUM_INPUT_AMPLITUDE
      ? 0
      : MINIMUM_THROW_DISTANCE
        + (maximumDistance - MINIMUM_THROW_DISTANCE) * amplitude;
    const distance = this.writeLanding(
      this.state.data.carried.x[0] ?? player.x,
      this.state.data.carried.z[0] ?? player.z,
      intent.directionX,
      intent.directionZ,
      desiredDistance,
      this.state.data.throwable.collisionRadius[0] ?? 0.5,
    );
    const valid = distance >= MINIMUM_THROW_DISTANCE;
    this.writePreview(intent.active, intent, distance, valid, preview);
    if (!intent.released || !valid) {
      return;
    }
    const populationId = this.state.data.reference.populationId[0] ?? 0;
    const entityId = this.state.data.reference.entityId[0] ?? 0;
    if (!this.monsters.beginThrow(populationId, entityId)) {
      return;
    }
    const duration = Math.max(0.24, distance / THROW_SPEED);
    const arcHeight = Math.min(3.2, 1.1 + distance * 0.11);
    this.state.beginThrow(
      intent.directionX,
      intent.directionZ,
      distance,
      duration,
      arcHeight,
    );
    this.events.appendRoot(
      BattlefieldCombatEventType.EntityThrown,
      PLAYER_POPULATION_ID,
      0,
      populationId,
      entityId,
      BattlefieldCombatModuleId.Throw,
      this.state.data.thrown.startX[0] ?? player.x,
      this.state.data.thrown.startY[0] ?? player.y,
      this.state.data.thrown.startZ[0] ?? player.z,
      intent.directionX,
      0,
      intent.directionZ,
      distance,
      (this.state.data.reference.tags[0] ?? 0) as CombatTag,
    );
    this.aiming = false;
  }

  private writeLanding(
    startX: number,
    startZ: number,
    directionX: number,
    directionZ: number,
    desiredDistance: number,
    radius: number,
  ): number {
    if (desiredDistance <= 0) {
      this.resolved.x = startX;
      this.resolved.z = startZ;
      return 0;
    }
    let lastX = startX;
    let lastZ = startZ;
    let acceptedDistance = 0;
    for (let step = 1; step <= LANDING_STEPS; step++) {
      const distance = desiredDistance * step / LANDING_STEPS;
      const targetX = startX + directionX * distance;
      const targetZ = startZ + directionZ * distance;
      this.movement.resolve(lastX, lastZ, targetX, targetZ, radius, this.resolved);
      if (Math.hypot(this.resolved.x - targetX, this.resolved.z - targetZ)
        > OBSTACLE_TOLERANCE) {
        break;
      }
      lastX = targetX;
      lastZ = targetZ;
      acceptedDistance = distance;
    }
    this.resolved.x = lastX;
    this.resolved.z = lastZ;
    return acceptedDistance;
  }

  private writePreview(
    active: boolean,
    intent: Readonly<BattlefieldCombatModuleIntent>,
    distance: number,
    valid: boolean,
    preview: MutableBattlefieldActionPreview,
  ): void {
    if (!active) {
      return;
    }
    const carried = this.state.data.carried;
    const maximumDistance = this.state.data.throwable.maximumDistance[0] ?? 0;
    preview.type = BattlefieldActionPreviewType.Throw;
    preview.active = true;
    preview.valid = valid;
    preview.blocked = valid && distance + 0.01 < maximumDistance * clamp01(intent.amplitude);
    preview.startX = carried.x[0] ?? 0;
    preview.startY = carried.y[0] ?? 0;
    preview.startZ = carried.z[0] ?? 0;
    preview.endX = this.resolved.x;
    preview.endY = 0.05;
    preview.endZ = this.resolved.z;
    preview.targetX = preview.endX;
    preview.targetY = preview.endY;
    preview.targetZ = preview.endZ;
    preview.impactRadius = this.state.data.throwable.collisionRadius[0] ?? 0;
    preview.arcHeight = Math.min(3.2, 1.1 + distance * 0.11);
  }

  private emitAimingStarted(
    player: Readonly<BattlefieldActionPlayerPose>,
    intent: Readonly<BattlefieldCombatModuleIntent>,
  ): void {
    this.events.appendRoot(
      BattlefieldCombatEventType.ThrowAimingStarted,
      PLAYER_POPULATION_ID,
      0,
      this.state.data.reference.populationId[0] ?? 0,
      this.state.data.reference.entityId[0] ?? 0,
      BattlefieldCombatModuleId.Throw,
      player.x,
      player.y,
      player.z,
      intent.directionX,
      0,
      intent.directionZ,
      0,
      (this.state.data.reference.tags[0] ?? 0) as CombatTag,
    );
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
