import { type Color, type Graphics } from 'cc';
import { EquipmentIconId } from '../../catalog/equipment-hud-profile';

/** 按类型化图标清单绘制物品栏装备轮廓。 */
export function drawBattlefieldEquipmentIcon(
  graphics: Graphics,
  icon: EquipmentIconId,
  x: number,
  y: number,
  color: Readonly<Color>,
  scale = 1,
): void {
  graphics.strokeColor = color;
  graphics.fillColor = color;
  switch (icon) {
    case EquipmentIconId.Sledgehammer:
      drawSledgehammer(graphics, x, y, scale);
      break;
  }
}

function drawSledgehammer(graphics: Graphics, x: number, y: number, scale: number): void {
  graphics.lineWidth = 3 * scale;
  graphics.moveTo(x - 9 * scale, y - 13 * scale);
  graphics.lineTo(x + 5 * scale, y + 8 * scale);
  graphics.stroke();
  graphics.moveTo(x - 6 * scale, y - 11 * scale);
  graphics.lineTo(x + 8 * scale, y + 10 * scale);
  graphics.stroke();
  graphics.moveTo(x - 3 * scale, y + 14 * scale);
  graphics.lineTo(x + 12 * scale, y + 8 * scale);
  graphics.lineTo(x + 16 * scale, y + 3 * scale);
  graphics.lineTo(x + 10 * scale, y - 1 * scale);
  graphics.lineTo(x - 7 * scale, y + 6 * scale);
  graphics.close();
  graphics.fill();
}
