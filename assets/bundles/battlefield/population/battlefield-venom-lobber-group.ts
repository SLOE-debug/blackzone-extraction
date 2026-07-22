import { type Camera, type Material, Node } from 'cc';
import {
  type MutablePlanarMonsterHitResult,
  type PlanarMonsterHitQuery,
} from '../../../core/contracts/monster-hit';
import {
  type MutablePlanarTargetResult,
  type PlanarTargetQuery,
} from '../../../core/contracts/planar-target';
import { type PlanarMonsterCombatTarget } from '../../../core/contracts/monster-combat';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import { BATTLEFIELD_VENOM_LOBBER_CONFIG } from '../model/battlefield-venom-lobber-config';
import {
  type BattlefieldMonsterCombatTarget,
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';
import { type PlanarCrowdPopulation } from '../../../core/monsters/crowd/planar-crowd-population';
import { BATTLEFIELD_AIM_ASSIST } from '../combat/battlefield-aim-assist';

const AIM_ASSIST_MINIMUM_ALIGNMENT = Math.cos(BATTLEFIELD_AIM_ASSIST.maximumAngleRadians);

interface MutablePlanarTargetQuery extends PlanarTargetQuery {
  originX: number;
  originY: number;
  directionX: number;
  directionY: number;
  maximumDistance: number;
  minimumAlignment: number;
}

interface MutablePlanarCombatTarget extends PlanarMonsterCombatTarget {
  x: number;
  y: number;
  collisionRadius: number;
}

interface MutablePlanarHitQuery extends PlanarMonsterHitQuery {
  startX: number;
  startY: number;
  startElevation: number;
  endX: number;
  endY: number;
  endElevation: number;
  impactRadius: number;
}

interface MutableVenomRepopulationOptions {
  centerX: number;
  centerY: number;
  spawnInnerRadius: number;
  spawnOuterRadius: number;
  recycleRadius: number;
  hardRecycleRadius: number;
  desiredPopulationCount: number;
}

/** 把 Venom Lobber 的局部 ECS 群体适配到战场世界坐标与伤害协议。 */
export class BattlefieldVenomLobberGroup implements BattlefieldMonsterTargetGroup {
  public readonly populationId: number;
  public readonly crowdPopulation: PlanarCrowdPopulation;
  private readonly population: ReturnType<
    RegisteredFeaturePlugin<FeatureId.CommonMonsters>['createVenomLobber']
  >;
  private readonly localTargetQuery: MutablePlanarTargetQuery = {
    originX: 0,
    originY: 0,
    directionX: 0,
    directionY: 1,
    maximumDistance: 1,
    minimumAlignment: AIM_ASSIST_MINIMUM_ALIGNMENT,
  };
  private readonly localTargetResult: MutablePlanarTargetResult = {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
  };
  private readonly localCombatTarget: MutablePlanarCombatTarget = {
    x: 0,
    y: 0,
    collisionRadius: 0,
  };
  private readonly localHitQuery: MutablePlanarHitQuery = {
    startX: 0,
    startY: 0,
    startElevation: 0,
    endX: 0,
    endY: 0,
    endElevation: 0,
    impactRadius: 0,
  };
  private readonly localHitResult: MutablePlanarMonsterHitResult = {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
    segmentProgress: 0,
  };
  private readonly repopulation: MutableVenomRepopulationOptions = {
    centerX: 0,
    centerY: 0,
    spawnInnerRadius: 1,
    spawnOuterRadius: 2,
    recycleRadius: 3,
    hardRecycleRadius: 4,
    desiredPopulationCount: 0,
  };
  private combatTargetActive = false;
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>,
    initialCenterX: number,
    initialCenterZ: number,
    populationId: number,
    camera: Camera,
    populationCapacity = BATTLEFIELD_VENOM_LOBBER_CONFIG.populationCapacity,
  ) {
    if (!Number.isInteger(populationCapacity) || populationCapacity <= 0) {
      throw new Error('战场 Venom Lobber 群体容量必须是正整数。');
    }
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const config = BATTLEFIELD_VENOM_LOBBER_CONFIG;
    const combat = config.combat;
    this.population = commonMonsters.createVenomLobber(parent, {
      count: populationCapacity,
      initialPopulationCount: 0,
      spawnArea: Object.freeze({
        centerX: initialCenterX * inverseScale,
        centerY: -initialCenterZ * inverseScale,
        width: config.spawnOuterRadius * 2 * inverseScale,
        height: config.spawnOuterRadius * 2 * inverseScale,
      }),
      seed: config.seed,
      surfaceMaterialTemplate,
      camera,
      combat: Object.freeze({
        detectionRadius: combat.detectionRadius * inverseScale,
        disengageRadius: combat.disengageRadius * inverseScale,
        preferredMinimumRange: combat.preferredMinimumRange * inverseScale,
        preferredMaximumRange: combat.preferredMaximumRange * inverseScale,
        pursuitSpeedMultiplier: combat.pursuitSpeedMultiplier,
        retreatSpeedMultiplier: combat.retreatSpeedMultiplier,
        castWindupSeconds: combat.castWindupSeconds,
        castRecoverySeconds: combat.castRecoverySeconds,
        minimumCooldownSeconds: combat.minimumCooldownSeconds,
        maximumCooldownSeconds: combat.maximumCooldownSeconds,
        meleeRange: combat.meleeRange * inverseScale,
        meleeDamage: combat.meleeDamage,
        meleeWindupSeconds: combat.meleeWindupSeconds,
        meleeRecoverySeconds: combat.meleeRecoverySeconds,
        meleeCooldownSeconds: combat.meleeCooldownSeconds,
        meleeLungeSpeedMultiplier: combat.meleeLungeSpeedMultiplier,
        projectileFlightSeconds: combat.projectileFlightSeconds,
        projectileStartElevation: combat.projectileStartElevation * inverseScale,
        blastRadius: combat.blastRadius * inverseScale,
        blastDamage: combat.blastDamage,
        poolRadius: combat.poolRadius * inverseScale,
        poolDurationSeconds: combat.poolDurationSeconds,
        poolDamagePerSecond: combat.poolDamagePerSecond,
        poolMovementMultiplier: combat.poolMovementMultiplier,
        catalystRadiusMultiplier: combat.catalystRadiusMultiplier,
        catalystDamageMultiplier: combat.catalystDamageMultiplier,
        catalystDurationMultiplier: combat.catalystDurationMultiplier,
      }),
    });
    this.populationId = populationId;
    this.crowdPopulation = this.population.createCrowdPopulation(populationId);
  }

  public get count(): number {
    return this.population.count;
  }

  public get aliveCount(): number {
    return this.population.aliveCount;
  }

  public get visibleCount(): number {
    return this.population.visibleCount;
  }

  public get movementMultiplier(): number {
    return this.population.movementMultiplier;
  }

  public maintainAround(playerX: number, playerZ: number, desiredCount: number): void {
    if (this.disposed) {
      return;
    }
    const config = BATTLEFIELD_VENOM_LOBBER_CONFIG;
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    this.repopulation.centerX = playerX * inverseScale;
    this.repopulation.centerY = -playerZ * inverseScale;
    this.repopulation.spawnInnerRadius = config.spawnInnerRadius * inverseScale;
    this.repopulation.spawnOuterRadius = config.spawnOuterRadius * inverseScale;
    this.repopulation.recycleRadius = config.recycleRadius * inverseScale;
    this.repopulation.hardRecycleRadius = config.hardRecycleRadius * inverseScale;
    this.repopulation.desiredPopulationCount = desiredCount;
    this.population.maintainAround(this.repopulation);
  }

  /** 在精确世界坐标启动一个 Venom Lobber 出生生命周期。 */
  public spawnAt(worldX: number, worldZ: number): boolean {
    if (this.disposed) {
      return false;
    }
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    return this.population.spawnAt(worldX * inverseScale, -worldZ * inverseScale);
  }

  public update(
    deltaTime: number,
    target: Readonly<BattlefieldMonsterCombatTarget> | null,
  ): number {
    if (this.disposed) {
      return 0;
    }
    if (target === null) {
      if (this.combatTargetActive) {
        this.population.clearCombatTarget();
        this.combatTargetActive = false;
      }
    } else {
      this.writeLocalCombatTarget(target);
      this.population.synchronizeCombatTarget(this.localCombatTarget);
      this.combatTargetActive = true;
    }
    this.population.simulate(deltaTime);
    return this.population.consumeAttackDamage();
  }

  /** 在世界级 Crowd 求解结束后提交最终姿态。 */
  public synchronizeRendering(): void {
    if (!this.disposed) {
      this.population.synchronizeRendering();
    }
  }

  /** 在共享 Crowd 改写位置后重新以世界脚点求解六足姿态。 */
  public synchronizePostCrowdPose(): void {
    if (!this.disposed) {
      this.population.synchronizePostCrowdPose();
    }
  }

  public writeAimTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    return this.writeTarget(
      originX, originZ, directionX, directionZ, AIM_ASSIST_MINIMUM_ALIGNMENT, result,
    );
  }

  /** 只对共享空间索引给出的单一实体执行瞄准窄相位。 */
  public writeAimTargetForEntity(
    entityIndex: number,
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const query = this.localTargetQuery;
    query.originX = originX / scale;
    query.originY = -originZ / scale;
    query.directionX = directionX;
    query.directionY = -directionZ;
    query.maximumDistance = BATTLEFIELD_AIM_ASSIST.maximumDistance / scale;
    query.minimumAlignment = AIM_ASSIST_MINIMUM_ALIGNMENT;
    if (!this.population.findPlanarTarget(entityIndex, query, this.localTargetResult)) {
      return false;
    }
    result.x = this.localTargetResult.x * scale;
    result.y = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
      + this.localTargetResult.elevation * scale;
    result.z = -this.localTargetResult.y * scale;
    return true;
  }

  public writeProjectileHitForEntity(
    entityIndex: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    impactRadius: number,
    result: MutableBattlefieldProjectileHit,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const query = this.localHitQuery;
    query.startX = startX * inverseScale;
    query.startY = -startZ * inverseScale;
    query.startElevation = (startY - BATTLEFIELD_MONSTER_SPAWN.groundOffsetY) * inverseScale;
    query.endX = endX * inverseScale;
    query.endY = -endZ * inverseScale;
    query.endElevation = (endY - BATTLEFIELD_MONSTER_SPAWN.groundOffsetY) * inverseScale;
    query.impactRadius = impactRadius * inverseScale;
    if (!this.population.findPlanarHit(entityIndex, query, this.localHitResult)) {
      return false;
    }
    result.entityId = this.localHitResult.entityId;
    result.x = this.localHitResult.x * BATTLEFIELD_MONSTER_SPAWN.modelScale;
    result.y = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
      + this.localHitResult.elevation * BATTLEFIELD_MONSTER_SPAWN.modelScale;
    result.z = -this.localHitResult.y * BATTLEFIELD_MONSTER_SPAWN.modelScale;
    result.segmentProgress = this.localHitResult.segmentProgress;
    return true;
  }

  public damageMonster(entityId: number, amount: number): void {
    if (!this.disposed) {
      this.population.damage(entityId, amount);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.population.dispose();
  }

  private writeTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    minimumAlignment: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const query = this.localTargetQuery;
    query.originX = originX / scale;
    query.originY = -originZ / scale;
    query.directionX = directionX;
    query.directionY = -directionZ;
    query.maximumDistance = BATTLEFIELD_AIM_ASSIST.maximumDistance / scale;
    query.minimumAlignment = minimumAlignment;
    if (!this.population.findBestPlanarTarget(query, this.localTargetResult)) {
      return false;
    }
    result.x = this.localTargetResult.x * scale;
    result.y = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
      + this.localTargetResult.elevation * scale;
    result.z = -this.localTargetResult.y * scale;
    return true;
  }

  private writeLocalCombatTarget(target: Readonly<BattlefieldMonsterCombatTarget>): void {
    if (!Number.isFinite(target.x)
      || !Number.isFinite(target.z)
      || !Number.isFinite(target.collisionRadius)
      || target.collisionRadius < 0) {
      throw new Error('Venom Lobber 战场目标必须使用有限坐标和非负半径。');
    }
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    this.localCombatTarget.x = target.x * inverseScale;
    this.localCombatTarget.y = -target.z * inverseScale;
    this.localCombatTarget.collisionRadius = target.collisionRadius * inverseScale;
  }
}
