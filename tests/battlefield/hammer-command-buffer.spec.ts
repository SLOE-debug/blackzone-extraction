import { describe, expect, it } from 'vitest';
import {
  BattlefieldWeaponCommandBuffer,
  type MutableBattlefieldWeaponCommand,
} from '../../assets/bundles/battlefield/equipment/combat/battlefield-weapon-command-buffer';

describe('大锤独立命令缓冲', () => {
  it('两路主动技能请求互不覆盖并在消费后分别清空', () => {
    const buffer = new BattlefieldWeaponCommandBuffer();
    const command: MutableBattlefieldWeaponCommand = {
      attackHeld: false,
      swingRequested: false,
      directionX: 0,
      directionZ: 1,
      startsRight: null,
      spinRequested: false,
      groundSlamRequested: false,
      groundSlamDirectionX: 0,
      groundSlamDirectionZ: 1,
    };
    buffer.requestSpin();
    buffer.requestGroundSlam(1, 0);
    buffer.consume(command);
    expect(command.spinRequested).toBe(true);
    expect(command.groundSlamRequested).toBe(true);
    expect(command.groundSlamDirectionX).toBe(1);
    expect(command.groundSlamDirectionZ).toBe(0);

    buffer.consume(command);
    expect(command.spinRequested).toBe(false);
    expect(command.groundSlamRequested).toBe(false);
  });

  it('持续攻击意图跨消费保留并在松开或清空时同步', () => {
    const buffer = new BattlefieldWeaponCommandBuffer();
    const command: MutableBattlefieldWeaponCommand = {
      attackHeld: false,
      swingRequested: false,
      directionX: 0,
      directionZ: 1,
      startsRight: null,
      spinRequested: false,
      groundSlamRequested: false,
      groundSlamDirectionX: 0,
      groundSlamDirectionZ: 1,
    };
    buffer.setAttackHeld(true);
    buffer.consume(command);
    expect(command.attackHeld).toBe(true);
    buffer.consume(command);
    expect(command.attackHeld).toBe(true);
    buffer.setAttackHeld(false);
    buffer.consume(command);
    expect(command.attackHeld).toBe(false);
  });
});
