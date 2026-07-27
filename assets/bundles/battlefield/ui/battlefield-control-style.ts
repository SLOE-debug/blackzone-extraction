import { Color } from 'cc';
import { type VirtualJoystickOptions } from '../../../core/ui/virtual-joystick';
import { type BattlefieldAttackButtonOptions } from './battlefield-attack-button';

const MOVEMENT_PALETTE = Object.freeze({
  base: new Color(25, 48, 49, 178),
  rim: new Color(95, 142, 133, 235),
  accent: new Color(143, 213, 190, 255),
  handle: new Color(54, 112, 104, 255),
});

const ATTACK_PALETTE = Object.freeze({
  base: new Color(58, 42, 28, 178),
  rim: new Color(172, 119, 68, 235),
  accent: new Color(239, 181, 111, 255),
  handle: new Color(151, 91, 50, 255),
});

/** 战场移动摇杆、普通攻击按钮和技能环的共享尺寸与配色。 */
export const BATTLEFIELD_CONTROL_STYLE = Object.freeze({
  horizontalEdgeInset: 64,
  bottomEdgeInset: 56,
  minimumCenterGap: 24,
  skillOrbitRadius: 118,
  movement: Object.freeze({
    radius: 72,
    handleRadius: 30,
    interactionRadius: 108,
    deadZone: 0.13,
    responseExponent: 1.22,
    palette: MOVEMENT_PALETTE,
  }) satisfies VirtualJoystickOptions,
  attack: Object.freeze({
    radius: 72,
    interactionRadius: 108,
    palette: ATTACK_PALETTE,
  }) satisfies BattlefieldAttackButtonOptions,
});
