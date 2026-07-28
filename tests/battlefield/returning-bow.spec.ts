import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import {
  BattlefieldArrowHitBuffer,
  type BattlefieldArrowCombatTarget,
  type BattlefieldArrowSweepQuery,
  type MutableBattlefieldArrowTargetPose,
} from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-arrow-query';
import { BattlefieldArrowState } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-arrow-state';
import { BattlefieldReturningBowRuntime } from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-returning-bow-runtime';
import {
  BATTLEFIELD_ARROW_VERTICES_PER_SLOT,
  createBattlefieldArrowBatchGeometry,
  writeBattlefieldArrow,
} from '../../assets/bundles/battlefield/equipment/projectile/geometry/battlefield-arrow-batch-geometry';
import { BattlefieldBowActionControl } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-bow-action-control';
import { BattlefieldBowAction } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-bow-action-state';
import { VanguardFacingPolicy } from '../../assets/player/vanguard/model/vanguard-facing-policy';
import { BattlefieldArrowAttachmentSystem } from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-arrow-attachment-system';
import { BattlefieldArrowPopulation } from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-arrow-population';

const OWNER = Object.freeze({
  entityId: 7,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  projectileOriginX: 0,
  projectileOriginY: 2.45,
  projectileOriginZ: 0,
  aimX: 0,
  aimY: 0,
  aimZ: 1,
  alive: true,
});

describe('归弦猎弓固定实体箭循环', () => {
  it('六支永久箭全部离手后按离开顺序自动召回且不复制', () => {
    const target = new ArrowTargetFixture();
    const bow = createBow(target);
    for (let index = 0; index < 6; index++) {
      fireQuickShot(bow);
      for (let frame = 0; frame < 9; frame++) {
        bow.update(0.05, OWNER);
      }
    }
    expect(bow.readyArrowCount).toBe(0);
    expect(bow.arrows.active.slice(0, 6)).toEqual(Uint8Array.of(1, 1, 1, 1, 1, 1));
    expect(bow.requestPrimaryAttack()).toBe(true);
    for (let frame = 0; frame < 30 && bow.readyArrowCount === 0; frame++) {
      bow.update(0.05, OWNER);
    }
    expect(bow.readyArrowCount).toBe(1);
    expect(bow.arrows.state[0]).toBe(BattlefieldArrowState.Ready);
  });

  it('连续扫掠命中后附着怪物并在主动召回时分别产生拔箭和回程伤害', () => {
    const target = new ArrowTargetFixture();
    target.sweepHitEnabled = true;
    const bow = createBow(target);
    fireQuickShot(bow);
    expect(bow.arrows.state[0]).toBe(BattlefieldArrowState.EmbeddedInMonster);
    expect(bow.damageEvents.count).toBe(1);
    bow.resolveDamageEvents();
    expect(target.damageCount).toBe(1);
    target.sweepHitEnabled = false;
    expect(bow.requestRecallAll()).toBe(true);
    expect(bow.damageEvents.count).toBe(1);
    bow.resolveDamageEvents();
    expect(target.damageCount).toBe(2);
    for (let frame = 0; frame < 20 && bow.readyArrowCount < 6; frame++) {
      bow.update(0.05, OWNER);
      bow.resolveDamageEvents();
    }
    expect(bow.readyArrowCount).toBe(6);
  });

  it('两支附着箭构成不重复弦线并遵守同线命中冷却', () => {
    const target = new ArrowTargetFixture();
    const bow = createBow(target);
    bow.arrows.state[0] = BattlefieldArrowState.EmbeddedInWorld;
    bow.arrows.state[1] = BattlefieldArrowState.EmbeddedInWorld;
    bow.arrows.positionX[0] = -2;
    bow.arrows.positionX[1] = 2;
    target.sweepHitEnabled = true;
    expect(bow.requestTether()).toBe(true);
    expect(bow.tethers.tetherCount).toBe(1);
    bow.update(0.05, OWNER);
    const firstCount = bow.damageEvents.count;
    bow.update(0.05, OWNER);
    expect(firstCount).toBe(1);
    expect(bow.damageEvents.count).toBe(1);
    expect(target.slowCount).toBe(1);
  });

  it('蓄力期间把右摇杆方向提交为角色朝向且禁用自动锁敌', () => {
    const control = new BattlefieldBowActionControl().write(
      BattlefieldBowAction.Charging,
      Math.PI * 0.5,
      0.6,
    );
    expect(control.facingPolicy).toBe(VanguardFacingPolicy.SoftTarget);
    expect(control.desiredHeading).toBeCloseTo(Math.PI * 0.5, 6);
    expect(control.movementScale).toBe(0.55);
    expect(control.maximumTurnSpeed).toBeGreaterThan(0);
    expect(control.autoTargetAllowed).toBe(false);
  });

  it('箭槽被折叠并重复召回后仍会完整恢复位置与可见色', () => {
    const geometry = createBattlefieldArrowBatchGeometry();
    for (let cycle = 0; cycle < 2; cycle++) {
      writeBattlefieldArrow(geometry, 0, 0, 1, 0, 0, 0, -1, false);
      writeBattlefieldArrow(geometry, 0, cycle + 1, 1, 0, 0, 0, 1, true);
    }
    const alphas: number[] = [];
    for (let vertex = 0; vertex < BATTLEFIELD_ARROW_VERTICES_PER_SLOT; vertex++) {
      alphas.push(geometry.colors[vertex * 4 + 3] ?? 0);
    }
    expect(alphas.every((alpha) => alpha === 1)).toBe(true);
    expect(new Set(geometry.positions.slice(
      0,
      BATTLEFIELD_ARROW_VERTICES_PER_SLOT * 3,
    )).size).toBeGreaterThan(3);
  });

  it('附着目标离开存活生命周期后落为世界箭且不跟随复用槽位', () => {
    const arrows = new BattlefieldArrowPopulation();
    const target = new ArrowTargetFixture();
    arrows.state[0] = BattlefieldArrowState.EmbeddedInMonster;
    arrows.positionX[0] = 5;
    arrows.positionY[0] = 1;
    arrows.positionZ[0] = 6;
    arrows.attachedPopulationId[0] = 3;
    arrows.attachedEntityId[0] = 11;
    target.poseAvailable = false;
    new BattlefieldArrowAttachmentSystem().update(arrows, target);
    expect(arrows.state[0]).toBe(BattlefieldArrowState.EmbeddedInWorld);
    expect(arrows.positionX[0]).toBe(5);
    expect(arrows.positionZ[0]).toBe(6);
    target.poseAvailable = true;
    target.poseX = 100;
    new BattlefieldArrowAttachmentSystem().update(arrows, target);
    expect(arrows.positionX[0]).toBe(5);
    expect(arrows.positionZ[0]).toBe(6);
  });
});

function createBow(target: BattlefieldArrowCombatTarget): BattlefieldReturningBowRuntime {
  return new BattlefieldReturningBowRuntime(
    BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.ReturningBow),
    target,
    OWNER.entityId,
  );
}

function fireQuickShot(bow: BattlefieldReturningBowRuntime): void {
  bow.setAttackHeld(true);
  expect(bow.requestPrimaryAttack()).toBe(true);
  bow.update(0.02, OWNER);
  bow.setAttackHeld(false);
  bow.update(0.02, OWNER);
}

class ArrowTargetFixture implements BattlefieldArrowCombatTarget {
  public sweepHitEnabled = false;
  public damageCount = 0;
  public slowCount = 0;
  public poseAvailable = true;
  public poseX = 0;

  public collectArrowSweepHits(
    query: Readonly<BattlefieldArrowSweepQuery>,
    result: BattlefieldArrowHitBuffer,
  ): number {
    result.reset();
    if (this.sweepHitEnabled) {
      result.include(3, 11, query.endX, query.endY, query.endZ, 0.5);
    }
    return result.count;
  }

  public writeArrowTargetPose(
    populationId: number,
    entityId: number,
    result: MutableBattlefieldArrowTargetPose,
  ): boolean {
    if (!this.poseAvailable || populationId !== 3 || entityId !== 11) {
      return false;
    }
    result.x = this.poseX;
    result.y = 0;
    result.z = 1;
    result.radius = 0.5;
    return true;
  }

  public damageMonster(): boolean {
    this.damageCount++;
    return true;
  }

  public applyArrowSlow(): boolean {
    this.slowCount++;
    return true;
  }

  public applyArrowPull(): boolean {
    return true;
  }
}
