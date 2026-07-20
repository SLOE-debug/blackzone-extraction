import { createChunkCoordinate, type ChunkCoordinate } from '../../../../core/world/chunk-coordinate';

/** 战场宝箱清单使用的稳定语义标识。 */
export enum TreasureChestId {
  OriginSmugglerCache,
}

/** 一个由固定 Chunk 持有的宝箱生成描述。 */
export interface BattlefieldTreasureChestSpawn {
  readonly id: TreasureChestId;
  readonly chunk: Readonly<ChunkCoordinate>;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
  readonly seed: number;
}

/** 起始区走私者宝箱；固定 seed 让造型和战利品轨迹能够稳定复现。 */
export const BATTLEFIELD_TREASURE_CHEST_SPAWNS = Object.freeze([
  Object.freeze({
    id: TreasureChestId.OriginSmugglerCache,
    chunk: createChunkCoordinate(0, 0),
    x: 4.2,
    y: 0.04,
    z: 1.35,
    heading: -0.22,
    seed: 0x72b8e1,
  }),
] satisfies readonly BattlefieldTreasureChestSpawn[]);
