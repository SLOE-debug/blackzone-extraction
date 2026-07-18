import { Color } from 'cc';
import { type VirtualJoystickOptions } from '../../../core/ui/virtual-joystick';

const MOVEMENT_PALETTE = Object.freeze({
  base: new Color(25, 48, 49, 178),
  rim: new Color(95, 142, 133, 235),
  accent: new Color(143, 213, 190, 255),
  handle: new Color(54, 112, 104, 255),
});

const AIM_PALETTE = Object.freeze({
  base: new Color(58, 42, 28, 178),
  rim: new Color(172, 119, 68, 235),
  accent: new Color(239, 181, 111, 255),
  handle: new Color(151, 91, 50, 255),
});

/** 战场双摇杆的共享尺寸和左右职责配色。 */
export const BATTLEFIELD_CONTROL_STYLE = Object.freeze({
  edgeMargin: 28,
  aimActivationMagnitude: 0.24,
  movement: Object.freeze({
    radius: 72,
    handleRadius: 30,
    interactionRadius: 108,
    deadZone: 0.13,
    responseExponent: 1.22,
    palette: MOVEMENT_PALETTE,
  }) satisfies VirtualJoystickOptions,
  aim: Object.freeze({
    radius: 72,
    handleRadius: 30,
    interactionRadius: 108,
    deadZone: 0.1,
    responseExponent: 1,
    palette: AIM_PALETTE,
  }) satisfies VirtualJoystickOptions,
});
