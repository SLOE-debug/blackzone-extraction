import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import {
  BattlefieldArrowHitBuffer,
  type BattlefieldArrowAimQuery,
  type BattlefieldArrowCombatTarget,
  type BattlefieldArrowSweepQuery,
  type BattlefieldTetherQuery,
  type MutableBattlefieldArrowAimTarget,
  type MutableBattlefieldArrowTargetPose,
} from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-arrow-query';
import { BattlefieldTetherHitBuffer } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-tether-hit-buffer';
import { BattlefieldArrowState } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-arrow-state';
import { BattlefieldReturningBowRuntime } from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-returning-bow-runtime';
import { BATTLEFIELD_MAXIMUM_TETHER_COUNT } from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-arrow-tether-system';
import {
  BATTLEFIELD_ARROW_VERTICES_PER_SLOT,
  BATTLEFIELD_TETHER_LEAD_VERTICES_PER_SLOT,
  BATTLEFIELD_TETHER_VERTICES_PER_SLOT,
  createBattlefieldArrowBatchGeometry,
  writeBattlefieldArrow,
  writeBattlefieldTether,
  writeBattlefieldTetherLead,
} from '../../assets/bundles/battlefield/equipment/projectile/geometry/battlefield-arrow-batch-geometry';
import { BattlefieldBowActionControl } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-bow-action-control';
import { BattlefieldBowAction } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-bow-action-state';
import { VanguardFacingPolicy } from '../../assets/player/vanguard/model/vanguard-facing-policy';
import { BattlefieldArrowAttachmentSystem } from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-arrow-attachment-system';
import {
  BATTLEFIELD_ARROW_CAPACITY,
  BattlefieldArrowPopulation,
} from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-arrow-population';
import {
  findArrowVerticalCapsuleContactProgress,
} from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-arrow-capsule-intersection';
import { calculateRecallSpeed } from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-arrow-recall-system';
import {
  findTetherVerticalRangeOverlapProgress,
} from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-tether-range-overlap';
import {
  BATTLEFIELD_TETHER_COLLISION_RADIUS,
  BATTLEFIELD_TETHER_WORLD_Y,
} from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-tether-config';

const OWNER = Object.freeze({
  entityId: 7,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  projectileOriginX: 0,
  projectileOriginY: 2.45,
  projectileOriginZ: 0,
  aimX: 0,
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

  it('没有平面锁敌时仍把箭垂直瞄向远处地表而非水平发射', () => {
    const bow = createBow(new ArrowTargetFixture());
    fireQuickShot(bow);
    expect(bow.arrows.directionY[0]).toBeLessThan(0);
  });

  it('面向怪物射击时只修正垂直方向并瞄准躯干中心', () => {
    const target = new ArrowTargetFixture();
    target.aimAvailable = true;
    const bow = createBow(target);
    fireQuickShot(bow);
    expect(bow.arrows.directionX[0]).toBeCloseTo(0);
    expect(bow.arrows.directionZ[0]).toBeGreaterThan(0);
    expect(bow.arrows.directionY[0]).toBeLessThan(0);
  });

  it('XZ 投影穿过怪物但高度越过胶囊体时不产生三维接触', () => {
    expect(findArrowVerticalCapsuleContactProgress(
      0, 5, 0,
      0, 5, 2,
      0, 1, 1,
      0.5,
      0.6,
    )).toBe(-1);
    const contactProgress = findArrowVerticalCapsuleContactProgress(
      0, 1, 0,
      0, 1, 2,
      0, 1, 1,
      0.5,
      0.6,
    );
    expect(contactProgress).toBeGreaterThanOrEqual(0);
    expect(contactProgress * 2).toBeCloseTo(0.4, 2);
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
    for (let frame = 0; frame < 4; frame++) {
      bow.update(0.01, OWNER);
    }
    expect(firstCount).toBe(1);
    expect(bow.damageEvents.count).toBe(1);
    expect(target.slowCount).toBe(1);
    expect(target.tetherQueryCount).toBe(1);
    expect(target.lastTetherStartY).toBeCloseTo(BATTLEFIELD_TETHER_WORLD_Y);
    expect(target.lastTetherEndY).toBeCloseTo(BATTLEFIELD_TETHER_WORLD_Y);
    expect(target.lastTetherRadius).toBe(BATTLEFIELD_TETHER_COLLISION_RADIUS);
    expect(target.arrowSweepQueryCount).toBe(0);
    bow.update(0.01, OWNER);
    expect(target.tetherQueryCount).toBe(2);
  });

  it('六支锚点派生五条弦线并在查询帧内同步完成全部判定', () => {
    const target = new ArrowTargetFixture();
    const bow = createBow(target);
    for (let index = 0; index < 6; index++) {
      bow.arrows.state[index] = BattlefieldArrowState.EmbeddedInWorld;
      bow.arrows.positionX[index] = index * 2;
    }

    expect(BATTLEFIELD_MAXIMUM_TETHER_COUNT).toBe(5);
    expect(bow.requestTether()).toBe(true);
    expect(bow.tethers.tetherCount).toBe(BATTLEFIELD_MAXIMUM_TETHER_COUNT);

    bow.update(0.05, OWNER);
    expect(target.tetherQueryCount).toBe(BATTLEFIELD_MAXIMUM_TETHER_COUNT);
    for (let frame = 0; frame < 4; frame++) {
      bow.update(0.01, OWNER);
    }
    expect(target.tetherQueryCount).toBe(BATTLEFIELD_MAXIMUM_TETHER_COUNT);
    bow.update(0.01, OWNER);
    expect(target.tetherQueryCount).toBe(BATTLEFIELD_MAXIMUM_TETHER_COUNT * 2);
  });

  it('高度不同的两个锚点仍生成地面弦线并伤害全部平面重叠目标', () => {
    const target = new ArrowTargetFixture();
    const bow = createBow(target);
    bow.arrows.state[0] = BattlefieldArrowState.EmbeddedInMonster;
    bow.arrows.positionX[0] = -8;
    bow.arrows.positionY[0] = 2.4;
    bow.arrows.positionZ[0] = 0;
    bow.arrows.attachedPopulationId[0] = 3;
    bow.arrows.attachedEntityId[0] = 11;
    bow.arrows.attachmentOffsetX[0] = -8;
    bow.arrows.attachmentOffsetY[0] = 1.4;
    bow.arrows.attachmentOffsetZ[0] = -1;
    bow.arrows.state[1] = BattlefieldArrowState.EmbeddedInWorld;
    bow.arrows.positionX[1] = 8;
    bow.arrows.positionY[1] = 0.1;
    bow.arrows.positionZ[1] = 0;
    target.tetherHits = [
      { populationId: 1, entityId: 10, progress: 0.2 },
      { populationId: 1, entityId: 11, progress: 0.4 },
      { populationId: 1, entityId: 12, progress: 0.6 },
      { populationId: 1, entityId: 13, progress: 0.8 },
    ];

    expect(bow.requestTether()).toBe(true);
    bow.update(0.05, OWNER);

    expect(bow.damageEvents.count).toBe(4);
    expect(target.slowCount).toBe(4);
    expect(target.lastTetherStartY).toBeCloseTo(BATTLEFIELD_TETHER_WORLD_Y);
    expect(target.lastTetherEndY).toBeCloseTo(BATTLEFIELD_TETHER_WORLD_Y);
  });

  it('弦网按箭矢 XZ 投影选择最近锚点而不受附着高度影响', () => {
    const bow = createBow(new ArrowTargetFixture());
    for (let index = 0; index < 3; index++) {
      bow.arrows.state[index] = BattlefieldArrowState.EmbeddedInWorld;
    }
    bow.arrows.positionX[0] = 0;
    bow.arrows.positionY[0] = 0;
    bow.arrows.positionX[1] = 1;
    bow.arrows.positionY[1] = 100;
    bow.arrows.positionX[2] = 2;
    bow.arrows.positionY[2] = 0;

    expect(bow.requestTether()).toBe(true);
    expect(bow.tethers.startArrowIndex[0]).toBe(0);
    expect(bow.tethers.endArrowIndex[0]).toBe(1);
  });

  it('弦线重叠按平面最近点对应高度判断脚底到身体顶部的显式范围', () => {
    expect(findTetherVerticalRangeOverlapProgress(
      -2, 1, 0,
      2, 1, 0,
      0, 0.4,
      0, 1.5,
      0.5,
    )).toBeCloseTo(0.5);
    expect(findTetherVerticalRangeOverlapProgress(
      -2, 3, 0,
      2, 3, 0,
      0, 0.4,
      0, 1.5,
      0.5,
    )).toBe(-1);
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
      writeBattlefieldArrow(geometry, 0, 0, 1, 0, 0, 0, -1, false, 1);
      writeBattlefieldArrow(geometry, 0, cycle + 1, 1, 0, 0, 0, 1, true, 1.5);
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

  it('附着目标死亡期间继续跟随，完成生命周期后才落为可见地面箭', () => {
    const arrows = new BattlefieldArrowPopulation();
    const target = new ArrowTargetFixture();
    arrows.state[0] = BattlefieldArrowState.EmbeddedInMonster;
    arrows.positionX[0] = 5;
    arrows.positionY[0] = 1;
    arrows.positionZ[0] = 6;
    arrows.attachedPopulationId[0] = 3;
    arrows.attachedEntityId[0] = 11;
    arrows.attachmentOffsetX[0] = 5;
    arrows.attachmentOffsetZ[0] = 5;
    target.poseX = 3;
    new BattlefieldArrowAttachmentSystem().update(arrows, target);
    expect(arrows.positionX[0]).toBe(8);
    target.poseAvailable = false;
    new BattlefieldArrowAttachmentSystem().update(arrows, target);
    expect(arrows.state[0]).toBe(BattlefieldArrowState.EmbeddedInWorld);
    expect(arrows.positionX[0]).toBe(8);
    expect(arrows.positionY[0]).toBeGreaterThan(0);
    expect(arrows.directionY[0]).toBeLessThan(0);
    expect(arrows.attachedPopulationId[0]).toBe(0);
    expect(arrows.positionZ[0]).toBe(6);
    target.poseAvailable = true;
    target.poseX = 100;
    new BattlefieldArrowAttachmentSystem().update(arrows, target);
    expect(arrows.positionX[0]).toBe(8);
    expect(arrows.positionZ[0]).toBe(6);
  });

  it('远距离召回速度高于近距离且弦线拥有交叉厚度和有效透明度', () => {
    expect(calculateRecallSpeed(24, 28, 68, 20))
      .toBeGreaterThan(calculateRecallSpeed(6, 28, 68, 20));
    const geometry = createBattlefieldArrowBatchGeometry();
    writeBattlefieldTether(geometry, 0, -12, 0.1, 0, 12, 0.1, 0, true, 0.08);
    const first = BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT;
    const tetherPositions = geometry.positions.slice(first * 3, (first + 12) * 3);
    const tetherAlphas = geometry.colors.slice(first * 4, (first + 12) * 4)
      .filter((_, index) => index % 4 === 3);
    expect(geometry.positions[first * 3 + 1])
      .toBeCloseTo(0.1);
    expect(Math.max(...tetherPositions) - Math.min(...tetherPositions)).toBeGreaterThan(0.15);
    expect([...tetherAlphas].every((alpha) => alpha === 1)).toBe(true);
  });

  it('怪物附着箭的视觉引线连接箭高与地面弦线高度', () => {
    const geometry = createBattlefieldArrowBatchGeometry();
    writeBattlefieldTetherLead(geometry, 0, 2, 2.4, 0.16, 3, true, 0.025);
    const first = BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT
      + BATTLEFIELD_MAXIMUM_TETHER_COUNT * BATTLEFIELD_TETHER_VERTICES_PER_SLOT;
    const yValues: number[] = [];
    for (let vertex = first; vertex < first + BATTLEFIELD_TETHER_LEAD_VERTICES_PER_SLOT; vertex++) {
      yValues.push(geometry.positions[vertex * 3 + 1] ?? 0);
    }
    expect(Math.min(...yValues)).toBeCloseTo(0.16);
    expect(Math.max(...yValues)).toBeCloseTo(2.4);
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
  public aimAvailable = false;
  public arrowSweepQueryCount = 0;
  public tetherQueryCount = 0;
  public lastTetherStartY = 0;
  public lastTetherEndY = 0;
  public lastTetherRadius = 0;
  public tetherHits: readonly TetherHitFixture[] = [];

  public writeBestArrowAimTarget(
    _query: Readonly<BattlefieldArrowAimQuery>,
    result: MutableBattlefieldArrowAimTarget,
  ): boolean {
    result.x = 0;
    result.y = 1;
    result.z = 10;
    return this.aimAvailable;
  }

  public collectArrowSweepHits(
    query: Readonly<BattlefieldArrowSweepQuery>,
    result: BattlefieldArrowHitBuffer,
  ): number {
    this.arrowSweepQueryCount++;
    result.reset();
    if (this.sweepHitEnabled) {
      result.include(3, 11, query.endX, query.endY, query.endZ, 0.5);
    }
    return result.count;
  }

  public collectTetherOverlapHits(
    query: Readonly<BattlefieldTetherQuery>,
    result: BattlefieldTetherHitBuffer,
  ): number {
    this.tetherQueryCount++;
    this.lastTetherStartY = query.startY;
    this.lastTetherEndY = query.endY;
    this.lastTetherRadius = query.radius;
    result.reset();
    for (const hit of this.tetherHits) {
      result.include(
        hit.populationId,
        hit.entityId,
        query.startX + (query.endX - query.startX) * hit.progress,
        query.startZ + (query.endZ - query.startZ) * hit.progress,
      );
    }
    if (this.sweepHitEnabled && this.tetherHits.length === 0) {
      result.include(3, 11, query.endX, query.endZ);
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
    result.centerX = this.poseX;
    result.centerY = 1;
    result.centerZ = 1;
    result.radius = 0.5;
    result.halfHeight = 0.5;
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

interface TetherHitFixture {
  readonly populationId: number;
  readonly entityId: number;
  readonly progress: number;
}
