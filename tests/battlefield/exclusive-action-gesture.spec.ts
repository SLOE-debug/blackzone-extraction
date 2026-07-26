import { describe, expect, it } from 'vitest';
import {
  ExclusiveActionGesture,
  ExclusiveActionGestureResult,
} from '../../assets/bundles/battlefield/ui/exclusive-action-gesture';

describe('技能键独占手势', () => {
  it('短按、长按与取消互斥且只认领自己的触点', () => {
    const gesture = new ExclusiveActionGesture(0.35);
    expect(gesture.beginTouch(7)).toBe(true);
    expect(gesture.beginTouch(8)).toBe(false);
    gesture.update(0.2);
    expect(gesture.endTouch(7)).toBe(true);
    expect(gesture.consume()).toBe(ExclusiveActionGestureResult.ShortPress);

    expect(gesture.beginTouch(8)).toBe(true);
    gesture.update(0.35);
    expect(gesture.consume()).toBe(ExclusiveActionGestureResult.LongHold);
    gesture.endTouch(8);
    expect(gesture.consume()).toBe(ExclusiveActionGestureResult.None);

    expect(gesture.beginTouch(9)).toBe(true);
    expect(gesture.cancelTouch(9)).toBe(true);
    expect(gesture.consume()).toBe(ExclusiveActionGestureResult.None);
  });
});
