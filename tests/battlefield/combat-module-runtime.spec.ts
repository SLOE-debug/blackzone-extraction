import { describe, expect, it } from 'vitest';
import { UNCONSTRAINED_SPATIAL_MOVEMENT } from '../../assets/core/contracts/spatial-movement-constraint';
import { BattlefieldCombatEventType } from '../../assets/bundles/battlefield/action-modules/events/battlefield-combat-event-type';
import {
  BattlefieldCombatModuleBehavior,
  BattlefieldCombatModuleId,
  BattlefieldCombatModulePrerequisite,
} from '../../assets/bundles/battlefield/action-modules/model/battlefield-combat-module';
import { type BattlefieldCombatModuleIntent } from '../../assets/bundles/battlefield/action-modules/model/battlefield-combat-module-intent';
import { BattlefieldActionReleaseSource } from '../../assets/bundles/battlefield/action-modules/model/battlefield-action-release-source';
import { BattlefieldCombatModuleRuntime } from '../../assets/bundles/battlefield/action-modules/population/battlefield-combat-module-runtime';
import { WorldPhase } from '../../assets/core/world/world-phase';
import { BattlefieldActionInputWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-action-input-world-system';
import { BattlefieldActionExecutionWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-action-execution-world-system';
import { BattlefieldThrownSimulationWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-thrown-simulation-world-system';
import { BattlefieldThrownCollisionWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-thrown-collision-world-system';
import { BattlefieldCombatEventWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-combat-event-world-system';
import {
  createTestCombatIntent,
  grabTestMonster,
  TEST_BATTLEFIELD_PLAYER,
  TestBattlefieldMonsterGateway,
} from './combat-module-fixture';

describe('抓取与投掷模块第一版闭环', () => {
  it('注册表以统一定义暴露抓取、投掷和预留三个轮盘槽位', () => {
    const runtime = new BattlefieldCombatModuleRuntime(
      new TestBattlefieldMonsterGateway(),
      UNCONSTRAINED_SPATIAL_MOVEMENT,
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

  it('技能拖动低于死区时保留最近一次明确战斗瞄准方向', () => {
    const system = new BattlefieldActionInputWorldSystem();
    const captured: BattlefieldCombatModuleIntent = createTestCombatIntent(
      BattlefieldCombatModuleId.Grab,
      false,
      false,
      0,
    );
    let skillAmplitude = 0;
    let aiming = true;
    const world = {
      weaponFiringRequested: false,
      resources: {
        performance: {
          beginStage: () => 0,
          endStage: () => undefined,
        },
        controls: {
          state: {
            aiming,
            aimX: 1,
            aimY: 0,
          },
          consumeCombatModuleInput: (result: {
            moduleId: BattlefieldCombatModuleId;
            active: boolean;
            released: boolean;
            releaseSource: BattlefieldActionReleaseSource;
            x: number;
            y: number;
            amplitude: number;
          }) => {
            result.moduleId = BattlefieldCombatModuleId.Grab;
            result.active = true;
            result.released = false;
            result.releaseSource = BattlefieldActionReleaseSource.None;
            result.x = -1;
            result.y = 0;
            result.amplitude = skillAmplitude;
          },
        },
        camera: {
          writeWorldPlanarDirection: (
            x: number,
            y: number,
            result: { x: number; z: number },
          ) => {
            result.x = x;
            result.z = y;
          },
        },
        player: { heading: 0 },
        actions: {
          captureIntent: (intent: Readonly<BattlefieldCombatModuleIntent>) => {
            Object.assign(captured, intent);
          },
        },
      },
    };

    system.update(world as never, 1 / 60);
    expect([captured.directionX, captured.directionZ]).toEqual([1, 0]);

    aiming = false;
    world.resources.controls.state.aiming = aiming;
    skillAmplitude = 0.1;
    system.update(world as never, 1 / 60);

    expect([captured.directionX, captured.directionZ]).toEqual([1, 0]);
    expect(captured.amplitude).toBe(0);

    skillAmplitude = 0.59;
    system.update(world as never, 1 / 60);
    expect([captured.directionX, captured.directionZ]).toEqual([-1, 0]);
    expect(captured.amplitude).toBeCloseTo(0.5, 6);
  });

  it('半血小怪经过抓取后进入携带，再按预览距离投掷并在重击落地时死亡', () => {
    const monsters = new TestBattlefieldMonsterGateway();
    const runtime = new BattlefieldCombatModuleRuntime(
      monsters,
      UNCONSTRAINED_SPATIAL_MOVEMENT,
    );

    runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, true, false, 1));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
    expect(runtime.preview.valid).toBe(true);
    expect(runtime.carrying).toBe(false);

    runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, false, true, 1));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
    expect(runtime.carrying).toBe(true);
    expect(monsters.carried).toBe(true);
    expect(Array.from(runtime.events.type.slice(0, runtime.events.count))).toContain(
      BattlefieldCombatEventType.EntityGrabbed,
    );

    runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Throw, true, false, 1));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
    expect(runtime.preview.valid).toBe(true);
    runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Throw, false, true, 1));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
    expect(runtime.thrown).toBe(true);

    for (let frame = 0; frame < 80 && runtime.thrown; frame++) {
      runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Throw, false, false, 0));
      runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
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
    const monsters = new TestBattlefieldMonsterGateway();
    const runtime = new BattlefieldCombatModuleRuntime(
      monsters,
      UNCONSTRAINED_SPATIAL_MOVEMENT,
    );
    grabTestMonster(runtime);
    runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Throw, false, true, 1));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
    monsters.hitEnabled = true;
    runtime.simulateThrown(1 / 60);
    runtime.resolveThrownCollision();

    expect(monsters.damageApplied).toBeGreaterThan(0);
    expect(monsters.knockbackApplied).toBeGreaterThan(0);
    expect(Array.from(runtime.events.type.slice(0, runtime.events.count))).toContain(
      BattlefieldCombatEventType.EntityImpact,
    );
  });

  it('目标标记出现后轻微滑动松手仍按锁定身份完成抓取', () => {
    const monsters = new TestBattlefieldMonsterGateway();
    monsters.directionSensitive = true;
    const runtime = new BattlefieldCombatModuleRuntime(
      monsters,
      UNCONSTRAINED_SPATIAL_MOVEMENT,
    );

    runtime.captureIntent(createTestCombatIntent(BattlefieldCombatModuleId.Grab, true, false, 1));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);
    expect(runtime.preview.valid).toBe(true);

    runtime.captureIntent(createTestCombatIntent(
      BattlefieldCombatModuleId.Grab,
      false,
      true,
      1,
      0.2,
      Math.sqrt(0.96),
    ));
    runtime.executeActions(TEST_BATTLEFIELD_PLAYER, 1 / 60);

    expect(runtime.carrying).toBe(true);
    expect(monsters.findCount).toBe(1);
    expect(monsters.lockedValidationCount).toBe(1);
  });
});
