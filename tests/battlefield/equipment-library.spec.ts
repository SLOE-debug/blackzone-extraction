import { describe, expect, it } from 'vitest';
import {
  EquipmentCategory,
  EquipmentRarity,
  WeaponGrip,
  WeaponKind,
} from '../../assets/core/equipment/equipment';
import {
  BATTLEFIELD_EQUIPMENT_LIBRARY,
  getBattlefieldEquipmentPrototype,
} from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { BATTLEFIELD_TREASURE_LOOT_TABLE } from '../../assets/bundles/battlefield/loot/model/battlefield-treasure-loot-table';

describe('纯近战装备清单', () => {
  it('大锤定义使用近战参数而不携带枪械协议', () => {
    const hammer = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.Sledgehammer);
    expect(hammer.category).toBe(EquipmentCategory.Weapon);
    expect(hammer.rarity).toBe(EquipmentRarity.Epic);
    expect(hammer.kind).toBe(WeaponKind.Sledgehammer);
    expect(hammer.specialRequiredHits).toBe(5);
    expect(hammer.reach).toBeGreaterThan(0);
    expect(hammer.knockbackImpulse).toBeGreaterThan(0);
    expect('ammunition' in hammer).toBe(false);
    expect('projectile' in hammer).toBe(false);
  });

  it('手持与掉落原型共用类型化大锤几何', () => {
    const prototype = getBattlefieldEquipmentPrototype(EquipmentId.Sledgehammer);
    expect(prototype.held.grip).toBe(WeaponGrip.OneHandHeavy);
    expect(prototype.geometry.vertexCount).toBeGreaterThan(0);
    expect(prototype.geometry.indexCount).toBeGreaterThan(0);
    expect(prototype.dropped.boundsRadius).toBeGreaterThan(0);
  });

  it('宝箱掉落表只产生大锤', () => {
    expect(BATTLEFIELD_TREASURE_LOOT_TABLE.roll(Uint32Array.of(1), 0)).toEqual([
      EquipmentId.Sledgehammer,
    ]);
  });
});
