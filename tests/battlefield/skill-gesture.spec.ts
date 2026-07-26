import { describe, expect, it } from 'vitest';
import { BattlefieldActionReleaseSource } from '../../assets/bundles/battlefield/action-modules/model/battlefield-action-release-source';
import {
  BattlefieldSkillGesture,
  type MutableBattlefieldSkillGestureInput,
} from '../../assets/bundles/battlefield/ui/battlefield-skill-gesture';

describe('战场技能多点触控手势', () => {
  it('只让首根手指持有技能，并把所有者 TOUCH_CANCEL 转成最后有效输入释放', () => {
    const gesture = new BattlefieldSkillGesture();
    const result = createInput();

    expect(gesture.beginTouch(11)).toBe(true);
    expect(gesture.beginTouch(22)).toBe(false);
    expect(gesture.releaseTouch(
      22,
      BattlefieldActionReleaseSource.TouchCancel,
      -1,
      0,
      1,
    )).toBe(false);
    expect(gesture.active).toBe(true);
    expect(gesture.releaseTouch(
      11,
      BattlefieldActionReleaseSource.TouchCancel,
      0.6,
      0.8,
      0.75,
    )).toBe(true);

    gesture.consume(result, 0, 0, 0);
    expect(result).toEqual({
      active: false,
      released: true,
      releaseSource: BattlefieldActionReleaseSource.TouchCancel,
      x: 0.6,
      y: 0.8,
      amplitude: 0.75,
    });
    gesture.consume(result, 0, 0, 0);
    expect(result.released).toBe(false);
  });

  it('真正的界面上下文取消不会伪造释放事件', () => {
    const gesture = new BattlefieldSkillGesture();
    const result = createInput();
    gesture.beginTouch(7);
    gesture.cancel();
    gesture.consume(result, 1, 0, 1);

    expect(result.active).toBe(false);
    expect(result.released).toBe(false);
    expect(result.releaseSource).toBe(BattlefieldActionReleaseSource.None);
  });
});

function createInput(): MutableBattlefieldSkillGestureInput {
  return {
    active: false,
    released: false,
    releaseSource: BattlefieldActionReleaseSource.None,
    x: 0,
    y: 0,
    amplitude: 0,
  };
}
