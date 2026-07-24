import { describe, expect, it } from 'vitest';
import {
  VirtualJoystickGesture,
  VirtualJoystickGestureEndResult,
  VirtualJoystickMode,
} from '../../assets/core/ui/virtual-joystick-gesture';

describe('虚拟摇杆场景操作手势', () => {
  it('Action 模式松开最多产生一次场景操作', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(1, VirtualJoystickMode.Action)).toBe(true);
    expect(gesture.move(1)).toBe(true);
    expect(gesture.end(1)).toBe(VirtualJoystickGestureEndResult.ActionPressed);
    expect(gesture.end(1)).toBe(VirtualJoystickGestureEndResult.Ignored);
    expect(gesture.consumeActionPress()).toBe(true);
    expect(gesture.consumeActionPress()).toBe(false);
  });

  it('Action 模式无论如何移动都不开放轴输入', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(2, VirtualJoystickMode.Action)).toBe(true);
    expect(gesture.axisInputEnabled).toBe(false);
    expect(gesture.move(2)).toBe(true);
    expect(gesture.active).toBe(true);
    expect(gesture.mode).toBe(VirtualJoystickMode.Action);
    expect(gesture.axisInputEnabled).toBe(false);
    expect(gesture.end(2)).toBe(VirtualJoystickGestureEndResult.ActionPressed);
  });

  it('取消触摸不会误触场景操作', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(3, VirtualJoystickMode.Action)).toBe(true);
    expect(gesture.cancel(3)).toBe(true);
    expect(gesture.active).toBe(false);
    expect(gesture.consumeActionPress()).toBe(false);
  });

  it('多点触控不会抢占或结束已有手指', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(4, VirtualJoystickMode.Action)).toBe(true);
    expect(gesture.begin(5, VirtualJoystickMode.Axis)).toBe(false);
    expect(gesture.move(5)).toBe(false);
    expect(gesture.end(5)).toBe(VirtualJoystickGestureEndResult.Ignored);
    expect(gesture.active).toBe(true);
    expect(gesture.end(4)).toBe(VirtualJoystickGestureEndResult.ActionPressed);
  });

  it('Action 模式取消后下一次触摸可恢复 Axis 模式', () => {
    const gesture = new VirtualJoystickGesture();
    expect(gesture.begin(6, VirtualJoystickMode.Action)).toBe(true);
    expect(gesture.cancel(6)).toBe(true);
    expect(gesture.consumeActionPress()).toBe(false);
    expect(gesture.begin(7, VirtualJoystickMode.Axis)).toBe(true);
    expect(gesture.axisInputEnabled).toBe(true);
    expect(gesture.move(7)).toBe(true);
    expect(gesture.end(7)).toBe(VirtualJoystickGestureEndResult.Released);
    expect(gesture.consumeActionPress()).toBe(false);
  });
});
