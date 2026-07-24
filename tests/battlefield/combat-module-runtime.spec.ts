import { describe, expect, it } from 'vitest';
import {
  CombatTag,
  MonsterBodySize,
} from '../../assets/core/contracts/monster-manipulation';
import { UNCONSTRAINED_PLANAR_MOVEMENT } from '../../assets/core/contracts/planar-movement-constraint';
import { BattlefieldCombatEventType } from '../../assets/bundles/battlefield/action-modules/events/battlefield-combat-event-type';
import {
  BattlefieldCombatModuleBehavior,
  BattlefieldCombatModuleId,
  BattlefieldCombatModulePrerequisite,
} from '../../assets/bundles/battlefield/action-modules/model/battlefield-combat-module';
import { type BattlefieldCombatModuleIntent } from '../../assets/bundles/battlefield/action-modules/model/battlefield-combat-module-intent';
import { type BattlefieldActionMonsterGateway } from '../../assets/bundles/battlefield/action-modules/model/battlefield-action-runtime-contracts';
import { BattlefieldCombatModuleRuntime } from '../../assets/bundles/battlefield/action-modules/population/battlefield-combat-module-runtime';
import { type MutableBattlefieldProjectileStatistics } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-projectile-statistics';
import {
  type BattlefieldGrabTargetQuery,
  type BattlefieldProjectileSweepQuery,
  type MutableBattlefieldManipulationCandidate,
  type MutableBattlefieldProjectileHit,
} from '../../assets/bundles/battlefield/population/battlefield-monster-contracts';
import { WorldPhase } from '../../assets/core/world/world-phase';
import { BattlefieldActionInputWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-action-input-world-system';
import { BattlefieldActionExecutionWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-action-execution-world-system';
import { BattlefieldThrownSimulationWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-thrown-simulation-world-system';
import { BattlefieldThrownCollisionWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-thrown-collision-world-system';
import { BattlefieldCombatEventWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-combat-event-world-system';

const PLAYER = { x: 0, y: 0.05, z: 0, heading: 0, alive: true };

describe('抓取与投掷模块第一版闭环', () => {
  it('注册表以统一定义暴露抓取、投掷和预留三个轮盘槽位', () => {
    const runtime = new BattlefieldCombatModuleRuntime(
      new TestMonsterGateway(),
      UNCONSTRAINED_PLANAR_MOVEMENT,
    );
    expect(runtime.registry.ordered).toHaveLength(3);
    expect(runtime.registry.get(BattlefieldCombatModuleId.Grab)).toMatchObject({
      prerequisite: BattlefieldCombatModulePrerequisite.NoCarriedTarget,
      behavior: BattlefieldCombatModuleBehavior.GrabEntity,
    });
    expect(runtime.registry.get(BattlefieldCombatModuleId.Throw)).toMatchObject({
      prerequisite: BattlefieldCombatModulePrerequisite.HasThrowableTarget,
      behavior: BattlefieldCombatModuleBehavior.ThrowEntity,
    });
  });

  it('按输入、动作执行、投掷模拟、碰撞和事件解析的阶段推进', () => {
    expect(new BattlefieldActionInputWorldSystem().phase).toBe(WorldPhase.Input);
    expect(new BattlefieldActionExecutionWorldSystem().phase).toBe(WorldPhase.PreSimulation);
    expect(new BattlefieldThrownSimulationWorldSystem().phase).toBe(WorldPhase.Simulation);
    expect(new BattlefieldThrownCollisionWorldSystem().phase).toBe(WorldPhase.Combat);
    expect(new BattlefieldCombatEventWorldSystem().phase).toBe(WorldPhase.PostSimulation);
  });

  it('半血小怪经过抓取后进入携带，再按预览距离投掷并在重击落地时死亡', () => {
    const monsters = new TestMonsterGateway();
    const runtime = new BattlefieldCombatModuleRuntime(
      monsters,
      UNCONSTRAINED_PLANAR_MOVEMENT,
    );

    runtime.captureIntent(createIntent(BattlefieldCombatModuleId.Grab, true, false, 1));
    runtime.executeActions(PLAYER, 1 / 60);
    expect(runtime.preview.valid).toBe(true);
    expect(runtime.carrying).toBe(false);

    runtime.captureIntent(createIntent(BattlefieldCombatModuleId.Grab, false, true, 1));
    runtime.executeActions(PLAYER, 1 / 60);
    expect(runtime.carrying).toBe(true);
    expect(monsters.carried).toBe(true);
    expect(Array.from(runtime.events.type.slice(0, runtime.events.count))).toContain(
      BattlefieldCombatEventType.EntityGrabbed,
    );

    runtime.captureIntent(createIntent(BattlefieldCombatModuleId.Throw, true, false, 1));
    runtime.executeActions(PLAYER, 1 / 60);
    expect(runtime.preview.valid).toBe(true);
    runtime.captureIntent(createIntent(BattlefieldCombatModuleId.Throw, false, true, 1));
    runtime.executeActions(PLAYER, 1 / 60);
    expect(runtime.thrown).toBe(true);

    for (let frame = 0; frame < 80 && runtime.thrown; frame++) {
      runtime.captureIntent(createIntent(BattlefieldCombatModuleId.Throw, false, false, 0));
      runtime.executeActions(PLAYER, 1 / 60);
      runtime.simulateThrown(1 / 60);
      runtime.resolveThrownCollision();
    }

    expect(runtime.thrown).toBe(false);
    expect(monsters.killed).toBe(true);
    expect(Array.from(runtime.events.type.slice(0, runtime.events.count))).toContain(
      BattlefieldCombatEventType.GroundImpact,
    );
    expect(Array.from(runtime.events.type.slice(0, runtime.events.count))).toContain(
      BattlefieldCombatEventType.HeavyImpact,
    );
    expect(Array.from(runtime.events.type.slice(0, runtime.events.count))).toContain(
      BattlefieldCombatEventType.EntityKilled,
    );
  });

  it('投掷扫掠命中另一只怪物时产生 EntityImpact 并施加伤害', () => {
    const monsters = new TestMonsterGateway();
    const runtime = new BattlefieldCombatModuleRuntime(
      monsters,
      UNCONSTRAINED_PLANAR_MOVEMENT,
    );
    grab(runtime);
    runtime.captureIntent(createIntent(BattlefieldCombatModuleId.Throw, false, true, 1));
    runtime.executeActions(PLAYER, 1 / 60);
    monsters.hitEnabled = true;
    runtime.simulateThrown(1 / 60);
    runtime.resolveThrownCollision();

    expect(monsters.damageApplied).toBeGreaterThan(0);
    expect(monsters.knockbackApplied).toBeGreaterThan(0);
    expect(Array.from(runtime.events.type.slice(0, runtime.events.count))).toContain(
      BattlefieldCombatEventType.EntityImpact,
    );
  });
});

function grab(runtime: BattlefieldCombatModuleRuntime): void {
  runtime.captureIntent(createIntent(BattlefieldCombatModuleId.Grab, false, true, 1));
  runtime.executeActions(PLAYER, 1 / 60);
}

function createIntent(
  moduleId: BattlefieldCombatModuleId,
  active: boolean,
  released: boolean,
  amplitude: number,
): BattlefieldCombatModuleIntent {
  return {
    moduleId,
    active,
    released,
    directionX: 0,
    directionZ: 1,
    amplitude,
  };
}

class TestMonsterGateway implements BattlefieldActionMonsterGateway {
  public carried = false;
  public thrown = false;
  public killed = false;
  public hitEnabled = false;
  public damageApplied = 0;
  public knockbackApplied = 0;

  public findGrabbable(
    _query: Readonly<BattlefieldGrabTargetQuery>,
    result: MutableBattlefieldManipulationCandidate,
  ): boolean {
    Object.assign(result, {
      populationId: 7,
      entityId: 3,
      x: 0,
      y: 0.7,
      z: 2,
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
    return !this.carried && !this.thrown && !this.killed;
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

  public synchronizeManipulatedPose(): boolean {
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
}
