import { describe, expect, it } from 'vitest';
import {
  VirtualJoystickGesture,
  VirtualJoystickGestureEndResult,
} from '../../assets/core/ui/virtual-joystick-gesture';

describe('虚拟摇杆场景操作手势', () => {
  it('在死区内点击并松开只产生一次场景操作', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(1, true)).toBe(true);
    expect(gesture.move(1, true)).toBe(true);
    expect(gesture.end(1, true)).toBe(VirtualJoystickGestureEndResult.ActionPressed);
    expect(gesture.consumeActionPress()).toBe(true);
    expect(gesture.consumeActionPress()).toBe(false);
  });

  it('拖出死区后永久取消点击候选并继续保持触摸所有权', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(2, true)).toBe(true);
    expect(gesture.move(2, false)).toBe(true);
    expect(gesture.active).toBe(true);
    expect(gesture.move(2, true)).toBe(true);
    expect(gesture.end(2, true)).toBe(VirtualJoystickGestureEndResult.Released);
    expect(gesture.consumeActionPress()).toBe(false);
  });

  it('取消触摸不会误触场景操作', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(3, true)).toBe(true);
    expect(gesture.cancel(3)).toBe(true);
    expect(gesture.active).toBe(false);
    expect(gesture.consumeActionPress()).toBe(false);
  });

  it('多点触控不会抢占或结束已有手指', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(4, true)).toBe(true);
    expect(gesture.begin(5, true)).toBe(false);
    expect(gesture.move(5, false)).toBe(false);
    expect(gesture.end(5, true)).toBe(VirtualJoystickGestureEndResult.Ignored);
    expect(gesture.active).toBe(true);
    expect(gesture.end(4, true)).toBe(VirtualJoystickGestureEndResult.ActionPressed);
  });

  it('没有操作图标时死区点击只释放摇杆', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(6, false)).toBe(true);
    expect(gesture.end(6, true)).toBe(VirtualJoystickGestureEndResult.Released);
    expect(gesture.consumeActionPress()).toBe(false);
  });
});
