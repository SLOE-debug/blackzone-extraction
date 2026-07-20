import { describe, expect, it } from 'vitest';
import {
  EquipmentCategory,
  EquipmentId,
  EquipmentRarity,
  WeaponAmmunitionMode,
  WeaponClass,
} from '../../assets/core/equipment/equipment';
import {
  BATTLEFIELD_EQUIPMENT_LIBRARY,
} from '../../assets/bundles/battlefield/equipment/model/battlefield-equipment-library';
import {
  BATTLEFIELD_TREASURE_LOOT_TABLE,
} from '../../assets/bundles/battlefield/loot/model/battlefield-treasure-loot-table';
import { getBattlefieldEquipmentGeometry } from '../../assets/bundles/battlefield/equipment/rendering/battlefield-equipment-geometry';
import { mixRandomSeed } from '../../assets/core/math/xorshift32';

describe('战场装备库', () => {
  it('以史诗品质手枪定义登记沙漠之鹰并提供战斗参数', () => {
    const weapon = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    expect(weapon.displayName).toBe('沙漠之鹰');
    expect(weapon.category).toBe(EquipmentCategory.Weapon);
    expect(weapon.rarity).toBe(EquipmentRarity.Epic);
    expect(weapon.weaponClass).toBe(WeaponClass.Handgun);
    expect(weapon.damage).toBeGreaterThan(0);
    expect(weapon.ammunition.mode).toBe(WeaponAmmunitionMode.Infinite);
    expect(weapon.projectile.speed).toBeGreaterThan(0);
    expect(weapon.projectile.maximumRange).toBeGreaterThan(0);
  });

  it('当前装备协议只登记沙漠之鹰', () => {
    expect(Object.values(EquipmentId)).toEqual([EquipmentId.DesertEagle]);
  });

  it('宝箱随机掉落一至三把手枪而非固定三把', () => {
    const observedCounts = new Set<number>();
    for (let seed = 1; seed <= 128; seed++) {
      const randomState = Uint32Array.of(mixRandomSeed(0x72b8e1, seed));
      const drops = BATTLEFIELD_TREASURE_LOOT_TABLE.roll(randomState, 0);
      observedCounts.add(drops.length);
      expect(drops.length).toBeGreaterThanOrEqual(1);
      expect(drops.length).toBeLessThanOrEqual(3);
      for (const id of drops) {
        expect(id).toBe(EquipmentId.DesertEagle);
      }
    }
    expect(Array.from(observedCounts).sort()).toEqual([1, 2, 3]);
  });

  it('手枪由非空程序化分面拓扑和单位法线构成', () => {
    const geometry = getBattlefieldEquipmentGeometry(EquipmentId.DesertEagle);
    expect(geometry.vertexCount).toBeGreaterThan(30);
    expect(geometry.indexCount).toBeGreaterThan(30);
    for (let offset = 0; offset < geometry.normals.length; offset += 3) {
      expect(Math.hypot(
        geometry.normals[offset] ?? 0,
        geometry.normals[offset + 1] ?? 0,
        geometry.normals[offset + 2] ?? 0,
      )).toBeCloseTo(1, 5);
    }
  });
});
