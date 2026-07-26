import { describe, expect, it } from 'vitest';
import { type MutablePlanarPosition } from '../../assets/core/contracts/planar-movement-constraint';
import {
  type MutableSpatialPosition,
  type SpatialMovementConstraint,
  UNCONSTRAINED_SPATIAL_MOVEMENT,
} from '../../assets/core/contracts/spatial-movement-constraint';
import { BattlefieldActionFailureReason } from '../../assets/bundles/battlefield/action-modules/model/battlefield-action-failure';
import { BattlefieldActionReleaseSource } from '../../assets/bundles/battlefield/action-modules/model/battlefield-action-release-source';
import { BattlefieldCombatModuleId } from '../../assets/bundles/battlefield/action-modules/model/battlefield-combat-module';
import { BattlefieldCombatModuleRuntime } from '../../assets/bundles/battlefield/action-modules/population/battlefield-combat-module-runtime';
import {
  createTestCombatIntent,
  grabTestMonster,
  TEST_BATTLEFIELD_PLAYER,
  TestBattlefieldMonsterGateway,
} from './combat-module-fixture';

describe('抓取与投掷真实输入回归', () => {
  it('TOUCH_CANCEL 释放不会吞掉已锁定抓取，并保留诊断来源', () => {
    const runtime = new BattlefieldCombatModuleRuntime(
      new TestBattlefieldMonsterGateway(),
      UNCONSTRAINED_SPATIAL_MOVEMENT,
    );
    runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, true, false, 1));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
    const cancelledRelease = createTestCombatIntent(
      BattlefieldCombatModuleId.Grab,
      false,
      true,
      1,
    );
    cancelledRelease.releaseSource = BattlefieldActionReleaseSource.TouchCancel;
    runtime.captureIntent(cancelledRelease);
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);

    expect(runtime.carrying).toBe(true);
    expect(runtime.diagnostics.releaseSource).toBe(BattlefieldActionReleaseSource.TouchCancel);
  });

  it('松手抓取使用四点五米容错，并为越界锁定显示明确失败原因', () => {
    const tolerantMonsters = new TestBattlefieldMonsterGateway();
    tolerantMonsters.candidateZ = 3.8;
    const tolerant = new BattlefieldCombatModuleRuntime(
      tolerantMonsters,
      UNCONSTRAINED_SPATIAL_MOVEMENT,
    );
    tolerant.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, true, false, 1));
    tolerant.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
    tolerant.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, false, true, 1));
    tolerant.executeActions({ ...TEST_BATTLEFIELD_PLAYER, z: -0.6 }, 1 / 60);
    expect(tolerant.carrying).toBe(true);

    const rejectedMonsters = new TestBattlefieldMonsterGateway();
    rejectedMonsters.candidateZ = 3.8;
    const rejected = new BattlefieldCombatModuleRuntime(
      rejectedMonsters,
      UNCONSTRAINED_SPATIAL_MOVEMENT,
    );
    rejected.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, true, false, 1));
    rejected.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
    rejected.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, false, true, 1));
    rejected.executeActions({ ...TEST_BATTLEFIELD_PLAYER, z: -0.8 }, 1 / 60);
    expect(rejected.carrying).toBe(false);
    expect(rejected.preview.active).toBe(true);
    expect(rejected.preview.valid).toBe(false);
    expect(rejected.preview.failureReason).toBe(BattlefieldActionFailureReason.OutOfRange);
  });

  it('携带锚点前方受阻时缩短并抬高槽位，不把怪物继续塞入障碍', () => {
    const monsters = new TestBattlefieldMonsterGateway();
    const movement = new TestSpatialConstraint();
    movement.maximumCarryZ = 0.4;
    const runtime = new BattlefieldCombatModuleRuntime(monsters, movement);
    grabTestMonster(runtime);
    runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, false, false, 0));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1);

    expect(runtime.carrying).toBe(true);
    expect(monsters.lastPoseZ).toBeLessThanOrEqual(0.4);
    expect(monsters.lastPoseY).toBeGreaterThan(2);
  });

  it('障碍把完整轨迹截短到三点二米以内时仍执行短距离砸地', () => {
    const monsters = new TestBattlefieldMonsterGateway();
    const movement = new TestSpatialConstraint();
    movement.maximumThrowX = 1.2;
    const runtime = new BattlefieldCombatModuleRuntime(monsters, movement);
    grabTestMonster(runtime);
    runtime.captureIntent(createTestCombatIntent(
      BattlefieldCombatModuleId.Throw,
      false,
      true,
      1,
      1,
      0,
    ));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);

    expect(runtime.thrown).toBe(true);
    expect(runtime.preview.valid).toBe(true);
    expect(runtime.preview.blocked).toBe(true);
    expect(runtime.preview.endX).toBeCloseTo(1.2, 4);
  });

  it('零幅度释放保持携带并写出统一输入失败原因', () => {
    const runtime = new BattlefieldCombatModuleRuntime(
      new TestBattlefieldMonsterGateway(),
      UNCONSTRAINED_SPATIAL_MOVEMENT,
    );
    grabTestMonster(runtime);
    runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Throw, false, true, 0));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);

    expect(runtime.carrying).toBe(true);
    expect(runtime.preview.failureReason).toBe(
      BattlefieldActionFailureReason.InputBelowDeadZone,
    );
  });
});

class TestSpatialConstraint implements SpatialMovementConstraint {
  public maximumCarryZ = Number.POSITIVE_INFINITY;
  public maximumThrowX = Number.POSITIVE_INFINITY;

  public resolve(
    _startX: number,
    _startZ: number,
    targetX: number,
    targetZ: number,
    _radius: number,
    result: MutablePlanarPosition,
  ): void {
    result.x = targetX;
    result.z = targetZ;
  }

  public resolveSpatial(
    _startX: number,
    _startY: number,
    _startZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    _radius: number,
    result: MutableSpatialPosition,
  ): void {
    result.x = Math.min(targetX, this.maximumThrowX);
    result.y = targetY;
    result.z = targetY > 1 ? Math.min(targetZ, this.maximumCarryZ) : targetZ;
  }
}
