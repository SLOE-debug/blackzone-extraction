import {
  CombatTag,
  MonsterBodySize,
} from '../../assets/core/contracts/monster-manipulation';
import { BattlefieldActionReleaseSource } from '../../assets/bundles/battlefield/action-modules/model/battlefield-action-release-source';
import { type BattlefieldActionMonsterGateway } from '../../assets/bundles/battlefield/action-modules/model/battlefield-action-runtime-contracts';
import { BattlefieldCombatModuleId } from '../../assets/bundles/battlefield/action-modules/model/battlefield-combat-module';
import { type BattlefieldCombatModuleIntent } from '../../assets/bundles/battlefield/action-modules/model/battlefield-combat-module-intent';
import { BattlefieldCombatModuleRuntime } from '../../assets/bundles/battlefield/action-modules/population/battlefield-combat-module-runtime';
import { type MutableBattlefieldProjectileStatistics } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-projectile-statistics';
import {
  type BattlefieldGrabTargetQuery,
  type BattlefieldProjectileSweepQuery,
  type MutableBattlefieldManipulationCandidate,
  type MutableBattlefieldProjectileHit,
} from '../../assets/bundles/battlefield/population/battlefield-monster-contracts';

export const TEST_BATTLEFIELD_PLAYER = Object.freeze({
  x: 0,
  y: 0.05,
  z: 0,
  heading: 0,
  alive: true,
});

export function grabTestMonster(runtime: BattlefieldCombatModuleRuntime): void {
  runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, true, false, 1));
  runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
  runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, false, true, 1));
  runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
}

export function createTestCombatIntent(
  moduleId: BattlefieldCombatModuleId,
  active: boolean,
  released: boolean,
  amplitude: number,
  directionX = 0,
  directionZ = 1,
): BattlefieldCombatModuleIntent {
  return {
    moduleId,
    active,
    released,
    releaseSource: released
      ? BattlefieldActionReleaseSource.TouchEnd
      : BattlefieldActionReleaseSource.None,
    directionX,
    directionZ,
    amplitude,
  };
}

/** 抓取投掷隔离测试共用的可观测异构怪物门面。 */
export class TestBattlefieldMonsterGateway implements BattlefieldActionMonsterGateway {
  public carried = false;
  public thrown = false;
  public killed = false;
  public hitEnabled = false;
  public damageApplied = 0;
  public knockbackApplied = 0;
  public directionSensitive = false;
  public findCount = 0;
  public lockedValidationCount = 0;
  public candidateZ = 2;
  public lastPoseX = 0;
  public lastPoseY = 0;
  public lastPoseZ = 0;

  public findGrabbable(
    query: Readonly<BattlefieldGrabTargetQuery>,
    result: MutableBattlefieldManipulationCandidate,
  ): boolean {
    this.findCount += 1;
    if (this.directionSensitive && query.directionZ < 0.99) {
      return false;
    }
    this.writeCandidate(result);
    return !this.carried && !this.thrown && !this.killed;
  }

  public writeGrabbableCandidate(
    populationId: number,
    entityId: number,
    result: MutableBattlefieldManipulationCandidate,
  ): boolean {
    this.lockedValidationCount += 1;
    if (populationId !== 7 || entityId !== 3 || this.carried || this.thrown || this.killed) {
      return false;
    }
    this.writeCandidate(result);
    return true;
  }

  public beginCarry(): boolean {
    this.carried = true;
    return true;
  }

  public beginThrow(): boolean {
    this.carried = false;
    this.thrown = true;
    return true;
  }

  public synchronizeManipulatedPose(
    _populationId: number,
    _entityId: number,
    x: number,
    y: number,
    z: number,
  ): boolean {
    this.lastPoseX = x;
    this.lastPoseY = y;
    this.lastPoseZ = z;
    return this.carried || this.thrown;
  }

  public releaseManipulation(): boolean {
    this.carried = false;
    this.thrown = false;
    return true;
  }

  public killManipulated(): boolean {
    this.carried = false;
    this.thrown = false;
    this.killed = true;
    return true;
  }

  public findFirstProjectileHit(
    query: Readonly<BattlefieldProjectileSweepQuery>,
    _ignoredPopulationIds: Uint32Array,
    _ignoredEntityIds: Uint32Array,
    _ignoredOffset: number,
    _ignoredCount: number,
    result: MutableBattlefieldProjectileHit,
    _statistics: MutableBattlefieldProjectileStatistics,
  ): boolean {
    if (!this.hitEnabled) {
      return false;
    }
    result.populationId = 9;
    result.entityId = 4;
    result.x = query.endX;
    result.y = query.endY;
    result.z = query.endZ;
    result.segmentProgress = 1;
    return true;
  }

  public damageMonster(_populationId: number, _entityId: number, amount: number): boolean {
    this.damageApplied += amount;
    return true;
  }

  public knockbackMonster(
    _populationId: number,
    _entityId: number,
    offsetX: number,
    offsetZ: number,
  ): boolean {
    this.knockbackApplied += Math.hypot(offsetX, offsetZ);
    return true;
  }

  private writeCandidate(result: MutableBattlefieldManipulationCandidate): void {
    Object.assign(result, {
      populationId: 7,
      entityId: 3,
      x: 0,
      y: 0.7,
      z: this.candidateZ,
      healthRatio: 0.49,
      bodySize: MonsterBodySize.Small,
      grabResistance: 0,
      playerGrabbable: true,
      tags: CombatTag.SmallBody | CombatTag.Executable,
      throwMass: 1.15,
      maximumThrowDistance: 15,
      collisionRadius: 0.7,
      impactStrength: 1.05,
    });
  }
}
