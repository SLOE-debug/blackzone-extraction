import {
  type AmmunitionEquipmentId,
  EquipmentId,
  type WeaponEquipmentId,
} from '../../equipment/catalog/equipment-id';
import {
  type LootTable,
  WeightedLootTable,
} from '../../../../core/loot/weighted-loot-table';
import { randomInteger } from '../../../../core/math/xorshift32';

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
      weight: 0.82,
    }),
    Object.freeze({
      id: EquipmentId.KrissVector,
      weight: 0.38,
    }),
    Object.freeze({
      id: EquipmentId.M4A1,
      weight: 0.58,
    }),
    Object.freeze({
      id: EquipmentId.Akm,
      weight: 0.48,
    }),
  ]),
});

/** 武器到可直接供其装填的世界弹药拾取物映射。 */
const AMMUNITION_BY_WEAPON = Object.freeze({
  [EquipmentId.DesertEagle]: EquipmentId.FiftyActionExpressAmmunition,
  [EquipmentId.PumpShotgun]: EquipmentId.TwelveGaugeAmmunition,
  [EquipmentId.KrissVector]: EquipmentId.FortyFiveAcpAmmunition,
  [EquipmentId.M4A1]: EquipmentId.FiveFiveSixNatoAmmunition,
  [EquipmentId.Akm]: EquipmentId.SevenSixTwoAmmunition,
} satisfies Readonly<Record<WeaponEquipmentId, AmmunitionEquipmentId>>);

/** 每个宝箱保证一把可用武器，并附带两至三份对应口径的大容量弹药。 */
class BattlefieldTreasureLootTable implements LootTable<EquipmentId> {
  public roll(randomState: Uint32Array, stateIndex: number): readonly EquipmentId[] {
    const weapon = BATTLEFIELD_TREASURE_WEAPON_TABLE.roll(randomState, stateIndex)[0];
    if (weapon === undefined) {
      throw new Error('战场宝箱武器表没有返回必需的武器。');
    }
    const result: EquipmentId[] = [weapon];
    const ammunitionCount = randomInteger(randomState, stateIndex, 2, 4);
    const ammunitionId = AMMUNITION_BY_WEAPON[weapon];
    for (let index = 0; index < ammunitionCount; index++) {
      result.push(ammunitionId);
    }
    return Object.freeze(result);
  }
}

/** 战场宝箱共享的不可变掉落表门面。 */
export const BATTLEFIELD_TREASURE_LOOT_TABLE: LootTable<EquipmentId> = Object.freeze(
  new BattlefieldTreasureLootTable(),
);
