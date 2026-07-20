import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/model/battlefield-equipment-library';
import { createWeaponAmmunition } from '../../assets/bundles/battlefield/equipment/model/weapon-ammunition';
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
  EquipmentId,
  WeaponProjectileVisual,
  WeaponShotPatternType,
} from '../../assets/core/equipment/equipment';
import { VanguardWeaponPose } from '../../assets/player/vanguard/model/vanguard-weapon-pose';
import {
  getVanguardWeaponRigProfile,
  VanguardWeaponRigSocket,
} from '../../assets/player/vanguard/model/vanguard-weapon-rig';

describe('玩家武器运行时模型', () => {
  it('默认无限弹药能够持续批准射击', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const ammunition = createWeaponAmmunition(definition.ammunition);

    for (let shot = 0; shot < 64; shot++) {
      expect(ammunition.tryConsumeShot()).toBe(true);
    }
  });

  it('霰弹枪耗尽五发后按单发节奏连续装填管式弹仓', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.PumpShotgun);
    const ammunition = createWeaponAmmunition(definition.ammunition);

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
    expect(ammunition.reloading).toBe(false);
  });

  it('按射速与飞行时间推导子弹槽位并原地复用', () => {
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const capacity = calculateProjectileCapacity(definition);
    const state = new BattlefieldProjectileState(capacity);

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
    const muzzle = getVanguardWeaponRigProfile(VanguardWeaponPose.Handgun)
      .sockets[VanguardWeaponRigSocket.Muzzle];
    expect(muzzle.z).toBeCloseTo(0.3484, 6);
    expect(muzzle.y).toBeCloseTo(0.1028, 6);
  });

  it('从霰弹枪真实枪口推导远于双手的弹道起点', () => {
    const muzzle = getVanguardWeaponRigProfile(VanguardWeaponPose.Shotgun)
      .sockets[VanguardWeaponRigSocket.Muzzle];
    expect(muzzle.z).toBeCloseTo(0.998, 6);
    expect(muzzle.y).toBeCloseTo(0.118, 6);
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
    const state = new BattlefieldProjectileState(1);
    state.spawn(0, 2.5, 0, direction.x, direction.y, direction.z);
    const positions = new Float32Array(
      BATTLEFIELD_PROJECTILE_TOPOLOGY.verticesPerProjectile * 3,
    );

    writeBattlefieldProjectilePositions(
      state,
      positions,
      WeaponProjectileVisual.Bullet,
    );

    expect(positions[1]).toBeLessThan(2.5);
    expect(state.directionY[0]).toBeLessThan(0);
  });
});
