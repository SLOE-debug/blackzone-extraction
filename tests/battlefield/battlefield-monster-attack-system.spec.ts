import { describe, expect, it, vi } from 'vitest';
import { WeaponAction } from '../../assets/core/equipment/equipment';
import { BattlefieldPerformanceEvent } from '../../assets/bundles/battlefield/debug/battlefield-performance-contracts';
import { getHammerActionControlProfile } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-control';
import { type BattlefieldWorld } from '../../assets/bundles/battlefield/world/battlefield-world';
import { BattlefieldMonsterAttackWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-monster-attack-world-system';

describe('敌方伤害统一防御入口', () => {
  it('旋风期间阻断伤害写入并只记录格挡事件', () => {
    const damage = vi.fn();
    const recordEvent = vi.fn();
    const world = createWorld(
      getHammerActionControlProfile(WeaponAction.Spin, 0.5),
      damage,
      recordEvent,
    );
    new BattlefieldMonsterAttackWorldSystem().update(world, 1 / 60);
    expect(world.pendingMonsterAttackDamage).toBe(0);
    expect(damage).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith(
      BattlefieldPerformanceEvent.PlayerDamageBlocked,
      40,
    );
    expect(recordEvent).not.toHaveBeenCalledWith(
      BattlefieldPerformanceEvent.PlayerDamage,
      expect.any(Number),
    );
  });

  it('旋风结束后相同敌方攻击恢复正常伤害', () => {
    const damage = vi.fn();
    const recordEvent = vi.fn();
    const world = createWorld(
      getHammerActionControlProfile(WeaponAction.Idle, 0),
      damage,
      recordEvent,
    );
    new BattlefieldMonsterAttackWorldSystem().update(world, 1 / 60);
    expect(damage).toHaveBeenCalledWith(40);
    expect(recordEvent).toHaveBeenCalledWith(BattlefieldPerformanceEvent.PlayerDamage, 40);
  });
});

function createWorld(
  actionControl: ReturnType<typeof getHammerActionControlProfile>,
  damage: ReturnType<typeof vi.fn>,
  recordEvent: ReturnType<typeof vi.fn>,
): BattlefieldWorld {
  return {
    pendingMonsterAttackDamage: 40,
    resources: {
      player: { damage },
      weapon: { actionControl },
      performance: {
        beginStage: () => 0,
        endStage: () => undefined,
        recordEvent,
      },
    },
  } as unknown as BattlefieldWorld;
}
