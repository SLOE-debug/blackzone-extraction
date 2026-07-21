import {
  type AmmunitionEquipmentId,
  EquipmentId,
  type WeaponEquipmentId,
} from '../../../../core/equipment/equipment';
import {
  type LootTable,
  WeightedLootTable,
} from '../../../../core/loot/weighted-loot-table';
import { nextRandom, randomInteger } from '../../../../core/math/xorshift32';

const AMMUNITION_DROP_CHANCE = 0.68;

/** 宝箱必出武器时使用的强类型武器权重。 */
const BATTLEFIELD_TREASURE_WEAPON_TABLE = new WeightedLootTable<WeaponEquipmentId>({
  minimumDrops: 1,
  maximumDrops: 1,
  entries: Object.freeze([
    Object.freeze({
      id: EquipmentId.DesertEagle,
      weight: 1,
    }),
    Object.freeze({
      id: EquipmentId.PumpShotgun,
      weight: 0.72,
    }),
  ]),
});

/** 武器到可直接供其装填的世界弹药拾取物映射。 */
const AMMUNITION_BY_WEAPON = Object.freeze({
  [EquipmentId.DesertEagle]: EquipmentId.HandgunAmmunition,
  [EquipmentId.PumpShotgun]: EquipmentId.ShotgunAmmunition,
} satisfies Readonly<Record<WeaponEquipmentId, AmmunitionEquipmentId>>);

/** 每个宝箱保证一把可用武器，并有概率附带一至两份对应口径弹药。 */
class BattlefieldTreasureLootTable implements LootTable<EquipmentId> {
  public roll(randomState: Uint32Array, stateIndex: number): readonly EquipmentId[] {
    const weapon = BATTLEFIELD_TREASURE_WEAPON_TABLE.roll(randomState, stateIndex)[0];
    if (weapon === undefined) {
      throw new Error('战场宝箱武器表没有返回必需的武器。');
    }
    const result: EquipmentId[] = [weapon];
    if (nextRandom(randomState, stateIndex) < AMMUNITION_DROP_CHANCE) {
      const ammunitionCount = randomInteger(randomState, stateIndex, 1, 3);
      const ammunitionId = AMMUNITION_BY_WEAPON[weapon];
      for (let index = 0; index < ammunitionCount; index++) {
        result.push(ammunitionId);
      }
    }
    return Object.freeze(result);
  }
}

/** 战场宝箱共享的不可变掉落表门面。 */
export const BATTLEFIELD_TREASURE_LOOT_TABLE: LootTable<EquipmentId> = Object.freeze(
  new BattlefieldTreasureLootTable(),
);
