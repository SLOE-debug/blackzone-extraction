import { Color, Graphics } from 'cc';
import {
  BattlefieldCombatModuleIcon,
  type BattlefieldCombatModuleId,
} from '../action-modules/model/battlefield-combat-module';

const ACTIVE_FILL = new Color(31, 93, 122, 225);
const ACTIVE_RIM = new Color(102, 205, 255, 255);
const SIDE_FILL = new Color(25, 52, 66, 165);
const SIDE_RIM = new Color(72, 128, 151, 190);
const DISABLED_FILL = new Color(37, 42, 45, 135);
const DISABLED_RIM = new Color(82, 88, 91, 155);
const ICON_ACTIVE = new Color(205, 241, 255, 255);
const ICON_SIDE = new Color(139, 183, 201, 210);
const ICON_DISABLED = new Color(93, 99, 102, 170);

export interface BattlefieldSkillWheelDrawSlot {
  id: BattlefieldCombatModuleId;
  icon: BattlefieldCombatModuleIcon;
  x: number;
  y: number;
  radius: number;
  selected: boolean;
  available: boolean;
}

/** 把三个轮盘槽位写进战场共享 Graphics。 */
export function drawBattlefieldSkillWheel(
  graphics: Graphics,
  slots: readonly BattlefieldSkillWheelDrawSlot[],
  active: boolean,
): void {
  for (const slot of slots) {
    graphics.fillColor = slot.available
      ? slot.selected ? ACTIVE_FILL : SIDE_FILL
      : DISABLED_FILL;
    graphics.strokeColor = slot.available
      ? slot.selected ? ACTIVE_RIM : SIDE_RIM
      : DISABLED_RIM;
    graphics.lineWidth = slot.selected ? 3 : 2;
    graphics.circle(slot.x, slot.y, slot.radius);
    graphics.fill();
    graphics.stroke();
    if (slot.selected && active) {
      graphics.strokeColor = ACTIVE_RIM;
      graphics.lineWidth = 2;
      graphics.circle(slot.x, slot.y, slot.radius + 6);
      graphics.stroke();
    }
    graphics.strokeColor = slot.available
      ? slot.selected ? ICON_ACTIVE : ICON_SIDE
      : ICON_DISABLED;
    graphics.fillColor = graphics.strokeColor;
    graphics.lineWidth = Math.max(2, slot.radius * 0.09);
    drawIcon(graphics, slot.icon, slot.x, slot.y, slot.radius * 0.52);
  }
}

function drawIcon(
  graphics: Graphics,
  icon: BattlefieldCombatModuleIcon,
  x: number,
  y: number,
  radius: number,
): void {
  switch (icon) {
    case BattlefieldCombatModuleIcon.Grab:
      drawGrabIcon(graphics, x, y, radius);
      return;
    case BattlefieldCombatModuleIcon.Throw:
      drawThrowIcon(graphics, x, y, radius);
      return;
    case BattlefieldCombatModuleIcon.Reserved:
      drawReservedIcon(graphics, x, y, radius);
  }
}

function drawGrabIcon(graphics: Graphics, x: number, y: number, radius: number): void {
  graphics.moveTo(x - radius, y + radius * 0.45);
  graphics.lineTo(x - radius * 0.25, y - radius * 0.7);
  graphics.lineTo(x + radius * 0.15, y - radius * 0.2);
  graphics.lineTo(x + radius * 0.42, y - radius * 0.78);
  graphics.lineTo(x + radius, y + radius * 0.4);
  graphics.stroke();
  graphics.circle(x, y + radius * 0.2, radius * 0.28);
  graphics.stroke();
}

function drawThrowIcon(graphics: Graphics, x: number, y: number, radius: number): void {
  graphics.moveTo(x - radius, y - radius * 0.58);
  graphics.quadraticCurveTo(x - radius * 0.15, y + radius, x + radius * 0.72, y + radius * 0.25);
  graphics.stroke();
  graphics.moveTo(x + radius * 0.25, y + radius * 0.18);
  graphics.lineTo(x + radius * 0.82, y + radius * 0.28);
  graphics.lineTo(x + radius * 0.55, y - radius * 0.25);
  graphics.stroke();
}

function drawReservedIcon(graphics: Graphics, x: number, y: number, radius: number): void {
  const dotRadius = radius * 0.16;
  for (let index = -1; index <= 1; index++) {
    graphics.circle(x + index * radius * 0.68, y, dotRadius);
    graphics.fill();
  }
}
