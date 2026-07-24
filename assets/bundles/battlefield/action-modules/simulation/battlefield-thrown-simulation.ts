import { CombatTag } from '../../../../core/contracts/monster-manipulation';
import { MutableBattlefieldProjectileStatistics } from '../../equipment/projectile/model/battlefield-projectile-statistics';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../model/battlefield-monster-spawn';
import {
  type BattlefieldProjectileSweepQuery,
  type MutableBattlefieldProjectileHit,
} from '../../population/battlefield-monster-contracts';
import { BattlefieldCombatEventBuffer } from '../events/battlefield-combat-event-buffer';
import { BattlefieldCombatEventType } from '../events/battlefield-combat-event-type';
import { type BattlefieldActionMonsterGateway } from '../model/battlefield-action-runtime-contracts';
import { BattlefieldCombatModuleId } from '../model/battlefield-combat-module';
import { type BattlefieldManipulationState } from '../model/battlefield-manipulation-state';

const GROUND_POPULATION_ID = 0xfffffffd;
const HEAVY_IMPACT_THRESHOLD = 14;
const IMPACT_DAMAGE_SCALE = 0.72;
const MINIMUM_SIMULATION_DELTA = 1 / 240;
const MAXIMUM_SIMULATION_DELTA = 0.05;

interface MutableProjectileSweep extends BattlefieldProjectileSweepQuery {
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  impactRadius: number;
}

/** 独立推进被投掷怪物的低弧线、扫掠碰撞和撞击事件链。 */
export class BattlefieldThrownSimulation {
  private readonly sweep: MutableProjectileSweep = {
    startX: 0,
    startY: 0,
    startZ: 0,
    endX: 0,
    endY: 0,
    endZ: 0,
    impactRadius: 0,
  };
  private readonly hit: MutableBattlefieldProjectileHit = {
    populationId: 0,
    entityId: -1,
    x: 0,
    y: 0,
    z: 0,
    segmentProgress: 0,
  };
  private readonly collisionStatistics = new MutableBattlefieldProjectileStatistics();

  constructor(
    private readonly state: BattlefieldManipulationState,
    private readonly monsters: BattlefieldActionMonsterGateway,
    private readonly events: BattlefieldCombatEventBuffer,
  ) {}

  /** 推进低弧线并同步怪物权威姿态。 */
  public update(deltaTime: number): void {
    if (!this.state.flying) {
      return;
    }
    const safeDeltaTime = Math.max(
      MINIMUM_SIMULATION_DELTA,
      Math.min(deltaTime, MAXIMUM_SIMULATION_DELTA),
    );
    const thrown = this.state.data.thrown;
    const previousX = thrown.x[0] ?? 0;
    const previousY = thrown.y[0] ?? 0;
    const previousZ = thrown.z[0] ?? 0;
    const duration = thrown.duration[0] ?? 1;
    const elapsed = Math.min(duration, (thrown.elapsed[0] ?? 0) + safeDeltaTime);
    const progress = elapsed / duration;
    const distance = thrown.maximumDistance[0] ?? 0;
    const x = (thrown.startX[0] ?? 0) + (thrown.directionX[0] ?? 0) * distance * progress;
    const z = (thrown.startZ[0] ?? 0) + (thrown.directionZ[0] ?? 0) * distance * progress;
    const groundY = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY;
    const linearY = (thrown.startY[0] ?? groundY) * (1 - progress) + groundY * progress;
    const y = linearY + (thrown.arcHeight[0] ?? 0) * 4 * progress * (1 - progress);
    thrown.previousX[0] = previousX;
    thrown.previousY[0] = previousY;
    thrown.previousZ[0] = previousZ;
    thrown.x[0] = x;
    thrown.y[0] = y;
    thrown.z[0] = z;
    thrown.velocityX[0] = (x - previousX) / safeDeltaTime;
    thrown.velocityY[0] = (y - previousY) / safeDeltaTime;
    thrown.velocityZ[0] = (z - previousZ) / safeDeltaTime;
    thrown.traveledDistance[0] = distance * progress;
    thrown.elapsed[0] = elapsed;
    const heading = Math.atan2(thrown.directionX[0] ?? 0, thrown.directionZ[0] ?? 1);
    if (!this.monsters.synchronizeManipulatedPose(
      this.state.data.reference.populationId[0] ?? 0,
      this.state.data.reference.entityId[0] ?? 0,
      x,
      y,
      z,
      heading,
    )) {
      this.state.clear();
    }
  }

  /** 使用已重建的怪物空间索引解析怪物或地面首次撞击。 */
  public resolveCollision(): void {
    if (!this.state.flying) {
      return;
    }
    const thrown = this.state.data.thrown;
    const sweep = this.sweep;
    sweep.startX = thrown.previousX[0] ?? 0;
    sweep.startY = thrown.previousY[0] ?? 0;
    sweep.startZ = thrown.previousZ[0] ?? 0;
    sweep.endX = thrown.x[0] ?? 0;
    sweep.endY = thrown.y[0] ?? 0;
    sweep.endZ = thrown.z[0] ?? 0;
    sweep.impactRadius = this.state.data.throwable.collisionRadius[0] ?? 0;
    this.collisionStatistics.reset();
    const moved = Math.hypot(
      sweep.endX - sweep.startX,
      sweep.endY - sweep.startY,
      sweep.endZ - sweep.startZ,
    ) > 0.000001;
    if (moved && this.monsters.findFirstProjectileHit(
      sweep,
      this.state.hitPopulationIds,
      this.state.hitEntityIds,
      0,
      this.state.hitCount,
      this.hit,
      this.collisionStatistics,
    )) {
      this.resolveEntityImpact();
      return;
    }
    if ((thrown.elapsed[0] ?? 0) >= (thrown.duration[0] ?? 1)) {
      this.resolveGroundImpact();
    }
  }

  private resolveEntityImpact(): void {
    const intensity = this.calculateImpactIntensity();
    const reference = this.state.data.reference;
    const thrown = this.state.data.thrown;
    this.monsters.synchronizeManipulatedPose(
      reference.populationId[0] ?? 0,
      reference.entityId[0] ?? 0,
      this.hit.x,
      this.hit.y,
      this.hit.z,
      Math.atan2(thrown.directionX[0] ?? 0, thrown.directionZ[0] ?? 1),
    );
    const collisionEvent = this.events.appendRoot(
      BattlefieldCombatEventType.EntityCollision,
      reference.populationId[0] ?? 0,
      reference.entityId[0] ?? 0,
      this.hit.populationId,
      this.hit.entityId,
      BattlefieldCombatModuleId.Throw,
      this.hit.x,
      this.hit.y,
      this.hit.z,
      thrown.directionX[0] ?? 0,
      0,
      thrown.directionZ[0] ?? 0,
      intensity,
      (reference.tags[0] ?? 0) as CombatTag,
    );
    this.monsters.damageMonster(
      this.hit.populationId,
      this.hit.entityId,
      Math.max(1, intensity * IMPACT_DAMAGE_SCALE),
    );
    const knockbackDistance = Math.min(1.4, intensity * 0.035);
    this.monsters.knockbackMonster(
      this.hit.populationId,
      this.hit.entityId,
      (thrown.directionX[0] ?? 0) * knockbackDistance,
      (thrown.directionZ[0] ?? 0) * knockbackDistance,
    );
    const impactEvent = collisionEvent >= 0
      ? this.events.appendChild(
        collisionEvent,
        BattlefieldCombatEventType.EntityImpact,
        reference.populationId[0] ?? 0,
        reference.entityId[0] ?? 0,
        this.hit.populationId,
        this.hit.entityId,
        BattlefieldCombatModuleId.Throw,
        this.hit.x,
        this.hit.y,
        this.hit.z,
        thrown.directionX[0] ?? 0,
        0,
        thrown.directionZ[0] ?? 0,
        intensity,
        (reference.tags[0] ?? 0) as CombatTag,
      )
      : -1;
    this.finishImpact(intensity, impactEvent, this.hit.x, this.hit.y, this.hit.z);
  }

  private resolveGroundImpact(): void {
    const intensity = this.calculateImpactIntensity();
    const reference = this.state.data.reference;
    const thrown = this.state.data.thrown;
    const event = this.events.appendRoot(
      BattlefieldCombatEventType.GroundImpact,
      reference.populationId[0] ?? 0,
      reference.entityId[0] ?? 0,
      GROUND_POPULATION_ID,
      0,
      BattlefieldCombatModuleId.Throw,
      thrown.x[0] ?? 0,
      BATTLEFIELD_MONSTER_SPAWN.groundOffsetY,
      thrown.z[0] ?? 0,
      thrown.directionX[0] ?? 0,
      -1,
      thrown.directionZ[0] ?? 0,
      intensity,
      (reference.tags[0] ?? 0) as CombatTag,
    );
    this.finishImpact(
      intensity,
      event,
      thrown.x[0] ?? 0,
      BATTLEFIELD_MONSTER_SPAWN.groundOffsetY,
      thrown.z[0] ?? 0,
    );
  }

  private finishImpact(
    intensity: number,
    parentEvent: number,
    x: number,
    y: number,
    z: number,
  ): void {
    const reference = this.state.data.reference;
    const thrown = this.state.data.thrown;
    const heavy = intensity >= HEAVY_IMPACT_THRESHOLD;
    let heavyEvent = parentEvent;
    if (heavy && parentEvent >= 0) {
      heavyEvent = this.events.appendChild(
        parentEvent,
        BattlefieldCombatEventType.HeavyImpact,
        reference.populationId[0] ?? 0,
        reference.entityId[0] ?? 0,
        reference.populationId[0] ?? 0,
        reference.entityId[0] ?? 0,
        BattlefieldCombatModuleId.Throw,
        x,
        y,
        z,
        thrown.directionX[0] ?? 0,
        -1,
        thrown.directionZ[0] ?? 0,
        intensity,
        (reference.tags[0] ?? 0) as CombatTag,
      );
    }
    const killed = heavy && this.monsters.killManipulated(
      reference.populationId[0] ?? 0,
      reference.entityId[0] ?? 0,
    );
    if (!killed) {
      this.monsters.releaseManipulation(
        reference.populationId[0] ?? 0,
        reference.entityId[0] ?? 0,
      );
    } else if (heavyEvent >= 0) {
      this.events.appendChild(
        heavyEvent,
        BattlefieldCombatEventType.EntityKilled,
        reference.populationId[0] ?? 0,
        reference.entityId[0] ?? 0,
        reference.populationId[0] ?? 0,
        reference.entityId[0] ?? 0,
        BattlefieldCombatModuleId.Throw,
        x,
        y,
        z,
        0,
        0,
        0,
        intensity,
        (reference.tags[0] ?? 0) as CombatTag,
      );
    }
    this.state.clear();
  }

  private calculateImpactIntensity(): number {
    const { throwable, thrown } = this.state.data;
    const speed = Math.hypot(
      thrown.velocityX[0] ?? 0,
      thrown.velocityY[0] ?? 0,
      thrown.velocityZ[0] ?? 0,
    );
    const progress = (thrown.traveledDistance[0] ?? 0)
      / Math.max(0.000001, thrown.maximumDistance[0] ?? 1);
    return (throwable.mass[0] ?? 1)
      * speed
      * (throwable.impactStrength[0] ?? 1)
      * (0.55 + Math.min(1, progress) * 0.45);
  }
}
