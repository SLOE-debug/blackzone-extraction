import { describe, expect, it } from 'vitest';
import {
  BATTLEFIELD_EQUIPMENT_LIBRARY,
  getBattlefieldWeaponPrototype,
} from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { createWeaponAmmunition } from '../../assets/bundles/battlefield/equipment/model/weapon-ammunition';
import { WeaponAmmunitionReserve } from '../../assets/bundles/battlefield/equipment/model/weapon-ammunition-reserve';
import { WeaponAmmunitionInventory } from '../../assets/bundles/battlefield/equipment/model/weapon-ammunition-inventory';
import { BattlefieldWeaponActionState } from '../../assets/bundles/battlefield/equipment/combat/battlefield-weapon-action-state';
import {
  BattlefieldWeaponAttackExecutor,
  BattlefieldWeaponAttackResult,
} from '../../assets/bundles/battlefield/equipment/combat/battlefield-weapon-attack-executor';
import { writeBattlefieldWeaponMuzzlePose } from '../../assets/bundles/battlefield/equipment/combat/battlefield-weapon-muzzle-pose';
import {
  BATTLEFIELD_PROJECTILE_TOPOLOGY,
  writeBattlefieldProjectilePositions,
} from '../../assets/bundles/battlefield/equipment/projectile/geometry/battlefield-projectile-geometry';
import {
  BattlefieldProjectileState,
  calculateProjectileCapacity,
} from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-projectile-state';
import { writeBattlefieldProjectileDirection } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-projectile-trajectory';
import {
  getWeaponShotProjectileCount,
  writeBattlefieldShotProjectileDirection,
} from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-weapon-shot-pattern';
import {
  AmmunitionType,
  WeaponAction,
  WeaponGrip,
  WeaponProjectileVisual,
  WeaponShotPatternType,
} from '../../assets/core/equipment/equipment';
import { VanguardWeaponPose } from '../../assets/player/vanguard/model/vanguard-weapon-pose';
import { VanguardWeaponAction } from '../../assets/player/vanguard/model/vanguard-weapon-action';
import {
  toVanguardWeaponAction,
  toVanguardWeaponPose,
} from '../../assets/bundles/battlefield/scene/battlefield-vanguard-weapon-adapter';

describe('玩家武器运行时模型', () => {
  it('只在场景边界把中立武器语义适配为 Vanguard 动画枚举', () => {
    expect(toVanguardWeaponPose(null)).toBe(VanguardWeaponPose.Unarmed);
    expect(toVanguardWeaponPose(WeaponGrip.Handgun)).toBe(VanguardWeaponPose.Handgun);
    expect(toVanguardWeaponPose(WeaponGrip.LongGun)).toBe(VanguardWeaponPose.LongGun);
    expect(toVanguardWeaponAction(WeaponAction.Ready)).toBe(VanguardWeaponAction.Ready);
    expect(toVanguardWeaponAction(WeaponAction.Fire)).toBe(VanguardWeaponAction.Fire);
    expect(toVanguardWeaponAction(WeaponAction.Reload)).toBe(VanguardWeaponAction.Reload);
  });

  it('动作状态独立管理攻击进度与射速冷却', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const ammunition = createWeaponAmmunition(
      definition.ammunition,
      new WeaponAmmunitionReserve(),
    );
    const action = new BattlefieldWeaponActionState();

    expect(action.canFire(ammunition)).toBe(true);
    expect(ammunition.tryConsumeShot()).toBe(true);
    action.markFired(definition, ammunition);
    expect(action.getAction(definition, ammunition)).toBe(WeaponAction.Fire);
    expect(action.getProgress(definition, ammunition)).toBe(0);

    action.update(definition.attackAnimationSeconds * 0.5, definition, ammunition);
    expect(action.getProgress(definition, ammunition)).toBeCloseTo(0.5, 6);
    expect(action.canFire(ammunition)).toBe(false);
    action.update(definition.fireIntervalSeconds, definition, ammunition);
    expect(action.getAction(definition, ammunition)).toBe(WeaponAction.Ready);
    expect(action.canFire(ammunition)).toBe(true);
  });

  it('射击求解器按武器分布生成弹体且不拥有渲染资源', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.PumpShotgun);
    const ammunition = createWeaponAmmunition(
      definition.ammunition,
      new WeaponAmmunitionReserve(),
    );
    const directions: number[] = [];
    const result = new BattlefieldWeaponAttackExecutor().execute(
      definition,
      { muzzleX: 1, muzzleY: 2, muzzleZ: 3 },
      {
        directionX: 0,
        directionZ: 1,
        targetElevation: 2.5,
        targetDistance: 8,
      },
      ammunition,
      {
        spawn: (_x, _y, _z, directionX, directionY, directionZ) => {
          directions.push(directionX, directionY, directionZ);
        },
      },
    );

    expect(result).toBe(BattlefieldWeaponAttackResult.Fired);
    expect(directions).toHaveLength(27);
    for (let offset = 0; offset < directions.length; offset += 3) {
      expect(Math.hypot(
        directions[offset] ?? 0,
        directions[offset + 1] ?? 0,
        directions[offset + 2] ?? 0,
      )).toBeCloseTo(1, 6);
    }
    expect(ammunition.roundsRemaining).toBe(4);
  });

  it('没有纵向候选时从真实枪口严格水平射击', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const ammunition = createWeaponAmmunition(
      definition.ammunition,
      new WeaponAmmunitionReserve(),
    );
    const directions: number[] = [];
    new BattlefieldWeaponAttackExecutor().execute(
      definition,
      { muzzleX: 3, muzzleY: 4.25, muzzleZ: -2 },
      {
        directionX: Math.SQRT1_2,
        directionZ: Math.SQRT1_2,
        targetElevation: null,
        targetDistance: null,
      },
      ammunition,
      {
        spawn: (_x, _y, _z, directionX, directionY, directionZ) => {
          directions.push(directionX, directionY, directionZ);
        },
      },
    );

    expect(directions[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(directions[1]).toBe(0);
    expect(directions[2]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it('手枪耗尽八发后必须消耗拾取的备用弹药才能重新装填', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const reserve = new WeaponAmmunitionReserve();
    const ammunition = createWeaponAmmunition(definition.ammunition, reserve);

    for (let shot = 0; shot < 8; shot++) {
      expect(ammunition.tryConsumeShot()).toBe(true);
    }
    expect(ammunition.tryConsumeShot()).toBe(false);
    expect(ammunition.beginReload()).toBe(false);

    reserve.add(AmmunitionType.FiftyActionExpress, 6);
    expect(ammunition.beginReload()).toBe(true);
    ammunition.update(1.08);
    expect(ammunition.roundsRemaining).toBe(6);
    expect(ammunition.reserveRounds).toBe(0);
  });

  it('霰弹枪耗尽五发后按单发节奏连续装填管式弹仓', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.PumpShotgun);
    const reserve = new WeaponAmmunitionReserve();
    reserve.add(AmmunitionType.TwelveGauge, 5);
    const ammunition = createWeaponAmmunition(definition.ammunition, reserve);

    for (let shot = 0; shot < 5; shot++) {
      expect(ammunition.tryConsumeShot()).toBe(true);
    }
    expect(ammunition.empty).toBe(true);
    expect(ammunition.tryConsumeShot()).toBe(false);
    expect(ammunition.beginReload()).toBe(true);
    ammunition.update(0.31);
    expect(ammunition.reloadProgress).toBeCloseTo(0.5, 6);
    ammunition.update(0.31);
    expect(ammunition.roundsRemaining).toBe(1);
    ammunition.update(0.62 * 4);
    expect(ammunition.roundsRemaining).toBe(5);
    expect(ammunition.reserveRounds).toBe(0);
    expect(ammunition.reloading).toBe(false);
  });

  it('再次拾取同款枪时创建全新满弹仓，不复用已经打空的旧实例', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const inventory = new WeaponAmmunitionInventory();
    const firstWeapon = inventory.createFreshMagazine(definition);
    inventory.provisionFirstAcquisition(definition);
    for (let shot = 0; shot < definition.ammunition.capacity; shot++) {
      expect(firstWeapon.tryConsumeShot()).toBe(true);
    }
    expect(firstWeapon.empty).toBe(true);

    const replacement = inventory.createFreshMagazine(definition);
    inventory.provisionFirstAcquisition(definition);

    expect(replacement).not.toBe(firstWeapon);
    expect(replacement.roundsRemaining).toBe(definition.ammunition.capacity);
    expect(replacement.reserveRounds).toBe(definition.ammunition.initialReserveRounds);
  });

  it('不同枪型首次拾取会按自身口径发放充足备用弹', () => {
    const inventory = new WeaponAmmunitionInventory();
    const vector = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.KrissVector);
    const m4a1 = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.M4A1);

    const vectorAmmunition = inventory.createFreshMagazine(vector);
    inventory.provisionFirstAcquisition(vector);
    const m4Ammunition = inventory.createFreshMagazine(m4a1);
    inventory.provisionFirstAcquisition(m4a1);

    expect(vectorAmmunition.reserveRounds).toBe(210);
    expect(m4Ammunition.reserveRounds).toBe(180);
    expect(vectorAmmunition.ammunitionType).toBe(AmmunitionType.FortyFiveAcp);
    expect(m4Ammunition.ammunitionType).toBe(AmmunitionType.FiveFiveSixNato);
  });

  it('按射速与飞行时间推导子弹槽位并原地复用', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const capacity = calculateProjectileCapacity(definition);
    const state = new BattlefieldProjectileState(
      capacity,
      definition.projectile.penetrationEnergy,
      definition.projectile.maximumRange,
    );

    expect(capacity).toBe(
      Math.ceil(
        definition.projectile.maximumRange
          / definition.projectile.speed
          / definition.fireIntervalSeconds,
      ) + 1,
    );
    state.spawn(1, 1.2, 2, 0, 0, 1);
    expect(state.activeCount).toBe(1);
    state.deactivate(0);
    expect(state.activeCount).toBe(0);
  });

  it('从手枪几何的真实枪口推导掌心前方弹道起点', () => {
    const held = getBattlefieldWeaponPrototype(EquipmentId.DesertEagle).held;
    expect(held.muzzleForwardOffset).toBeCloseTo(0.35, 6);
    expect(held.muzzleHeightOffset).toBeCloseTo(0.103, 6);
  });

  it('每把长枪按自身模型长度提供独立枪口，不再共用霰弹枪挂点', () => {
    const vector = getBattlefieldWeaponPrototype(EquipmentId.KrissVector).held;
    const shotgun = getBattlefieldWeaponPrototype(EquipmentId.PumpShotgun).held;
    const m4a1 = getBattlefieldWeaponPrototype(EquipmentId.M4A1).held;
    expect(vector.muzzleForwardOffset).toBeCloseTo(0.794, 6);
    expect(shotgun.muzzleForwardOffset).toBeCloseTo(0.998, 6);
    expect(m4a1.muzzleForwardOffset).toBeCloseTo(0.978, 6);
    expect(vector.muzzleForwardOffset).not.toBe(shotgun.muzzleForwardOffset);
  });

  it('把枪型独立枪口偏移随 WeaponAimRoot 四元数旋转到世界空间', () => {
    const held = getBattlefieldWeaponPrototype(EquipmentId.KrissVector).held;
    const halfAngle = Math.PI * 0.25;
    const result = { muzzleX: 0, muzzleY: 0, muzzleZ: 0 };

    writeBattlefieldWeaponMuzzlePose({
      rootX: 3,
      rootY: 2,
      rootZ: 5,
      rotationX: 0,
      rotationY: Math.sin(halfAngle),
      rotationZ: 0,
      rotationW: Math.cos(halfAngle),
    }, held, result);

    expect(result.muzzleX).toBeCloseTo(3 + held.muzzleForwardOffset, 6);
    expect(result.muzzleY).toBeCloseTo(2 + held.muzzleHeightOffset, 6);
    expect(result.muzzleZ).toBeCloseTo(5, 6);
  });

  it('九枚霰弹以准星中心为首发并形成确定性单位方向锥', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.PumpShotgun);
    expect(definition.shotPattern.type).toBe(WeaponShotPatternType.PelletCone);
    const direction = { x: 0, y: 0, z: 0 };
    const observed = new Set<string>();
    const projectileCount = getWeaponShotProjectileCount(definition.shotPattern);
    for (let index = 0; index < projectileCount; index++) {
      writeBattlefieldShotProjectileDirection(
        0,
        0,
        1,
        definition.shotPattern,
        index,
        direction,
      );
      expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 6);
      observed.add(`${direction.x.toFixed(6)}:${direction.y.toFixed(6)}`);
      if (index === 0) {
        expect(direction).toEqual({ x: 0, y: 0, z: 1 });
      }
    }
    expect(projectileCount).toBe(9);
    expect(observed.size).toBe(9);
  });

  it('从枪口向蜘蛛的完整 XYZ 坐标计算弹道', () => {
    const direction = { x: 0, y: 0, z: 0 };

    writeBattlefieldProjectileDirection(1, 2.5, 3, 5, 2, 11, direction);

    expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 6);
    expect(direction.y).toBeLessThan(0);
    const travelToTargetZ = (11 - 3) / direction.z;
    expect(2.5 + direction.y * travelToTargetZ).toBeCloseTo(2, 6);
  });

  it('弹体网格沿三维飞行方向俯仰，不再保持固定世界 Y', () => {
    const direction = { x: 0, y: 0, z: 0 };
    writeBattlefieldProjectileDirection(0, 2.5, 0, 0, 1, 8, direction);
    const state = new BattlefieldProjectileState(1, 1, 10);
    state.spawn(0, 2.5, 0, direction.x, direction.y, direction.z);
    const positions = new Float32Array(
      BATTLEFIELD_PROJECTILE_TOPOLOGY.verticesPerProjectile * 3,
    );

    writeBattlefieldProjectilePositions(
      state,
      positions,
      WeaponProjectileVisual.Bullet,
    );

    // 下降弹道的尾端应位于权威尖端后上方，证明局部前向轴随三维方向俯仰。
    expect(positions[13]).toBeGreaterThan(positions[1] ?? 0);
    expect(state.directionY[0]).toBeLessThan(0);
  });

  it.each([
    WeaponProjectileVisual.Bullet,
    WeaponProjectileVisual.BuckshotPellet,
  ])('弹体视觉 %s 不会领先于权威碰撞点', (visual) => {
    const state = new BattlefieldProjectileState(1, 1, 10);
    state.spawn(0, 0, 0, 0, 0, 1);
    const positions = new Float32Array(
      BATTLEFIELD_PROJECTILE_TOPOLOGY.verticesPerProjectile * 3,
    );

    writeBattlefieldProjectilePositions(state, positions, visual);

    let maximumVisualForward = Number.NEGATIVE_INFINITY;
    for (let offset = 2; offset < positions.length; offset += 3) {
      maximumVisualForward = Math.max(maximumVisualForward, positions[offset] ?? 0);
    }
    expect(maximumVisualForward).toBeLessThanOrEqual(0);
    expect(maximumVisualForward).toBeCloseTo(0, 6);
  });
});
