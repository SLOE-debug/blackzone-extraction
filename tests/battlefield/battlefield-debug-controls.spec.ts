import { describe, expect, it } from 'vitest';
import {
  createBattlefieldDebugMonsterSpawnPosition,
} from '../../assets/bundles/battlefield/debug/battlefield-debug-monster-spawn';
import { BattlefieldDebugControls } from '../../assets/bundles/battlefield/debug/battlefield-debug-controls';
import { BattlefieldMonsterId } from '../../assets/bundles/battlefield/model/battlefield-monster-id';

describe('战场 Debug 怪物生成', () => {
  it('按玩家真实朝向把观察怪物放到正前方', () => {
    const player = { positionX: 12, positionZ: -8, heading: Math.PI * 0.5 };
    const spawn = createBattlefieldDebugMonsterSpawnPosition(player);

    expect(spawn.x).toBeCloseTo(17.2, 6);
    expect(spawn.z).toBeCloseTo(-8, 6);
  });

  it('自动生成关闭时仍会把手动按钮动作路由到指定怪物原型', () => {
    const calls: Array<{ id: BattlefieldMonsterId; x: number; z: number }> = [];
    const monsters = {
      automaticGenerationEnabled: false,
      isAutomaticMonsterEnabled: () => false,
      setAutomaticGenerationEnabled() {},
      setAutomaticMonsterEnabled() {},
      spawnDebugMonster(id: BattlefieldMonsterId, x: number, z: number) {
        calls.push({ id, x, z });
      },
    };
    const controls = new BattlefieldDebugControls(
      { orbitEnabled: false, followPitchDegrees: 35 } as never,
      { positionX: 2, positionZ: 4, heading: 0 },
      monsters,
      { enabled: false, setEnabled() {} },
      { selectCombatModule() {} },
    );

    controls.spawnMonsterAhead(BattlefieldMonsterId.VenomLobber);

    expect(calls).toEqual([{
      id: BattlefieldMonsterId.VenomLobber,
      x: 2,
      z: 9.2,
    }]);
  });
});
