import { describe, expect, it } from 'vitest';
import {
  EquipmentCategory,
  EquipmentRarity,
  WeaponGrip,
  WeaponKind,
  WeaponSkillCommand,
} from '../../assets/core/equipment/equipment';
import {
  BATTLEFIELD_EQUIPMENT_LIBRARY,
  getBattlefieldEquipmentPrototype,
} from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { BATTLEFIELD_TREASURE_LOOT_TABLE } from '../../assets/bundles/battlefield/loot/model/battlefield-treasure-loot-table';

describe('战场武器装备清单', () => {
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
    expect(prototype.held.grip).toBe(WeaponGrip.TwoHandHeavy);
    expect(prototype.held.attachmentPoints.supportGrip.y).toBeLessThan(
      prototype.held.attachmentPoints.mainGrip.y,
    );
    expect(prototype.hud.skills).toHaveLength(2);
    expect(prototype.hud.skills.map((skill) => skill.command)).toEqual([
      WeaponSkillCommand.Spin,
      WeaponSkillCommand.GroundSlam,
    ]);
    expect(prototype.geometry.vertexCount).toBeGreaterThan(0);
    expect(prototype.geometry.indexCount).toBeGreaterThan(0);
    expect(prototype.dropped.boundsRadius).toBeGreaterThan(0);
  });

  it('归弦猎弓使用投射物参数与独立技能', () => {
    const bow = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.ReturningBow);
    const prototype = getBattlefieldEquipmentPrototype(EquipmentId.ReturningBow);
    expect(bow.kind).toBe(WeaponKind.ReturningBow);
    expect(bow.projectileCapacity).toBe(6);
    expect(bow.maximumRange).toBe(24);
    expect(prototype.held.grip).toBe(WeaponGrip.TwoHandRanged);
    expect(prototype.held.attachmentPoints.projectileOrigin).toBeDefined();
    expect(prototype.hud.skills.map((skill) => skill.command)).toEqual([
      WeaponSkillCommand.RecallAll,
      WeaponSkillCommand.HuntingTether,
    ]);
  });

  it('宝箱掉落表只产生已登记武器', () => {
    const observed = new Set<EquipmentId>();
    for (let seed = 1; seed <= 32; seed++) {
      const rolled = BATTLEFIELD_TREASURE_LOOT_TABLE.roll(Uint32Array.of(seed), 0)[0];
      expect([
        EquipmentId.Sledgehammer,
        EquipmentId.ReturningBow,
      ]).toContain(rolled);
      if (rolled !== undefined) {
        observed.add(rolled);
      }
    }
    expect(observed).toEqual(new Set([EquipmentId.Sledgehammer, EquipmentId.ReturningBow]));
  });
});
