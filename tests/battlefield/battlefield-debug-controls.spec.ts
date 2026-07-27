import { describe, expect, it } from 'vitest';
import {
  createBattlefieldDebugMonsterSpawnPosition,
} from '../../assets/bundles/battlefield/debug/battlefield-debug-monster-spawn';
import { BattlefieldDebugControls } from '../../assets/bundles/battlefield/debug/battlefield-debug-controls';
import { BattlefieldMonsterId } from '../../assets/bundles/battlefield/model/battlefield-monster-id';
import { SledgehammerSpinKnockbackTuning } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-spin-knockback-tuning';

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
    const spinKnockback = new SledgehammerSpinKnockbackTuning();
    const controls = new BattlefieldDebugControls(
      { orbitEnabled: false, followPitchDegrees: 35 } as never,
      { positionX: 2, positionZ: 4, heading: 0 },
      monsters,
      { enabled: false, setEnabled() {} },
      {
        enabled: false,
        active: false,
        startX: 0,
        startZ: 0,
        endX: 0,
        endZ: 0,
        radius: 0,
        hitCount: 0,
        setEnabled() {},
        getHitX: () => 0,
        getHitZ: () => 0,
      },
      spinKnockback,
    );

    controls.spawnMonsterAhead(BattlefieldMonsterId.VenomLobber);

    expect(calls).toEqual([{
      id: BattlefieldMonsterId.VenomLobber,
      x: 2,
      z: 9.2,
    }]);
  });

  it('把右上角滑杆值写入当前战场的旋风击退参数', () => {
    const spinKnockback = new SledgehammerSpinKnockbackTuning();
    const controls = createDebugControls(spinKnockback);

    controls.setSpinKnockbackImpulse(24);
    controls.setSpinPulseMinimumScale(0.65);
    controls.setSpinPulseMaximumScale(1.7);
    controls.setSpinFinalScale(2.6);
    controls.setSpinMaximumKnockbackSpeed(64);
    controls.setSpinKnockbackDurationSeconds(0.8);
    controls.setSpinPulseRadialWeight(0.7);
    controls.setSpinPulseTangentialWeight(0.9);

    expect(controls.getSnapshot().spinKnockback).toEqual({
      impulse: 24,
      pulseMinimumScale: 0.65,
      pulseMaximumScale: 1.7,
      finalScale: 2.6,
      maximumSpeed: 64,
      durationSeconds: 0.8,
      pulseRadialWeight: 0.7,
      pulseTangentialWeight: 0.9,
    });
  });
});

function createDebugControls(
  spinKnockback: SledgehammerSpinKnockbackTuning,
): BattlefieldDebugControls {
  return new BattlefieldDebugControls(
    { orbitEnabled: false, followPitchDegrees: 35 } as never,
    { positionX: 0, positionZ: 0, heading: 0 },
    {
      automaticGenerationEnabled: false,
      isAutomaticMonsterEnabled: () => false,
      setAutomaticGenerationEnabled() {},
      setAutomaticMonsterEnabled() {},
      spawnDebugMonster() {},
    },
    { enabled: false, setEnabled() {} },
    {
      enabled: false,
      active: false,
      startX: 0,
      startZ: 0,
      endX: 0,
      endZ: 0,
      radius: 0,
      hitCount: 0,
      setEnabled() {},
      getHitX: () => 0,
      getHitZ: () => 0,
    },
    spinKnockback,
  );
}
