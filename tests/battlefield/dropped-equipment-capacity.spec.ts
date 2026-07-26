import { describe, expect, it } from 'vitest';
import { calculateDroppedEquipmentCapacity } from '../../assets/bundles/battlefield/equipment/model/dropped-equipment-capacity';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../../assets/bundles/battlefield/environment/model/battlefield-environment-config';
import { BATTLEFIELD_TREASURE_MAXIMUM_LOOT_COUNT } from '../../assets/bundles/battlefield/loot/model/battlefield-treasure-loot-table';
import { BATTLEFIELD_TREASURE_CHEST_GENERATION } from '../../assets/bundles/battlefield/treasure-chest/model/battlefield-treasure-chest-spawn';

describe('掉落装备加载期容量', () => {
  it('覆盖完整活动 Chunk 窗口内的单箱最大掉落', () => {
    expect(calculateDroppedEquipmentCapacity(
      BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.activeChunkRadius,
      BATTLEFIELD_TREASURE_CHEST_GENERATION.maximumChestsPerGeneratedChunk,
      BATTLEFIELD_TREASURE_MAXIMUM_LOOT_COUNT,
    )).toBe(25);
  });
});
