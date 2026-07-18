import { Color } from 'cc';
import { type VirtualJoystickOptions } from '../../../core/ui/virtual-joystick';

const MOVEMENT_PALETTE = Object.freeze({
  base: new Color(5, 15, 18, 118),
  border: new Color(52, 83, 82, 185),
  accent: new Color(80, 211, 194, 225),
  handle: new Color(35, 92, 89, 205),
});

const AIM_PALETTE = Object.freeze({
  base: new Color(18, 12, 8, 118),
  border: new Color(105, 71, 43, 190),
  accent: new Color(238, 151, 62, 235),
  handle: new Color(126, 73, 35, 215),
});

/** 战场双摇杆的共享尺寸和左右职责配色。 */
export const BATTLEFIELD_CONTROL_STYLE = Object.freeze({
  edgeMargin: 26,
  aimActivationMagnitude: 0.24,
  movement: Object.freeze({
    radius: 74,
    handleRadius: 31,
    interactionRadius: 108,
    deadZone: 0.13,
    responseExponent: 1.22,
    palette: MOVEMENT_PALETTE,
  }) satisfies VirtualJoystickOptions,
  aim: Object.freeze({
    radius: 74,
    handleRadius: 31,
    interactionRadius: 108,
    deadZone: 0.1,
    responseExponent: 1,
    palette: AIM_PALETTE,
  }) satisfies VirtualJoystickOptions,
});
