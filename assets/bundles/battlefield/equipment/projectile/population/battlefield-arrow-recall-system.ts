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
import {
  BattlefieldArrowModuleFlag,
  BattlefieldArrowRecallKind,
  BattlefieldArrowState,
} from '../model/battlefield-arrow-state';
import {
  BATTLEFIELD_ARROW_CAPACITY,
  type BattlefieldArrowPopulation,
} from './battlefield-arrow-population';
import { BattlefieldArrowHitHistory } from './battlefield-arrow-hit-history';

const ARRIVAL_DISTANCE = 0.42;
const CURVE_STRENGTH = 0.14;

/** 推进自动或主动回程曲线，并执行独立于去程序列的连续命中。 */
export class BattlefieldArrowRecallSystem {
  private readonly hits = new BattlefieldArrowHitBuffer();
  private readonly history = new BattlefieldArrowHitHistory();
  private readonly query: Mutable<BattlefieldArrowSweepQuery> = {
    startX: 0,
    startY: 0,
    startZ: 0,
    endX: 0,
    endY: 0,
    endZ: 0,
    radius: 0.16,
  };

  public beginRecall(
    arrows: BattlefieldArrowPopulation,
    index: number,
    kind: BattlefieldArrowRecallKind,
    skillSequenceId: number,
  ): boolean {
    const state = arrows.state[index] as BattlefieldArrowState;
    if (state === BattlefieldArrowState.Ready
      || state === BattlefieldArrowState.Drawing
      || state === BattlefieldArrowState.Returning) {
      return false;
    }
    arrows.recallKind[index] = kind;
    arrows.skillSequenceId[index] = skillSequenceId;
    arrows.state[index] = BattlefieldArrowState.Returning;
    arrows.dirty[index] = 1;
    return true;
  }

  public update(
    arrows: BattlefieldArrowPopulation,
    target: BattlefieldArrowCombatTarget,
    events: BattlefieldDamageEventBuffer,
    ownerX: number,
    ownerY: number,
    ownerZ: number,
    automaticSpeed: number,
    skillSpeed: number,
    radius: number,
    automaticDamageScale: number,
    skillDamageScale: number,
    deltaTime: number,
  ): number {
    let returned = 0;
    const safeDelta = Math.max(0, Math.min(deltaTime, 0.05));
    this.query.radius = radius;
    for (let index = 0; index < BATTLEFIELD_ARROW_CAPACITY; index++) {
      if (arrows.state[index] !== BattlefieldArrowState.Returning) {
        continue;
      }
      const x = arrows.positionX[index] ?? 0;
      const y = arrows.positionY[index] ?? 0;
      const z = arrows.positionZ[index] ?? 0;
      const deltaX = ownerX - x;
      const deltaY = ownerY - y;
      const deltaZ = ownerZ - z;
      const distance = Math.hypot(deltaX, deltaY, deltaZ);
      if (distance <= ARRIVAL_DISTANCE) {
        arrows.restoreReady(index);
        returned++;
        continue;
      }
      const inverseDistance = 1 / distance;
      const kind = arrows.recallKind[index] as BattlefieldArrowRecallKind;
      const speed = kind === BattlefieldArrowRecallKind.Skill ? skillSpeed : automaticSpeed;
      const travel = Math.min(distance, speed * safeDelta);
      const convergence = Math.min(1, distance / 5);
      const curve = (arrows.recallLateralSign[index] ?? 1) * CURVE_STRENGTH * convergence;
      arrows.previousX[index] = x;
      arrows.previousY[index] = y;
      arrows.previousZ[index] = z;
      arrows.positionX[index] = x + (deltaX * inverseDistance + deltaZ * inverseDistance * curve) * travel;
      arrows.positionY[index] = y + deltaY * inverseDistance * travel;
      arrows.positionZ[index] = z + (deltaZ * inverseDistance - deltaX * inverseDistance * curve) * travel;
      arrows.directionX[index] = deltaX * inverseDistance;
      arrows.directionY[index] = deltaY * inverseDistance;
      arrows.directionZ[index] = deltaZ * inverseDistance;
      arrows.dirty[index] = 1;
      this.collectHits(arrows, index, target, events, automaticDamageScale, skillDamageScale);
    }
    return returned;
  }

  private collectHits(
    arrows: BattlefieldArrowPopulation,
    arrowIndex: number,
    target: BattlefieldArrowCombatTarget,
    events: BattlefieldDamageEventBuffer,
    automaticDamageScale: number,
    skillDamageScale: number,
  ): void {
    this.writeQuery(arrows, arrowIndex);
    target.collectArrowSweepHits(this.query, this.hits);
    const kind = arrows.recallKind[arrowIndex] as BattlefieldArrowRecallKind;
    const damageScale = kind === BattlefieldArrowRecallKind.Skill
      ? skillDamageScale
      : automaticDamageScale;
    const sequenceId = arrows.skillSequenceId[arrowIndex] ?? 0;
    for (let hitIndex = 0; hitIndex < this.hits.count; hitIndex++) {
      const populationId = this.hits.populationId[hitIndex] ?? 0;
      const entityId = this.hits.entityId[hitIndex] ?? 0;
      if (!this.history.accept(arrowIndex, sequenceId, populationId, entityId)) {
        continue;
      }
      events.append({
        sourceEntityId: arrows.ownerEntityId[arrowIndex] ?? 0,
        sourceWeaponId: BattlefieldWeaponSourceId.ReturningBow,
        attackSequenceId: sequenceId,
        targetPopulationId: populationId,
        targetEntityId: entityId,
        damage: (arrows.damage[arrowIndex] ?? 0) * damageScale,
        damageKind: BattlefieldDamageKind.Recall,
        hitPositionX: this.hits.x[hitIndex] ?? 0,
        hitPositionY: this.hits.y[hitIndex] ?? 0,
        hitPositionZ: this.hits.z[hitIndex] ?? 0,
      });
      if (((arrows.moduleMask[arrowIndex] ?? 0) & BattlefieldArrowModuleFlag.Grappling) !== 0) {
        target.applyArrowPull(
          populationId,
          entityId,
          arrows.directionX[arrowIndex] ?? 0,
          arrows.directionZ[arrowIndex] ?? 0,
          2.4,
        );
      }
    }
  }

  private writeQuery(arrows: BattlefieldArrowPopulation, index: number): void {
    this.query.startX = arrows.previousX[index] ?? 0;
    this.query.startY = arrows.previousY[index] ?? 0;
    this.query.startZ = arrows.previousZ[index] ?? 0;
    this.query.endX = arrows.positionX[index] ?? 0;
    this.query.endY = arrows.positionY[index] ?? 0;
    this.query.endZ = arrows.positionZ[index] ?? 0;
  }
}

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
