import { describe, expect, it } from 'vitest';
import {
  EquipmentCategory,
  EquipmentId,
  EquipmentRarity,
  WeaponClass,
} from '../../assets/core/equipment/equipment';
import {
  BATTLEFIELD_EQUIPMENT_LIBRARY,
} from '../../assets/bundles/battlefield/equipment/model/battlefield-equipment-library';
import {
  BATTLEFIELD_TREASURE_LOOT_TABLE,
} from '../../assets/bundles/battlefield/loot/model/battlefield-treasure-loot-table';

describe('战场装备库', () => {
  it('以史诗品质手枪定义登记沙漠之鹰并提供战斗参数', () => {
    const weapon = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    expect(weapon.displayName).toBe('沙漠之鹰');
    expect(weapon.category).toBe(EquipmentCategory.Weapon);
    expect(weapon.rarity).toBe(EquipmentRarity.Epic);
    expect(weapon.weaponClass).toBe(WeaponClass.Handgun);
    expect(weapon.damage).toBeGreaterThan(0);
    expect(weapon.magazineCapacity).toBe(7);
  });

  it('宝箱掉落数量由表配置随机化且只返回已登记装备标识', () => {
    for (let seed = 1; seed <= 16; seed++) {
      const drops = BATTLEFIELD_TREASURE_LOOT_TABLE.roll(Uint32Array.of(seed), 0);
      expect(drops.length).toBeGreaterThanOrEqual(1);
      expect(drops.length).toBeLessThanOrEqual(3);
      for (const id of drops) {
        expect(BATTLEFIELD_EQUIPMENT_LIBRARY.get(id).id).toBe(id);
      }
    }
  });
});
