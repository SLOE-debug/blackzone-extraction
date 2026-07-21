import { describe, expect, it } from 'vitest';
import {
  EquipmentCategory,
  EquipmentRarity,
  WeaponAmmunitionMode,
  WeaponClass,
  WeaponShotPatternType,
} from '../../assets/core/equipment/equipment';
import {
  BATTLEFIELD_EQUIPMENT_LIBRARY,
  getBattlefieldEquipmentPrototype,
} from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import {
  BATTLEFIELD_TREASURE_LOOT_TABLE,
} from '../../assets/bundles/battlefield/loot/model/battlefield-treasure-loot-table';
import { mixRandomSeed } from '../../assets/core/math/xorshift32';

describe('战场装备库', () => {
  it('以蓝色普通手枪定义登记沙漠之鹰并降低单发伤害', () => {
    const weapon = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    expect(weapon.displayName).toBe('沙漠之鹰');
    expect(weapon.category).toBe(EquipmentCategory.Weapon);
    expect(weapon.rarity).toBe(EquipmentRarity.Rare);
    expect(weapon.weaponClass).toBe(WeaponClass.Handgun);
    expect(weapon.damage).toBe(32);
    expect(weapon.ammunition.mode).toBe(WeaponAmmunitionMode.Magazine);
    expect(weapon.shotPattern.type).toBe(WeaponShotPatternType.Single);
    expect(weapon.projectile.speed).toBeGreaterThan(0);
    expect(weapon.projectile.maximumRange).toBeGreaterThan(0);
  });

  it('以管式弹仓和固定九弹丸锥形分布登记泵动霰弹枪', () => {
    const weapon = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.PumpShotgun);
    expect(weapon.displayName).toBe('泵动霰弹枪');
    expect(weapon.rarity).toBe(EquipmentRarity.Rare);
    expect(weapon.weaponClass).toBe(WeaponClass.Shotgun);
    expect(weapon.ammunition.mode).toBe(WeaponAmmunitionMode.TubeMagazine);
    expect(weapon.shotPattern.type).toBe(WeaponShotPatternType.PelletCone);
    if (weapon.shotPattern.type === WeaponShotPatternType.PelletCone) {
      expect(weapon.shotPattern.projectileCount).toBe(9);
    }
    expect(weapon.projectile.visual).toBeDefined();
  });

  it('装备协议完整登记两种武器与两种对应弹药', () => {
    expect(Object.values(EquipmentId)).toEqual([
      EquipmentId.DesertEagle,
      EquipmentId.PumpShotgun,
      EquipmentId.HandgunAmmunition,
      EquipmentId.ShotgunAmmunition,
    ]);
  });

  it('宝箱必出一把武器，并按概率附带一至两份对应口径弹药', () => {
    const observedCounts = new Set<number>();
    const observedEquipment = new Set<EquipmentId>();
    for (let seed = 1; seed <= 128; seed++) {
      const randomState = Uint32Array.of(mixRandomSeed(0x72b8e1, seed));
      const drops = BATTLEFIELD_TREASURE_LOOT_TABLE.roll(randomState, 0);
      observedCounts.add(drops.length);
      expect(drops.length).toBeGreaterThanOrEqual(1);
      expect(drops.length).toBeLessThanOrEqual(3);
      expect([
        EquipmentId.DesertEagle,
        EquipmentId.PumpShotgun,
      ]).toContain(drops[0]);
      const expectedAmmunition = drops[0] === EquipmentId.DesertEagle
        ? EquipmentId.HandgunAmmunition
        : EquipmentId.ShotgunAmmunition;
      for (const ammunitionId of drops.slice(1)) {
        expect(ammunitionId).toBe(expectedAmmunition);
      }
      for (const id of drops) {
        observedEquipment.add(id);
        expect(Object.values(EquipmentId)).toContain(id);
      }
    }
    expect(Array.from(observedCounts).sort()).toEqual([1, 2, 3]);
    expect(observedEquipment).toEqual(new Set([
      EquipmentId.DesertEagle,
      EquipmentId.PumpShotgun,
      EquipmentId.HandgunAmmunition,
      EquipmentId.ShotgunAmmunition,
    ]));
  });

  it('全部武器和弹药拾取物均由非空程序化分面拓扑和单位法线构成', () => {
    for (const equipmentId of Object.values(EquipmentId)) {
      const geometry = getBattlefieldEquipmentPrototype(equipmentId).geometry;
      expect(geometry.vertexCount).toBeGreaterThan(30);
      expect(geometry.indexCount).toBeGreaterThan(30);
      for (let offset = 0; offset < geometry.normals.length; offset += 3) {
        expect(Math.hypot(
          geometry.normals[offset] ?? 0,
          geometry.normals[offset + 1] ?? 0,
          geometry.normals[offset + 2] ?? 0,
        )).toBeCloseTo(1, 5);
      }
    }
  });
});
