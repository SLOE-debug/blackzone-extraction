import {
  BattlefieldDamageEventBuffer,
  BattlefieldDamageKind,
  BattlefieldWeaponSourceId,
} from '../../combat/battlefield-damage-event-buffer';
import {
  BattlefieldArrowHitBuffer,
  type BattlefieldArrowCombatTarget,
  type BattlefieldArrowSweepQuery,
} from '../model/battlefield-arrow-query';
import { BattlefieldArrowState } from '../model/battlefield-arrow-state';
import {
  BATTLEFIELD_PERMANENT_ARROW_CAPACITY,
  type BattlefieldArrowPopulation,
} from './battlefield-arrow-population';

export const BATTLEFIELD_MAXIMUM_TETHER_COUNT = 6;
const TETHER_TARGET_CAPACITY = 32;

/** 固定容量弦网，使用最近邻连续路径并维护逐线逐目标冷却。 */
export class BattlefieldArrowTetherSystem {
  public readonly startArrowIndex = new Uint8Array(BATTLEFIELD_MAXIMUM_TETHER_COUNT);
  public readonly endArrowIndex = new Uint8Array(BATTLEFIELD_MAXIMUM_TETHER_COUNT);
  private readonly cooldownPopulationId = new Uint32Array(
    BATTLEFIELD_MAXIMUM_TETHER_COUNT * TETHER_TARGET_CAPACITY,
  );
  private readonly cooldownEntityId = new Uint32Array(
    BATTLEFIELD_MAXIMUM_TETHER_COUNT * TETHER_TARGET_CAPACITY,
  );
  private readonly cooldownUntil = new Float32Array(
    BATTLEFIELD_MAXIMUM_TETHER_COUNT * TETHER_TARGET_CAPACITY,
  );
  private readonly hits = new BattlefieldArrowHitBuffer();
  private readonly query: Mutable<BattlefieldArrowSweepQuery> = {
    startX: 0,
    startY: 0,
    startZ: 0,
    endX: 0,
    endY: 0,
    endZ: 0,
    radius: 0.12,
  };
  private tetherCountValue = 0;
  private remainingSeconds = 0;
  private elapsedSeconds = 0;
  private skillSequenceId = 0;

  public get active(): boolean {
    return this.remainingSeconds > 0 && this.tetherCountValue > 0;
  }

  public get tetherCount(): number {
    return this.tetherCountValue;
  }

  /** 从当前附着箭构造不重复、每箭度数不超过二的最近邻路径。 */
  public activate(
    arrows: BattlefieldArrowPopulation,
    durationSeconds: number,
    skillSequenceId: number,
  ): boolean {
    const anchors = new Uint8Array(BATTLEFIELD_PERMANENT_ARROW_CAPACITY);
    let anchorCount = 0;
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      const state = arrows.state[index] as BattlefieldArrowState;
      if (state === BattlefieldArrowState.EmbeddedInMonster
        || state === BattlefieldArrowState.EmbeddedInWorld) {
        anchors[anchorCount++] = index;
      }
    }
    if (anchorCount < 2) {
      return false;
    }
    this.tetherCountValue = 0;
    const connected = new Uint8Array(BATTLEFIELD_PERMANENT_ARROW_CAPACITY);
    connected[0] = 1;
    let current = anchors[0] ?? 0;
    for (let edge = 0; edge < Math.min(anchorCount - 1, BATTLEFIELD_MAXIMUM_TETHER_COUNT); edge++) {
      const next = this.findNearestUnconnected(arrows, anchors, anchorCount, connected, current);
      if (next < 0) {
        break;
      }
      this.startArrowIndex[edge] = current;
      this.endArrowIndex[edge] = next;
      this.tetherCountValue++;
      connected[next] = 1;
      current = next;
    }
    this.remainingSeconds = durationSeconds;
    this.elapsedSeconds = 0;
    this.skillSequenceId = skillSequenceId;
    this.cooldownUntil.fill(0);
    return this.tetherCountValue > 0;
  }

  public update(
    arrows: BattlefieldArrowPopulation,
    target: BattlefieldArrowCombatTarget,
    events: BattlefieldDamageEventBuffer,
    baseDamage: number,
    damageScale: number,
    hitCooldownSeconds: number,
    slowScale: number,
    slowDurationSeconds: number,
    deltaTime: number,
  ): void {
    if (!this.active) {
      return;
    }
    const safeDelta = Math.max(0, Math.min(deltaTime, 0.05));
    this.elapsedSeconds += safeDelta;
    this.remainingSeconds = Math.max(0, this.remainingSeconds - safeDelta);
    for (let edge = 0; edge < this.tetherCountValue; edge++) {
      const start = this.startArrowIndex[edge] ?? 0;
      const end = this.endArrowIndex[edge] ?? 0;
      if (!isAnchor(arrows.state[start] as BattlefieldArrowState)
        || !isAnchor(arrows.state[end] as BattlefieldArrowState)) {
        continue;
      }
      this.query.startX = arrows.positionX[start] ?? 0;
      this.query.startY = arrows.positionY[start] ?? 0;
      this.query.startZ = arrows.positionZ[start] ?? 0;
      this.query.endX = arrows.positionX[end] ?? 0;
      this.query.endY = arrows.positionY[end] ?? 0;
      this.query.endZ = arrows.positionZ[end] ?? 0;
      target.collectArrowSweepHits(this.query, this.hits);
      for (let hit = 0; hit < this.hits.count; hit++) {
        const populationId = this.hits.populationId[hit] ?? 0;
        const entityId = this.hits.entityId[hit] ?? 0;
        if (!this.acceptCooldown(edge, populationId, entityId, hitCooldownSeconds)) {
          continue;
        }
        events.append({
          sourceEntityId: arrows.ownerEntityId[start] ?? 0,
          sourceWeaponId: BattlefieldWeaponSourceId.ReturningBow,
          attackSequenceId: this.skillSequenceId,
          targetPopulationId: populationId,
          targetEntityId: entityId,
          damage: baseDamage * damageScale,
          damageKind: BattlefieldDamageKind.Tether,
          hitPositionX: this.hits.x[hit] ?? 0,
          hitPositionY: this.hits.y[hit] ?? 0,
          hitPositionZ: this.hits.z[hit] ?? 0,
        });
        target.applyArrowSlow(populationId, entityId, slowScale, slowDurationSeconds);
      }
    }
    if (this.remainingSeconds <= 0) {
      this.deactivate();
    }
  }

  public deactivate(): void {
    this.tetherCountValue = 0;
    this.remainingSeconds = 0;
  }

  private findNearestUnconnected(
    arrows: BattlefieldArrowPopulation,
    anchors: Uint8Array,
    anchorCount: number,
    connected: Uint8Array,
    current: number,
  ): number {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < anchorCount; index++) {
      const candidate = anchors[index] ?? 0;
      if (connected[candidate] !== 0) {
        continue;
      }
      const dx = (arrows.positionX[candidate] ?? 0) - (arrows.positionX[current] ?? 0);
      const dy = (arrows.positionY[candidate] ?? 0) - (arrows.positionY[current] ?? 0);
      const dz = (arrows.positionZ[candidate] ?? 0) - (arrows.positionZ[current] ?? 0);
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  }

  private acceptCooldown(
    edge: number,
    populationId: number,
    entityId: number,
    durationSeconds: number,
  ): boolean {
    const start = edge * TETHER_TARGET_CAPACITY;
    let replacement = start;
    let oldest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < TETHER_TARGET_CAPACITY; index++) {
      const slot = start + index;
      if ((this.cooldownPopulationId[slot] ?? 0) === populationId
        && (this.cooldownEntityId[slot] ?? 0) === entityId) {
        if ((this.cooldownUntil[slot] ?? 0) > this.elapsedSeconds) {
          return false;
        }
        replacement = slot;
        oldest = -1;
        break;
      }
      const until = this.cooldownUntil[slot] ?? 0;
      if (until < oldest) {
        oldest = until;
        replacement = slot;
      }
    }
    this.cooldownPopulationId[replacement] = populationId;
    this.cooldownEntityId[replacement] = entityId;
    this.cooldownUntil[replacement] = this.elapsedSeconds + durationSeconds;
    return true;
  }
}

function isAnchor(state: BattlefieldArrowState): boolean {
  return state === BattlefieldArrowState.EmbeddedInMonster
    || state === BattlefieldArrowState.EmbeddedInWorld;
}

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
