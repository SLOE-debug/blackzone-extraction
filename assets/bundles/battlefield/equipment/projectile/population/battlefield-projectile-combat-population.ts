import { type WeaponEquipmentDefinition } from '../../../../../core/equipment/equipment';
import {
  type BattlefieldProjectileSweepQuery,
  type MutableBattlefieldProjectileHit,
} from '../../../population/battlefield-monster-contracts';
import { type BattlefieldProjectileCollisionTarget } from '../model/battlefield-projectile-collision-target';
import { BattlefieldProjectileImpactBuffer } from '../model/battlefield-projectile-impact-buffer';
import {
  type MutableBattlefieldProjectileStatistics,
} from '../model/battlefield-projectile-statistics';
import {
  BattlefieldProjectileState,
  calculateProjectileCapacity,
} from '../model/battlefield-projectile-state';

const MAXIMUM_DELTA_TIME = 0.05;
const SEGMENT_EPSILON_SQUARED = 0.00000001;
const CONTACT_EPSILON = 0.001;

interface MutableProjectileSweepQuery extends BattlefieldProjectileSweepQuery {
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  impactRadius: number;
}

/** 管理单件武器全部实体弹丸的生成、积分、CCD、穿透与伤害路由。 */
export class BattlefieldProjectileCombatPopulation {
  public readonly state: BattlefieldProjectileState;
  private readonly impacts: BattlefieldProjectileImpactBuffer;
  private readonly sweepQuery: MutableProjectileSweepQuery = {
    startX: 0,
    startY: 0,
    startZ: 0,
    endX: 0,
    endY: 0,
    endZ: 0,
    impactRadius: 0,
  };
  private readonly hitResult: MutableBattlefieldProjectileHit = {
    populationId: 0,
    entityId: 0,
    x: 0,
    y: 0,
    z: 0,
    segmentProgress: 0,
  };
  private stateRevision = 1;

  constructor(
    private readonly weapon: Readonly<WeaponEquipmentDefinition>,
    private readonly statistics: MutableBattlefieldProjectileStatistics,
  ) {
    const capacity = calculateProjectileCapacity(weapon);
    const penetrationEnergy = weapon.projectile.penetrationEnergy;
    this.state = new BattlefieldProjectileState(
      capacity,
      penetrationEnergy,
      weapon.projectile.maximumRange,
    );
    this.impacts = new BattlefieldProjectileImpactBuffer(capacity * penetrationEnergy);
  }

  /** 渲染适配层判断权威状态是否变化使用的单调版本。 */
  public get revision(): number {
    return this.stateRevision;
  }

  /** 在枪口位置复用一个弹丸槽位。 */
  public spawn(
    x: number,
    y: number,
    z: number,
    directionX: number,
    directionY: number,
    directionZ: number,
  ): void {
    this.state.spawn(x, y, z, directionX, directionY, directionZ);
    this.statistics.projectilesSpawned++;
    this.invalidateState();
  }

  /** 保存旧位置并把全部活动弹丸推进到本帧终点。 */
  public integrate(deltaTime: number): void {
    if (!Number.isFinite(deltaTime)) {
      throw new Error('实体弹丸积分帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(0, Math.min(deltaTime, MAXIMUM_DELTA_TIME));
    const state = this.state;
    let changed = false;
    for (let slot = 0; slot < state.capacity; slot++) {
      if ((state.active[slot] ?? 0) === 0) {
        continue;
      }
      this.statistics.projectilesIntegrated++;
      changed = true;
      const startX = state.x[slot] ?? 0;
      const startY = state.y[slot] ?? 0;
      const startZ = state.z[slot] ?? 0;
      state.previousX[slot] = startX;
      state.previousY[slot] = startY;
      state.previousZ[slot] = startZ;
      const remainingRange = state.remainingRange[slot] ?? 0;
      const stepDistance = Math.min(this.weapon.projectile.speed * safeDeltaTime, remainingRange);
      state.x[slot] = startX + (state.directionX[slot] ?? 0) * stepDistance;
      state.y[slot] = startY + (state.directionY[slot] ?? 0) * stepDistance;
      state.z[slot] = startZ + (state.directionZ[slot] ?? 1) * stepDistance;
      state.remainingRange[slot] = Math.max(0, remainingRange - stepDistance);
    }
    if (changed) {
      this.invalidateState();
    }
  }

  /** 沿本帧真实位移求最早 TOI，并按穿透能量继续处理剩余线段。 */
  public collide(targets: BattlefieldProjectileCollisionTarget): void {
    this.impacts.reset();
    const state = this.state;
    const query = this.sweepQuery;
    query.impactRadius = this.weapon.projectile.impactRadius;
    for (let slot = 0; slot < state.capacity; slot++) {
      if ((state.active[slot] ?? 0) === 0) {
        continue;
      }
      let startX = state.previousX[slot] ?? 0;
      let startY = state.previousY[slot] ?? 0;
      let startZ = state.previousZ[slot] ?? 0;
      const endX = state.x[slot] ?? 0;
      const endY = state.y[slot] ?? 0;
      const endZ = state.z[slot] ?? 0;
      const historyOffset = slot * state.hitHistoryCapacity;
      while ((state.remainingEnergy[slot] ?? 0) > 0) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const deltaZ = endZ - startZ;
        if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
          <= SEGMENT_EPSILON_SQUARED) {
          break;
        }
        query.startX = startX;
        query.startY = startY;
        query.startZ = startZ;
        query.endX = endX;
        query.endY = endY;
        query.endZ = endZ;
        if (!targets.findFirstProjectileHit(
          query,
          state.hitPopulationIds,
          state.hitEntityIds,
          historyOffset,
          state.hitCount[slot] ?? 0,
          this.hitResult,
          this.statistics,
        )) {
          break;
        }
        const progress = Math.max(0, Math.min(this.hitResult.segmentProgress, 1));
        const contactX = startX + deltaX * progress;
        const contactY = startY + deltaY * progress;
        const contactZ = startZ + deltaZ * progress;
        const hitIndex = state.hitCount[slot] ?? 0;
        const damage = this.weapon.damage
          * Math.pow(this.weapon.projectile.damageRetention, hitIndex);
        this.impacts.include(
          this.hitResult.populationId,
          this.hitResult.entityId,
          damage,
        );
        this.statistics.impactsQueued++;
        state.recordHit(slot, this.hitResult.populationId, this.hitResult.entityId);
        state.remainingEnergy[slot] = (state.remainingEnergy[slot] ?? 0) - 1;
        if ((state.remainingEnergy[slot] ?? 0) === 0) {
          state.x[slot] = contactX;
          state.y[slot] = contactY;
          state.z[slot] = contactZ;
          state.deactivate(slot);
          this.invalidateState();
          break;
        }
        startX = contactX + (state.directionX[slot] ?? 0) * CONTACT_EPSILON;
        startY = contactY + (state.directionY[slot] ?? 0) * CONTACT_EPSILON;
        startZ = contactZ + (state.directionZ[slot] ?? 0) * CONTACT_EPSILON;
      }
      if ((state.active[slot] ?? 0) !== 0 && (state.remainingRange[slot] ?? 0) <= 0) {
        state.deactivate(slot);
        this.invalidateState();
      }
    }
  }

  /** 按碰撞阶段写入顺序把固定 Impact Buffer 路由到怪物群体。 */
  public resolveImpacts(targets: BattlefieldProjectileCollisionTarget): void {
    for (let index = 0; index < this.impacts.count; index++) {
      if (targets.damageMonster(
        this.impacts.populationIds[index] ?? 0,
        this.impacts.entityIds[index] ?? 0,
        this.impacts.damage[index] ?? 0,
      )) {
        this.statistics.damageEventsApplied++;
      }
    }
    this.impacts.reset();
  }

  private invalidateState(): void {
    this.stateRevision = this.stateRevision >= Number.MAX_SAFE_INTEGER
      ? 1
      : this.stateRevision + 1;
  }
}
