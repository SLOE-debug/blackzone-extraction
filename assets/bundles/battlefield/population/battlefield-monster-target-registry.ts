import {
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';

/** 聚合异构怪物群的辅助瞄准与首个子弹命中，避免场景人口门面重复遍历逻辑。 */
export class BattlefieldMonsterTargetRegistry {
  private readonly groups: BattlefieldMonsterTargetGroup[] = [];
  private readonly aimCandidate: MutableBattlefieldAimTarget = { x: 0, y: 0, z: 0 };
  private readonly hitCandidate: MutableBattlefieldProjectileHit = {
    entityId: -1,
    x: 0,
    y: 0,
    z: 0,
    segmentProgress: 0,
  };

  public register(group: BattlefieldMonsterTargetGroup): void {
    if (this.groups.includes(group)) {
      throw new Error('怪物目标群不能重复登记。');
    }
    this.groups.push(group);
  }

  public unregister(group: BattlefieldMonsterTargetGroup): void {
    const index = this.groups.indexOf(group);
    if (index >= 0) {
      this.groups.splice(index, 1);
    }
  }

  public resolveAimTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    automatic: boolean,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    let found = false;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const group of this.groups) {
      const candidateFound = automatic
        ? group.writeAutoTarget(originX, originZ, directionX, directionZ, this.aimCandidate)
        : group.writeAimTarget(originX, originZ, directionX, directionZ, this.aimCandidate);
      if (!candidateFound) {
        continue;
      }
      const deltaX = this.aimCandidate.x - originX;
      const deltaZ = this.aimCandidate.z - originZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared >= bestDistanceSquared) {
        continue;
      }
      result.x = this.aimCandidate.x;
      result.y = this.aimCandidate.y;
      result.z = this.aimCandidate.z;
      bestDistanceSquared = distanceSquared;
      found = true;
    }
    return found;
  }

  /** 在全部异构群体中选择线段最先接触的实体，并把伤害路由回其所有者。 */
  public damageFirstAlongSegment(
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    impactRadius: number,
    damage: number,
    result: MutableBattlefieldProjectileHit,
  ): boolean {
    let bestGroup: BattlefieldMonsterTargetGroup | null = null;
    let bestProgress = Number.POSITIVE_INFINITY;
    let bestEntityId = -1;
    for (const group of this.groups) {
      if (!group.writeProjectileHit(
        startX,
        startY,
        startZ,
        endX,
        endY,
        endZ,
        impactRadius,
        this.hitCandidate,
      ) || this.hitCandidate.segmentProgress >= bestProgress) {
        continue;
      }
      bestGroup = group;
      bestProgress = this.hitCandidate.segmentProgress;
      bestEntityId = this.hitCandidate.entityId;
      result.entityId = bestEntityId;
      result.x = this.hitCandidate.x;
      result.y = this.hitCandidate.y;
      result.z = this.hitCandidate.z;
      result.segmentProgress = bestProgress;
    }
    if (bestGroup === null) {
      return false;
    }
    bestGroup.damageMonster(bestEntityId, damage);
    return true;
  }
}
