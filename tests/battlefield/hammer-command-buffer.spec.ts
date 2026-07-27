import { describe, expect, it } from 'vitest';
import {
  BattlefieldWeaponCommandBuffer,
  type MutableBattlefieldWeaponCommand,
} from '../../assets/bundles/battlefield/equipment/combat/battlefield-weapon-command-buffer';

describe('大锤独立命令缓冲', () => {
  it('三路技能请求互不覆盖并在消费后分别清空', () => {
    const buffer = new BattlefieldWeaponCommandBuffer();
    const command: MutableBattlefieldWeaponCommand = {
      swingRequested: false,
      directionX: 0,
      directionZ: 1,
      startsRight: null,
      spinRequested: false,
      groundSlamRequested: false,
      uppercutRequested: false,
    };
    buffer.requestSpin();
    buffer.requestGroundSlam();
    buffer.requestUppercut();
    buffer.consume(command);
    expect(command.spinRequested).toBe(true);
    expect(command.groundSlamRequested).toBe(true);
    expect(command.uppercutRequested).toBe(true);

    buffer.consume(command);
    expect(command.spinRequested).toBe(false);
    expect(command.groundSlamRequested).toBe(false);
    expect(command.uppercutRequested).toBe(false);
  });
});
