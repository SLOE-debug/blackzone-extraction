import {
  BattlefieldDamageEventBuffer,
  BattlefieldDamageKind,
  BattlefieldWeaponSourceId,
} from '../../combat/battlefield-damage-event-buffer';
import {
  BattlefieldArrowHitBuffer,
  type BattlefieldArrowCombatTarget,
  type BattlefieldArrowSweepQuery,
  type MutableBattlefieldArrowTargetPose,
} from '../model/battlefield-arrow-query';
import { BattlefieldArrowState } from '../model/battlefield-arrow-state';
import {
  BATTLEFIELD_ARROW_CAPACITY,
  type BattlefieldArrowPopulation,
} from './battlefield-arrow-population';
import { BattlefieldArrowHitHistory } from './battlefield-arrow-hit-history';

const PIERCE_DAMAGE_DECAY = 0.72;

/** 执行去程连续扫掠、穿透衰减、命中去重与怪物附着。 */
export class BattlefieldArrowCollisionSystem {
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
  private readonly targetPose: MutableBattlefieldArrowTargetPose = {
    x: 0,
    y: 0,
    z: 0,
    radius: 0,
  };

  public update(
    arrows: BattlefieldArrowPopulation,
    target: BattlefieldArrowCombatTarget,
    events: BattlefieldDamageEventBuffer,
    radius: number,
  ): void {
    this.query.radius = radius;
    for (let arrowIndex = 0; arrowIndex < BATTLEFIELD_ARROW_CAPACITY; arrowIndex++) {
      if (arrows.state[arrowIndex] !== BattlefieldArrowState.Flying) {
        continue;
      }
      this.writeQuery(arrows, arrowIndex);
      target.collectArrowSweepHits(this.query, this.hits);
      this.resolveHits(arrows, arrowIndex, target, events);
    }
  }

  public reset(): void {
    this.history.reset();
  }

  private resolveHits(
    arrows: BattlefieldArrowPopulation,
    arrowIndex: number,
    target: BattlefieldArrowCombatTarget,
    events: BattlefieldDamageEventBuffer,
  ): void {
    let damageScale = 1;
    for (let hitIndex = 0; hitIndex < this.hits.count; hitIndex++) {
      const populationId = this.hits.populationId[hitIndex] ?? 0;
      const entityId = this.hits.entityId[hitIndex] ?? 0;
      const sequenceId = arrows.attackSequenceId[arrowIndex] ?? 0;
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
        damageKind: BattlefieldDamageKind.Projectile,
        hitPositionX: this.hits.x[hitIndex] ?? 0,
        hitPositionY: this.hits.y[hitIndex] ?? 0,
        hitPositionZ: this.hits.z[hitIndex] ?? 0,
      });
      if ((arrows.pierceRemaining[arrowIndex] ?? 0) > 0) {
        arrows.pierceRemaining[arrowIndex]--;
        damageScale *= PIERCE_DAMAGE_DECAY;
        continue;
      }
      this.embed(arrows, arrowIndex, hitIndex, target);
      break;
    }
  }

  private embed(
    arrows: BattlefieldArrowPopulation,
    arrowIndex: number,
    hitIndex: number,
    target: BattlefieldArrowCombatTarget,
  ): void {
    const hitX = this.hits.x[hitIndex] ?? 0;
    const hitY = this.hits.y[hitIndex] ?? 0;
    const hitZ = this.hits.z[hitIndex] ?? 0;
    arrows.positionX[arrowIndex] = hitX;
    arrows.positionY[arrowIndex] = hitY;
    arrows.positionZ[arrowIndex] = hitZ;
    arrows.attachedPopulationId[arrowIndex] = this.hits.populationId[hitIndex] ?? 0;
    arrows.attachedEntityId[arrowIndex] = this.hits.entityId[hitIndex] ?? 0;
    const hasPose = target.writeArrowTargetPose(
      arrows.attachedPopulationId[arrowIndex] ?? 0,
      arrows.attachedEntityId[arrowIndex] ?? 0,
      this.targetPose,
    );
    arrows.attachmentOffsetX[arrowIndex] = hasPose ? hitX - this.targetPose.x : 0;
    arrows.attachmentOffsetY[arrowIndex] = hasPose ? hitY - this.targetPose.y : Math.max(0.25, hitY);
    arrows.attachmentOffsetZ[arrowIndex] = hasPose ? hitZ - this.targetPose.z : 0;
    arrows.state[arrowIndex] = BattlefieldArrowState.EmbeddedInMonster;
    arrows.dirty[arrowIndex] = 1;
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
