import { EntityTable } from '../../../../core/entities/entity-table';
import { type MutableBattlefieldManipulationCandidate } from '../../population/battlefield-monster-contracts';
import { BattlefieldCombatModuleId } from './battlefield-combat-module';
import {
  BATTLEFIELD_MANIPULATION_SCHEMA,
  type BattlefieldManipulationData,
  type BattlefieldManipulationTable,
} from './battlefield-manipulation-schema';

export const BATTLEFIELD_PLAYER_ENTITY_ID = 0;

/** 持有一个被携带/投掷目标的固定容量 SoA 状态。 */
export class BattlefieldManipulationState {
  public readonly table: BattlefieldManipulationTable;
  public readonly data: BattlefieldManipulationData;
  public readonly hitPopulationIds = new Uint32Array(8);
  public readonly hitEntityIds = new Uint32Array(8);
  public hitCount = 0;

  constructor() {
    this.table = new EntityTable(BATTLEFIELD_MANIPULATION_SCHEMA, 1);
    this.table.allocate();
    this.data = this.table.data;
    this.clear();
  }

  public get carrying(): boolean {
    return (this.data.carrying.active[0] ?? 0) !== 0;
  }

  public get flying(): boolean {
    return (this.data.thrown.active[0] ?? 0) !== 0;
  }

  /** 把选中的怪物能力复制到唯一携带槽位。 */
  public beginCarry(candidate: Readonly<MutableBattlefieldManipulationCandidate>): void {
    if (this.carrying || this.flying) {
      throw new Error('单一操作槽位已被占用，不能再次抓取。');
    }
    const { reference, carried, carrying, throwable } = this.data;
    reference.active[0] = 1;
    reference.populationId[0] = candidate.populationId;
    reference.entityId[0] = candidate.entityId;
    reference.tags[0] = candidate.tags;
    carried.active[0] = 1;
    carried.carrierEntityId[0] = BATTLEFIELD_PLAYER_ENTITY_ID;
    carried.offsetX[0] = 0;
    carried.offsetY[0] = 1.7;
    carried.offsetZ[0] = 1.05;
    carried.duration[0] = 0;
    carried.throwAllowed[0] = 1;
    carried.x[0] = candidate.x;
    carried.y[0] = candidate.y;
    carried.z[0] = candidate.z;
    carrying.active[0] = 1;
    carrying.carriedPopulationId[0] = candidate.populationId;
    carrying.carriedEntityId[0] = candidate.entityId;
    carrying.actionPhase[0] = 0;
    carrying.skillContext[0] = BattlefieldCombatModuleId.Grab;
    throwable.mass[0] = candidate.throwMass;
    throwable.maximumDistance[0] = candidate.maximumThrowDistance;
    throwable.collisionRadius[0] = candidate.collisionRadius;
    throwable.impactStrength[0] = candidate.impactStrength;
    this.hitCount = 0;
  }

  /** 从携带姿态开始一条确定的低弧线飞行。 */
  public beginThrow(
    directionX: number,
    directionZ: number,
    distance: number,
    duration: number,
    arcHeight: number,
  ): void {
    if (!this.carrying
      || ![directionX, directionZ, distance, duration, arcHeight].every(Number.isFinite)
      || Math.abs(Math.hypot(directionX, directionZ) - 1) > 0.001
      || distance <= 0
      || duration <= 0
      || arcHeight < 0) {
      throw new Error('投掷必须从有效携带状态和单位方向开始。');
    }
    const { carried, carrying, thrown } = this.data;
    const startX = carried.x[0] ?? 0;
    const startY = carried.y[0] ?? 0;
    const startZ = carried.z[0] ?? 0;
    carried.active[0] = 0;
    carrying.active[0] = 0;
    thrown.active[0] = 1;
    thrown.startX[0] = startX;
    thrown.startY[0] = startY;
    thrown.startZ[0] = startZ;
    thrown.previousX[0] = startX;
    thrown.previousY[0] = startY;
    thrown.previousZ[0] = startZ;
    thrown.x[0] = startX;
    thrown.y[0] = startY;
    thrown.z[0] = startZ;
    thrown.directionX[0] = directionX;
    thrown.directionZ[0] = directionZ;
    thrown.velocityX[0] = directionX * distance / duration;
    thrown.velocityY[0] = 0;
    thrown.velocityZ[0] = directionZ * distance / duration;
    thrown.throwerEntityId[0] = BATTLEFIELD_PLAYER_ENTITY_ID;
    thrown.traveledDistance[0] = 0;
    thrown.maximumDistance[0] = distance;
    thrown.duration[0] = duration;
    thrown.elapsed[0] = 0;
    thrown.arcHeight[0] = arcHeight;
    this.hitCount = 0;
  }

  public clear(): void {
    const { reference, carried, carrying, throwable, thrown } = this.data;
    reference.active[0] = 0;
    reference.populationId[0] = 0;
    reference.entityId[0] = 0;
    reference.tags[0] = 0;
    carried.active[0] = 0;
    carried.carrierEntityId[0] = 0;
    carried.offsetX[0] = 0;
    carried.offsetY[0] = 0;
    carried.offsetZ[0] = 0;
    carried.duration[0] = 0;
    carried.throwAllowed[0] = 0;
    carried.x[0] = 0;
    carried.y[0] = 0;
    carried.z[0] = 0;
    carrying.active[0] = 0;
    carrying.carriedPopulationId[0] = 0;
    carrying.carriedEntityId[0] = 0;
    carrying.actionPhase[0] = 0;
    carrying.skillContext[0] = 0;
    throwable.mass[0] = 0;
    throwable.maximumDistance[0] = 0;
    throwable.collisionRadius[0] = 0;
    throwable.impactStrength[0] = 0;
    thrown.active[0] = 0;
    thrown.startX[0] = 0;
    thrown.startY[0] = 0;
    thrown.startZ[0] = 0;
    thrown.previousX[0] = 0;
    thrown.previousY[0] = 0;
    thrown.previousZ[0] = 0;
    thrown.x[0] = 0;
    thrown.y[0] = 0;
    thrown.z[0] = 0;
    thrown.directionX[0] = 0;
    thrown.directionZ[0] = 0;
    thrown.velocityX[0] = 0;
    thrown.velocityY[0] = 0;
    thrown.velocityZ[0] = 0;
    thrown.throwerEntityId[0] = 0;
    thrown.traveledDistance[0] = 0;
    thrown.maximumDistance[0] = 0;
    thrown.duration[0] = 0;
    thrown.elapsed[0] = 0;
    thrown.arcHeight[0] = 0;
    this.hitPopulationIds.fill(0);
    this.hitEntityIds.fill(0);
    this.hitCount = 0;
  }
}
