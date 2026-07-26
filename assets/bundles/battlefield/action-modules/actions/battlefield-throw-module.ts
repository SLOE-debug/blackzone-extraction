import { type CombatTag } from '../../../../core/contracts/monster-manipulation';
import { type MutableSpatialPosition } from '../../../../core/contracts/spatial-movement-constraint';
import { BattlefieldCombatEventBuffer } from '../events/battlefield-combat-event-buffer';
import { BattlefieldCombatEventType } from '../events/battlefield-combat-event-type';
import {
  BattlefieldActionFailureReason,
  type BattlefieldActionFailureState,
} from '../model/battlefield-action-failure';
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
import { BATTLEFIELD_MONSTER_SPAWN } from '../../model/battlefield-monster-spawn';

const PLAYER_POPULATION_ID = 0xfffffffe;
const FULL_THROW_MINIMUM_DISTANCE = 3.2;
const MINIMUM_EXECUTABLE_THROW_DISTANCE = 0.35;
const THROW_SPEED = 17;
const LANDING_STEPS = 12;
const LANDING_REFINEMENT_COUNT = 3;
const OBSTACLE_TOLERANCE = 0.08;

/** 只依赖 Carrying/Throwable 标准状态的投掷预览与执行模块。 */
export class BattlefieldThrowModule {
  private readonly resolved: MutableSpatialPosition = { x: 0, y: 0, z: 0 };
  private blockedProgress = 1;
  private aiming = false;

  constructor(
    private readonly state: BattlefieldManipulationState,
    private readonly monsters: BattlefieldActionMonsterGateway,
    private readonly movement: BattlefieldThrowMovementConstraint,
    private readonly events: BattlefieldCombatEventBuffer,
    private readonly diagnostics: BattlefieldActionFailureState,
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
    const desiredDistance = amplitude <= 0
      ? 0
      : FULL_THROW_MINIMUM_DISTANCE
        + (maximumDistance - FULL_THROW_MINIMUM_DISTANCE) * amplitude;
    const distance = this.writeLanding(
      this.state.data.carried.x[0] ?? player.x,
      this.state.data.carried.y[0] ?? player.y,
      this.state.data.carried.z[0] ?? player.z,
      intent.directionX,
      intent.directionZ,
      desiredDistance,
      this.state.data.throwable.collisionRadius[0] ?? 0.5,
    );
    const valid = distance >= MINIMUM_EXECUTABLE_THROW_DISTANCE;
    this.writePreview(intent.active || intent.released, distance, desiredDistance, valid, preview);
    if (!intent.released) {
      return;
    }
    if (!valid) {
      this.diagnostics.fail(amplitude <= 0
        ? BattlefieldActionFailureReason.InputBelowDeadZone
        : BattlefieldActionFailureReason.ThrowPathBlocked);
      return;
    }
    const populationId = this.state.data.reference.populationId[0] ?? 0;
    const entityId = this.state.data.reference.entityId[0] ?? 0;
    if (!this.monsters.beginThrow(populationId, entityId)) {
      this.diagnostics.fail(BattlefieldActionFailureReason.BeginThrowRejected);
      return;
    }
    const duration = Math.max(0.24, distance / THROW_SPEED);
    const arcHeight = calculateThrowArcHeight(distance);
    this.state.beginThrow(
      intent.directionX,
      intent.directionZ,
      distance,
      duration,
      arcHeight,
    );
    this.diagnostics.clear();
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
    startY: number,
    startZ: number,
    directionX: number,
    directionZ: number,
    desiredDistance: number,
    radius: number,
  ): number {
    if (desiredDistance <= 0) {
      this.resolved.x = startX;
      this.resolved.y = startY;
      this.resolved.z = startZ;
      return 0;
    }
    let candidateDistance = desiredDistance;
    for (let refinement = 0; refinement <= LANDING_REFINEMENT_COUNT; refinement++) {
      if (this.isTrajectoryClear(
        startX,
        startY,
        startZ,
        directionX,
        directionZ,
        candidateDistance,
        radius,
      )) {
        return candidateDistance;
      }
      candidateDistance *= this.blockedProgress;
      if (candidateDistance <= 0.000001) {
        break;
      }
    }
    this.resolved.x = startX;
    this.resolved.y = startY;
    this.resolved.z = startZ;
    return 0;
  }

  /** 对一个候选落点重新采样完整三维弧线，避免缩短后沿用旧弧线高度。 */
  private isTrajectoryClear(
    startX: number,
    startY: number,
    startZ: number,
    directionX: number,
    directionZ: number,
    distance: number,
    radius: number,
  ): boolean {
    const groundY = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY;
    const arcHeight = calculateThrowArcHeight(distance);
    let previousX = startX;
    let previousY = startY;
    let previousZ = startZ;
    for (let step = 1; step <= LANDING_STEPS; step++) {
      const progress = step / LANDING_STEPS;
      const targetX = startX + directionX * distance * progress;
      const targetZ = startZ + directionZ * distance * progress;
      const linearY = startY * (1 - progress) + groundY * progress;
      const targetY = linearY + arcHeight * 4 * progress * (1 - progress);
      this.movement.resolveSpatial(
        previousX,
        previousY,
        previousZ,
        targetX,
        targetY,
        targetZ,
        radius,
        this.resolved,
      );
      if (Math.hypot(
        this.resolved.x - targetX,
        this.resolved.y - targetY,
        this.resolved.z - targetZ,
      )
        > OBSTACLE_TOLERANCE) {
        const resolvedForwardDistance = (this.resolved.x - startX) * directionX
          + (this.resolved.z - startZ) * directionZ;
        this.blockedProgress = Math.max(
          (step - 1) / LANDING_STEPS,
          clamp01(resolvedForwardDistance / Math.max(distance, 0.000001)),
        );
        return false;
      }
      previousX = targetX;
      previousY = targetY;
      previousZ = targetZ;
    }
    this.blockedProgress = 1;
    return true;
  }

  private writePreview(
    active: boolean,
    distance: number,
    desiredDistance: number,
    valid: boolean,
    preview: MutableBattlefieldActionPreview,
  ): void {
    if (!active) {
      return;
    }
    const carried = this.state.data.carried;
    preview.type = BattlefieldActionPreviewType.Throw;
    preview.active = true;
    preview.valid = valid;
    preview.blocked = distance + 0.01 < desiredDistance;
    preview.startX = carried.x[0] ?? 0;
    preview.startY = carried.y[0] ?? 0;
    preview.startZ = carried.z[0] ?? 0;
    preview.endX = this.resolved.x;
    preview.endY = this.resolved.y;
    preview.endZ = this.resolved.z;
    preview.targetX = preview.endX;
    preview.targetY = preview.endY;
    preview.targetZ = preview.endZ;
    preview.impactRadius = this.state.data.throwable.collisionRadius[0] ?? 0;
    preview.arcHeight = calculateThrowArcHeight(distance);
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

function calculateThrowArcHeight(distance: number): number {
  return Math.min(3.2, 1.1 + distance * 0.11);
}
