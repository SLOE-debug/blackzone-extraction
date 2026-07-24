import { describe, expect, it } from 'vitest';
import { CombatTag } from '../../assets/core/contracts/monster-manipulation';
import { BattlefieldCombatEventBuffer } from '../../assets/bundles/battlefield/action-modules/events/battlefield-combat-event-buffer';
import {
  BattlefieldCombatEventRejection,
  BattlefieldCombatEventType,
} from '../../assets/bundles/battlefield/action-modules/events/battlefield-combat-event-type';
import { BattlefieldCombatModuleId } from '../../assets/bundles/battlefield/action-modules/model/battlefield-combat-module';

describe('战场标准战斗事件缓冲', () => {
  it('保留根链标识并按父事件递增深度', () => {
    const buffer = new BattlefieldCombatEventBuffer();
    const root = appendRoot(buffer, BattlefieldCombatEventType.EntityThrown);
    const child = appendChild(buffer, root, BattlefieldCombatEventType.GroundImpact);

    expect(root).toBe(0);
    expect(child).toBe(1);
    expect(buffer.chainId[child]).toBe(buffer.chainId[root]);
    expect(buffer.depth[child]).toBe(1);
  });

  it('达到链深度、重复和容量边界时拒绝后续事件并记录诊断', () => {
    const depthBuffer = new BattlefieldCombatEventBuffer({
      capacity: 4,
      maximumChainDepth: 0,
      maximumRepeatedEvent: 2,
    });
    const root = appendRoot(depthBuffer, BattlefieldCombatEventType.EntityCollision);
    expect(appendChild(depthBuffer, root, BattlefieldCombatEventType.EntityImpact)).toBe(-1);
    expect(depthBuffer.lastRejection).toBe(BattlefieldCombatEventRejection.MaximumDepth);

    const repeated = new BattlefieldCombatEventBuffer({
      capacity: 4,
      maximumChainDepth: 4,
      maximumRepeatedEvent: 1,
    });
    const repeatedRoot = appendRoot(repeated, BattlefieldCombatEventType.EntityCollision);
    expect(appendChild(
      repeated,
      repeatedRoot,
      BattlefieldCombatEventType.EntityCollision,
    )).toBe(-1);
    expect(repeated.lastRejection).toBe(BattlefieldCombatEventRejection.RepeatedEvent);

    const capacity = new BattlefieldCombatEventBuffer({
      capacity: 1,
      maximumChainDepth: 4,
      maximumRepeatedEvent: 2,
    });
    appendRoot(capacity, BattlefieldCombatEventType.GrabStarted);
    expect(appendRoot(capacity, BattlefieldCombatEventType.EntityGrabbed)).toBe(-1);
    expect(capacity.lastRejection).toBe(BattlefieldCombatEventRejection.Capacity);
  });
});

function appendRoot(
  buffer: BattlefieldCombatEventBuffer,
  type: BattlefieldCombatEventType,
): number {
  return buffer.appendRoot(
    type,
    1,
    2,
    3,
    4,
    BattlefieldCombatModuleId.Throw,
    0,
    0,
    0,
    1,
    0,
    0,
    1,
    CombatTag.SmallBody,
  );
}

function appendChild(
  buffer: BattlefieldCombatEventBuffer,
  parent: number,
  type: BattlefieldCombatEventType,
): number {
  return buffer.appendChild(
    parent,
    type,
    1,
    2,
    3,
    4,
    BattlefieldCombatModuleId.Throw,
    0,
    0,
    0,
    1,
    0,
    0,
    1,
    CombatTag.SmallBody,
  );
}
