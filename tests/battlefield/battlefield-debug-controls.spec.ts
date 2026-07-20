import { describe, expect, it } from 'vitest';
import {
  createBattlefieldDebugSpiderSpawnPosition,
} from '../../assets/bundles/battlefield/debug/battlefield-debug-spider-spawn';

describe('战场 Debug 蜘蛛生成', () => {
  it('按玩家真实朝向把观察蜘蛛放到正前方', () => {
    const player = { positionX: 12, positionZ: -8, heading: Math.PI * 0.5 };
    const spawn = createBattlefieldDebugSpiderSpawnPosition(player);

    expect(spawn.x).toBeCloseTo(17.2, 6);
    expect(spawn.z).toBeCloseTo(-8, 6);
  });
});
