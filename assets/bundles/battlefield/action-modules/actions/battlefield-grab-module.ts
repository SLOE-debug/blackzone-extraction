import {
  CombatTag,
  MonsterBodySize,
} from '../../../../core/contracts/monster-manipulation';
import { BattlefieldCombatEventBuffer } from '../events/battlefield-combat-event-buffer';
import { BattlefieldCombatEventType } from '../events/battlefield-combat-event-type';
import {
  BattlefieldActionPreviewType,
  type MutableBattlefieldActionPreview,
} from '../model/battlefield-action-preview';
import { type BattlefieldActionMonsterGateway } from '../model/battlefield-action-runtime-contracts';
import { BattlefieldCombatModuleId } from '../model/battlefield-combat-module';
import {
  type BattlefieldActionPlayerPose,
  type BattlefieldCombatModuleIntent,
} from '../model/battlefield-combat-module-intent';
import { BattlefieldManipulationState } from '../model/battlefield-manipulation-state';
import { type BattlefieldThrowMovementConstraint } from '../model/battlefield-action-runtime-contracts';
import { type MutablePlanarPosition } from '../../../../core/contracts/planar-movement-constraint';
import {
  type BattlefieldGrabTargetQuery,
  type MutableBattlefieldManipulationCandidate,
} from '../../population/battlefield-monster-contracts';

const PLAYER_POPULATION_ID = 0xfffffffe;
const GRAB_MAXIMUM_DISTANCE = 3.8;
const GRAB_LATERAL_DISTANCE = 1.35;
const GRAB_MINIMUM_ALIGNMENT = Math.cos(Math.PI * 0.23);
const GRAB_LINE_OF_SIGHT_STEPS = 8;

interface MutableGrabQuery extends BattlefieldGrabTargetQuery {
  originX: number;
  originZ: number;
  directionX: number;
  directionZ: number;
}

/** 只负责抓取目标预览、验证、携带状态写入和标准事件。 */
export class BattlefieldGrabModule {
  private readonly query: MutableGrabQuery = {
    originX: 0,
    originZ: 0,
    directionX: 0,
    directionZ: 1,
    maximumDistance: GRAB_MAXIMUM_DISTANCE,
    maximumLateralDistance: GRAB_LATERAL_DISTANCE,
    minimumDirectionAlignment: GRAB_MINIMUM_ALIGNMENT,
  };
  private readonly candidate: MutableBattlefieldManipulationCandidate = {
    populationId: 0,
    entityId: -1,
    x: 0,
    y: 0,
    z: 0,
    healthRatio: 1,
    bodySize: MonsterBodySize.Small,
    grabResistance: 0,
    playerGrabbable: false,
    tags: CombatTag.None,
    throwMass: 0,
    maximumThrowDistance: 0,
    collisionRadius: 0,
    impactStrength: 0,
  };
  private observedPopulationId = -1;
  private observedEntityId = -1;
  private readonly resolved: MutablePlanarPosition = { x: 0, z: 0 };

  constructor(
    private readonly state: BattlefieldManipulationState,
    private readonly monsters: BattlefieldActionMonsterGateway,
    private readonly movement: BattlefieldThrowMovementConstraint,
    private readonly events: BattlefieldCombatEventBuffer,
  ) {}

  /** 消费本帧抓取意图；此模块从不引用投掷模块。 */
  public execute(
    intent: Readonly<BattlefieldCombatModuleIntent>,
    player: Readonly<BattlefieldActionPlayerPose>,
    preview: MutableBattlefieldActionPreview,
  ): void {
    const evaluating = intent.active || intent.released;
    if (!evaluating || this.state.carrying || this.state.flying || !player.alive) {
      this.clearObservedTarget();
      return;
    }
    const query = this.query;
    query.originX = player.x;
    query.originZ = player.z;
    query.directionX = intent.directionX;
    query.directionZ = intent.directionZ;
    const found = this.monsters.findGrabbable(query, this.candidate)
      && this.isPathClear(player.x, player.z, this.candidate.x, this.candidate.z);
    this.writePreview(intent.active, player, found, preview);
    if (found) {
      this.emitBecameGrabbableIfNeeded();
    } else {
      this.clearObservedTarget();
    }
    if (!intent.released) {
      return;
    }
    if (!found) {
      this.emit(BattlefieldCombatEventType.GrabCancelled, player, this.candidate);
      return;
    }
    this.emit(BattlefieldCombatEventType.GrabStarted, player, this.candidate);
    if (!this.monsters.beginCarry(this.candidate.populationId, this.candidate.entityId)) {
      this.emit(BattlefieldCombatEventType.GrabCancelled, player, this.candidate);
      return;
    }
    this.state.beginCarry(this.candidate);
    this.emit(BattlefieldCombatEventType.EntityGrabbed, player, this.candidate);
  }

  private writePreview(
    active: boolean,
    player: Readonly<BattlefieldActionPlayerPose>,
    found: boolean,
    preview: MutableBattlefieldActionPreview,
  ): void {
    if (!active) {
      return;
    }
    preview.type = BattlefieldActionPreviewType.Grab;
    preview.active = true;
    preview.valid = found;
    preview.blocked = false;
    preview.startX = player.x;
    preview.startY = player.y + 0.8;
    preview.startZ = player.z;
    preview.endX = player.x + this.query.directionX * GRAB_MAXIMUM_DISTANCE;
    preview.endY = player.y + 0.8;
    preview.endZ = player.z + this.query.directionZ * GRAB_MAXIMUM_DISTANCE;
    preview.targetX = found ? this.candidate.x : preview.endX;
    preview.targetY = found ? this.candidate.y + 0.8 : preview.endY;
    preview.targetZ = found ? this.candidate.z : preview.endZ;
    preview.impactRadius = found ? this.candidate.collisionRadius : 0;
    preview.arcHeight = 0;
  }

  private emitBecameGrabbableIfNeeded(): void {
    if (this.observedPopulationId === this.candidate.populationId
      && this.observedEntityId === this.candidate.entityId) {
      return;
    }
    this.observedPopulationId = this.candidate.populationId;
    this.observedEntityId = this.candidate.entityId;
    this.events.appendRoot(
      BattlefieldCombatEventType.EntityBecameGrabbable,
      this.candidate.populationId,
      this.candidate.entityId,
      this.candidate.populationId,
      this.candidate.entityId,
      BattlefieldCombatModuleId.Grab,
      this.candidate.x,
      this.candidate.y,
      this.candidate.z,
      0,
      0,
      0,
      0,
      this.candidate.tags,
    );
  }

  private emit(
    type: BattlefieldCombatEventType,
    player: Readonly<BattlefieldActionPlayerPose>,
    target: Readonly<MutableBattlefieldManipulationCandidate>,
  ): void {
    this.events.appendRoot(
      type,
      PLAYER_POPULATION_ID,
      0,
      target.populationId,
      Math.max(0, target.entityId),
      BattlefieldCombatModuleId.Grab,
      target.x,
      target.y,
      target.z,
      this.query.directionX,
      0,
      this.query.directionZ,
      Math.hypot(target.x - player.x, target.z - player.z),
      target.tags,
    );
  }

  private clearObservedTarget(): void {
    this.observedPopulationId = -1;
    this.observedEntityId = -1;
  }

  private isPathClear(startX: number, startZ: number, endX: number, endZ: number): boolean {
    let previousX = startX;
    let previousZ = startZ;
    for (let step = 1; step <= GRAB_LINE_OF_SIGHT_STEPS; step++) {
      const progress = step / GRAB_LINE_OF_SIGHT_STEPS;
      const targetX = startX + (endX - startX) * progress;
      const targetZ = startZ + (endZ - startZ) * progress;
      this.movement.resolve(previousX, previousZ, targetX, targetZ, 0.18, this.resolved);
      if (Math.hypot(this.resolved.x - targetX, this.resolved.z - targetZ) > 0.05) {
        return false;
      }
      previousX = targetX;
      previousZ = targetZ;
    }
    return true;
  }
}
