import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { VenomLobberLifecyclePoseSystem } from '../../assets/bundles/common-monsters/entities/venom-lobber/animation/venom-lobber-lifecycle-pose-system';
import { VenomLobberCombatSystem } from '../../assets/bundles/common-monsters/entities/venom-lobber/behavior/venom-lobber-combat-system';
import { VenomBombSystem } from '../../assets/bundles/common-monsters/entities/venom-lobber/behavior/venom-bomb-system';
import {
  createVenomEffectGeometry,
  appendVenomEffectTopologyIndices,
  VenomEffectTopology,
  VENOM_BOMB_EFFECT_VERTEX_COUNT,
  VENOM_EFFECT_SLOT_VERTEX_COUNT,
  VENOM_WARNING_CIRCLE_SEGMENTS,
  VENOM_WARNING_CIRCLE_VERTEX_COUNT,
  writeVenomChargeEffectSlot,
  writeVenomBombEffectSlot,
  writeVenomCocoonEffectSlot,
  writeVenomDeathEffectSlot,
  writeVenomPoolEffectSlot,
} from '../../assets/bundles/common-monsters/entities/venom-lobber/geometry/venom-lobber-effect-geometry';
import { VENOM_POOL_OUTER_SEGMENTS } from '../../assets/bundles/common-monsters/entities/venom-lobber/geometry/venom-pool-geometry';
import { VENOM_LOBBER_MODEL_GEOMETRY } from '../../assets/bundles/common-monsters/entities/venom-lobber/geometry/venom-lobber-model-geometry';
import { VenomLobberAction } from '../../assets/bundles/common-monsters/entities/venom-lobber/model/venom-lobber-action';
import { VenomBombState } from '../../assets/bundles/common-monsters/entities/venom-lobber/model/venom-bomb-state';
import { VenomDeathEffectState } from '../../assets/bundles/common-monsters/entities/venom-lobber/model/venom-death-effect-state';
import { VenomPoolState } from '../../assets/bundles/common-monsters/entities/venom-lobber/model/venom-pool-state';
import { type VenomLobberCombatOptions } from '../../assets/bundles/common-monsters/entities/venom-lobber/model/venom-lobber-combat-options';
import { VenomLobberState } from '../../assets/bundles/common-monsters/entities/venom-lobber/model/venom-lobber-state';
import { VenomLobberLifeSystem } from '../../assets/bundles/common-monsters/entities/venom-lobber/population/venom-lobber-life-system';

const COMBAT = Object.freeze({
  detectionRadius: 50,
  disengageRadius: 60,
  preferredMinimumRange: 10,
  preferredMaximumRange: 20,
  pursuitSpeedMultiplier: 1.5,
  retreatSpeedMultiplier: 1.2,
  castWindupSeconds: 0.8,
  castRecoverySeconds: 0.5,
  minimumCooldownSeconds: 2,
  maximumCooldownSeconds: 4,
  meleeRange: 5,
  meleeDamage: 18,
  meleeWindupSeconds: 0.4,
  meleeRecoverySeconds: 0.5,
  meleeCooldownSeconds: 1.2,
  meleeLungeSpeedMultiplier: 2,
  projectileFlightSeconds: 1,
  projectileStartElevation: 6,
  blastRadius: 3,
  blastDamage: 10,
  poolRadius: 2.5,
  poolDurationSeconds: 5,
  poolDamagePerSecond: 2,
  poolMovementMultiplier: 0.6,
  catalystRadiusMultiplier: 1.5,
  catalystDamageMultiplier: 1.8,
  catalystDurationMultiplier: 1.4,
}) satisfies Readonly<VenomLobberCombatOptions>;

describe('Venom Lobber 技能与程序化模型', () => {
  it('拥有六足、卷尾与毒囊所需的精细硬分面和语义权重', () => {
    const model = VENOM_LOBBER_MODEL_GEOMETRY;
    expect(model.geometry.vertexCount).toBeGreaterThan(1000);
    expect(model.geometry.vertexCount).toBeLessThan(8000);
    expect(Array.from(model.tailWeights).some((value) => value > 0.9)).toBe(true);
    expect(Array.from(model.venomWeights).some((value) => value === 1)).toBe(true);
    expect(Array.from(model.legIds).some((value) => value === 6)).toBe(true);
    expect(Array.from(model.legSegmentIds).some((value) => value === 3)).toBe(true);
    expect(Array.from(model.legSegmentWeights).some((value) => value === 1)).toBe(true);
    expect(Array.from(model.strikeWeights).some((value) => value > 0.9)).toBe(true);
    for (let offset = 0; offset < model.geometry.normals.length; offset += 3) {
      expect(Math.hypot(
        model.geometry.normals[offset] ?? 0,
        model.geometry.normals[offset + 1] ?? 0,
        model.geometry.normals[offset + 2] ?? 0,
      )).toBeCloseTo(1, 5);
    }
  });

  it('统一生命周期姿态让毒茧破土全程不前移，并按阶段展开最终姿态', () => {
    const state = createVenomState();
    const pose = new VenomLobberLifecyclePoseSystem();
    state.data.vitality.state[0] = MonsterLifecycleState.Spawning;
    state.data.vitality.stateTime[0] = 0.1;
    pose.update(state, 0.01);
    expect(state.data.animation.rootElevation[0]).toBe(-12);
    expect(state.data.animation.rootForward[0]).toBe(0);
    expect(state.data.animation.cocoonOpen[0]).toBe(0);

    state.data.vitality.stateTime[0] = 0.37;
    pose.update(state, 0.01);
    expect(state.data.animation.cocoonOpen[0]).toBeGreaterThan(0);
    expect(state.data.animation.cocoonOpen[0]).toBeLessThan(1);
    expect(state.data.animation.rootForward[0]).toBe(0);

    state.data.vitality.stateTime[0] = 0.82;
    pose.update(state, 0.01);
    expect(state.data.animation.lifecycleLegProgress[0]).toBeGreaterThan(0);
    expect(state.data.animation.bodyCompression[0]).toBeGreaterThan(0.32);

    state.data.vitality.stateTime[0] = 1.45;
    pose.update(state, 0.01);
    expect(state.data.animation.rootElevation[0]).toBeCloseTo(0, 6);
    expect(state.data.animation.bodyCompression[0]).toBeCloseTo(1, 6);
    expect(state.data.animation.venomSacScale[0]).toBeCloseTo(1, 6);
    expect(state.data.animation.lifecycleLegProgress[0]).toBe(1);
  });

  it('死亡姿态保持朝上并完成六足失力、毒囊泄压和残躯塌陷', () => {
    const state = createVenomState();
    const pose = new VenomLobberLifecyclePoseSystem();
    state.data.vitality.state[0] = MonsterLifecycleState.Dying;
    state.data.vitality.stateTime[0] = 0.4;
    pose.update(state, 0.01);
    expect(state.data.animation.lifecycleLegProgress[0]).toBeGreaterThan(0);
    expect(state.data.animation.lifecycleLegProgress[0]).toBeLessThan(1);

    state.data.vitality.stateTime[0] = 0.84;
    pose.update(state, 0.01);
    expect(state.data.animation.lifecycleLegProgress[0]).toBe(0);
    expect(state.data.animation.venomSacScale[0]).toBeLessThan(1);

    state.data.vitality.stateTime[0] = 1.55;
    pose.update(state, 0.01);
    expect(state.data.animation.rootElevation[0]).toBeCloseTo(-0.9, 6);
    expect(state.data.animation.bodyCompression[0]).toBeCloseTo(0.35, 6);
    expect(state.data.animation.venomSacScale[0]).toBeCloseTo(0.25, 6);
  });

  it('毒茧使用土包、裂纹和六块甲壳，死亡残迹不再生成飞溅物', () => {
    const geometry = createVenomEffectGeometry(1);
    writeVenomCocoonEffectSlot(geometry, 0, 0, 0, 3.4, 0, 0, 7);
    expect(maximumSlotHeight(geometry.positions, 0)).toBeGreaterThan(0.8);
    writeVenomCocoonEffectSlot(geometry, 0, 0, 0, 3.4, 1, 0.5, 7);
    expect(maximumSlotRadius(geometry.positions, 0)).toBeGreaterThan(0.5);

    const deaths = new VenomDeathEffectState(1);
    deaths.spawn(0, 0, 0, 1);
    writeVenomDeathEffectSlot(geometry, 0, deaths, 0);
    expect(maximumSlotHeight(geometry.positions, 0)).toBeLessThan(0.1);
  });

  it('死亡残迹只在残躯塌陷阶段开始时创建', () => {
    const state = createVenomState();
    const effects = new VenomBombSystem(1, COMBAT);
    const life = new VenomLobberLifeSystem(effects);
    state.data.vitality.state[0] = MonsterLifecycleState.Alive;
    state.data.vitality.health[0] = 1;
    life.damage(state, 0, 1);

    life.update(state, 1.04);
    expect(effects.deaths.active[0]).toBe(0);
    life.update(state, 0.02);
    expect(effects.deaths.active[0]).toBe(1);
  });

  it('尾部蓄力球会从接近零尺寸平滑成长，并以大尺寸毒弹离开发射点', () => {
    const geometry = createVenomEffectGeometry(1);
    writeVenomChargeEffectSlot(geometry, 0, 2, 3, 7, 0.05, 0);
    const initialRadius = maximumBombRadius(geometry.positions, 2, 3, 7);
    writeVenomChargeEffectSlot(geometry, 0, 2, 3, 7, 1, 1);
    const chargedRadius = maximumBombRadius(geometry.positions, 2, 3, 7);
    expect(chargedRadius).toBeGreaterThan(initialRadius * 6);

    const bombs = new VenomBombState(1);
    expect(bombs.spawn(2, 3, 8, 9, 7, 18, 1)).toBe(true);
    writeVenomBombEffectSlot(geometry, 0, bombs, 0, 3);
    expect(maximumBombRadius(geometry.positions, 2, 3, 7)).toBeGreaterThan(1.7);
  });

  it('落点预警只绘制平滑且颜色一致的绿色圆环', () => {
    expect(VENOM_WARNING_CIRCLE_SEGMENTS).toBeGreaterThanOrEqual(32);
    const bombs = new VenomBombState(1);
    expect(bombs.spawn(0, 0, 10, 4, 6, 16, 1)).toBe(true);
    const geometry = createVenomEffectGeometry(1);
    writeVenomBombEffectSlot(geometry, 0, bombs, 0, 3);
    const firstMarkerVertex = VENOM_BOMB_EFFECT_VERTEX_COUNT;
    for (let vertex = 0; vertex < VENOM_WARNING_CIRCLE_VERTEX_COUNT; vertex++) {
      const colorOffset = (firstMarkerVertex + vertex) * 4;
      expect(geometry.colors[colorOffset]).toBeCloseTo(0.08, 5);
      expect(geometry.colors[colorOffset + 1]).toBeCloseTo(1, 5);
      expect(geometry.colors[colorOffset + 2]).toBeCloseTo(0.14, 5);
    }
  });

  it('效果批次只提交当前阶段真正可见的子拓扑', () => {
    const indices = new Uint32Array(VENOM_EFFECT_SLOT_VERTEX_COUNT * 3);
    const chargeCount = appendVenomEffectTopologyIndices(
      indices,
      0,
      0,
      VenomEffectTopology.Charge,
    );
    const projectileCount = appendVenomEffectTopologyIndices(
      indices,
      chargeCount,
      1,
      VenomEffectTopology.Projectile,
    ) - chargeCount;
    const poolCount = appendVenomEffectTopologyIndices(
      indices,
      chargeCount + projectileCount,
      2,
      VenomEffectTopology.Pool,
    ) - chargeCount - projectileCount;
    expect(chargeCount).toBe(VENOM_BOMB_EFFECT_VERTEX_COUNT);
    expect(projectileCount).toBe(
      VENOM_BOMB_EFFECT_VERTEX_COUNT + VENOM_WARNING_CIRCLE_VERTEX_COUNT,
    );
    expect(poolCount).toBe(
      VENOM_EFFECT_SLOT_VERTEX_COUNT
        - VENOM_BOMB_EFFECT_VERTEX_COUNT
        - VENOM_WARNING_CIRCLE_VERTEX_COUNT,
    );
  });

  it('毒池使用 18 段统一中心色与整套催化色板，不再交替绘制扇区', () => {
    expect(VENOM_POOL_OUTER_SEGMENTS).toBe(18);
    const pools = new VenomPoolState(1);
    pools.spawn(0, 0, 3, 5, false);
    pools.elapsed[0] = 1;
    const geometry = createVenomEffectGeometry(1);
    writeVenomPoolEffectSlot(geometry, 0, pools, 0);
    const poolVertexOffset = VENOM_BOMB_EFFECT_VERTEX_COUNT
      + VENOM_WARNING_CIRCLE_VERTEX_COUNT;
    for (let segment = 0; segment < VENOM_POOL_OUTER_SEGMENTS; segment++) {
      const colorOffset = (poolVertexOffset + segment * 3) * 4;
      expect(geometry.colors[colorOffset]).toBeCloseTo(0x12 / 255, 5);
      expect(geometry.colors[colorOffset + 1]).toBeCloseTo(0x38 / 255, 5);
      expect(geometry.colors[colorOffset + 2]).toBeCloseTo(0x2a / 255, 5);
    }

    pools.catalyzed[0] = 1;
    writeVenomPoolEffectSlot(geometry, 0, pools, 0);
    expect(geometry.colors[poolVertexOffset * 4]).toBeCloseTo(0x35 / 255, 5);
    expect(geometry.colors[poolVertexOffset * 4 + 1]).toBeCloseTo(0x45 / 255, 5);
    expect(geometry.colors[poolVertexOffset * 4 + 2]).toBeCloseTo(0x1d / 255, 5);
  });

  it('玩家进入尾兽近身范围时会扑击并结算一次近战伤害', () => {
    const state = new VenomLobberState({
      count: 1,
      initialPopulationCount: 1,
      spawnArea: Object.freeze({ centerX: 0, centerY: 0, width: 2, height: 2 }),
      seed: 17,
      surfaceMaterialTemplate: {} as never,
    });
    state.data.vitality.state[0] = MonsterLifecycleState.Alive;
    state.data.combat.attackLock[0] = 0;
    state.data.combat.meleeCooldown[0] = 0;
    const combat = new VenomLobberCombatSystem(1, COMBAT);
    combat.synchronizeTarget({ x: 3, y: 0, collisionRadius: 0.4 });
    combat.update(state, 0.01);
    expect(state.data.behavior.action[0]).toBe(VenomLobberAction.MeleeWindup);

    let damage = combat.consumeDamage();
    for (let frame = 0; frame < 5; frame++) {
      combat.update(state, 0.1);
      damage += combat.consumeDamage();
    }
    expect(damage).toBe(COMBAT.meleeDamage);
    expect(state.data.behavior.action[0]).toBe(VenomLobberAction.MeleeRecover);
  });

  it('不同个体的弧高会生成明显不同的抛物线顶点高度', () => {
    const bombs = new VenomBombState(2);
    expect(bombs.spawn(0, 0, 10, 0, 6, 10, 1)).toBe(true);
    expect(bombs.spawn(0, 0, 10, 0, 6, 22, 1)).toBe(true);
    bombs.elapsed[0] = 0.5;
    bombs.elapsed[1] = 0.5;
    const geometry = createVenomEffectGeometry(2);
    writeVenomBombEffectSlot(geometry, 0, bombs, 0, 3);
    writeVenomBombEffectSlot(geometry, 1, bombs, 1, 3);

    const firstHeight = maximumSlotHeight(geometry.positions, 0);
    const secondHeight = maximumSlotHeight(geometry.positions, 1);
    expect(secondHeight - firstHeight).toBeGreaterThan(10);
  });

  it('毒弹命中既有酸池后催化爆炸，并让池内玩家持续受伤和减速', () => {
    const system = new VenomBombSystem(2, COMBAT);
    expect(system.spawn(0, 0, 10, 0, 14, COMBAT.projectileStartElevation)).toBe(true);
    system.update(1, true, 10, 0, 0.4);
    const firstImpactDamage = system.consumeDamage();
    expect(firstImpactDamage).toBeGreaterThanOrEqual(COMBAT.blastDamage);

    expect(system.spawn(0, 0, 10, 0, 18, COMBAT.projectileStartElevation)).toBe(true);
    system.update(1, true, 10, 0, 0.4);
    const catalyzedDamage = system.consumeDamage();
    expect(catalyzedDamage).toBeGreaterThan(firstImpactDamage);
    expect(Array.from(system.pools.catalyzed).some((value) => value === 1)).toBe(true);

    system.update(0.1, true, 10, 0, 0.4);
    expect(system.movementMultiplier).toBeLessThan(1);
    expect(system.consumeDamage()).toBeGreaterThan(0);
  });
});

function maximumSlotHeight(positions: Float32Array, slotIndex: number): number {
  const firstVertex = slotIndex * VENOM_EFFECT_SLOT_VERTEX_COUNT;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let vertex = 0; vertex < VENOM_EFFECT_SLOT_VERTEX_COUNT; vertex++) {
    maximum = Math.max(maximum, positions[(firstVertex + vertex) * 3 + 2] ?? 0);
  }
  return maximum;
}

function maximumBombRadius(
  positions: Float32Array,
  centerX: number,
  centerY: number,
  centerZ: number,
): number {
  let maximum = 0;
  for (let vertex = 0; vertex < VENOM_BOMB_EFFECT_VERTEX_COUNT; vertex++) {
    const offset = vertex * 3;
    maximum = Math.max(maximum, Math.hypot(
      (positions[offset] ?? 0) - centerX,
      (positions[offset + 1] ?? 0) - centerY,
      (positions[offset + 2] ?? 0) - centerZ,
    ));
  }
  return maximum;
}

function maximumSlotRadius(positions: Float32Array, slotIndex: number): number {
  const firstVertex = slotIndex * VENOM_EFFECT_SLOT_VERTEX_COUNT;
  let maximum = 0;
  for (let vertex = 0; vertex < VENOM_EFFECT_SLOT_VERTEX_COUNT; vertex++) {
    const offset = (firstVertex + vertex) * 3;
    maximum = Math.max(maximum, Math.hypot(
      positions[offset] ?? 0,
      positions[offset + 1] ?? 0,
    ));
  }
  return maximum;
}

function createVenomState(): VenomLobberState {
  return new VenomLobberState({
    count: 1,
    initialPopulationCount: 1,
    spawnArea: Object.freeze({ centerX: 0, centerY: 0, width: 2, height: 2 }),
    seed: 17,
    surfaceMaterialTemplate: {} as never,
  });
}
