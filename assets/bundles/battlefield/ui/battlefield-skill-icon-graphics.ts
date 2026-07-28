import { type Color, type Graphics } from 'cc';
import { SkillIconId } from '../equipment/catalog/equipment-hud-profile';

/** 绘制装备原型登记的高辨识度程序化技能图标。 */
export function drawBattlefieldSkillIcon(
  graphics: Graphics,
  icon: SkillIconId,
  x: number,
  y: number,
  color: Readonly<Color>,
): void {
  graphics.strokeColor = color;
  graphics.fillColor = color;
  graphics.lineWidth = 3.5;
  switch (icon) {
    case SkillIconId.HammerWhirlwind:
      drawWhirlwind(graphics, x, y);
      break;
    case SkillIconId.HammerGroundSlam:
      drawGroundSlam(graphics, x, y);
      break;
    case SkillIconId.BowRecall:
      drawBowRecall(graphics, x, y);
      break;
    case SkillIconId.BowTether:
      drawBowTether(graphics, x, y);
      break;
  }
}

function drawBowRecall(graphics: Graphics, x: number, y: number): void {
  graphics.moveTo(x - 17, y - 11);
  graphics.lineTo(x + 8, y);
  graphics.lineTo(x - 17, y + 11);
  graphics.stroke();
  graphics.moveTo(x + 8, y);
  graphics.lineTo(x + 1, y + 6);
  graphics.lineTo(x + 1, y - 6);
  graphics.close();
  graphics.fill();
  graphics.arc(x, y, 17, -Math.PI * 0.45, Math.PI * 0.45, false);
  graphics.stroke();
}

function drawBowTether(graphics: Graphics, x: number, y: number): void {
  graphics.moveTo(x - 15, y - 10);
  graphics.lineTo(x + 13, y - 7);
  graphics.lineTo(x + 2, y + 15);
  graphics.lineTo(x - 15, y - 10);
  graphics.stroke();
  graphics.circle(x - 15, y - 10, 3);
  graphics.circle(x + 13, y - 7, 3);
  graphics.circle(x + 2, y + 15, 3);
  graphics.fill();
}

function drawWhirlwind(graphics: Graphics, x: number, y: number): void {
  graphics.arc(x, y, 14, Math.PI * 0.12, Math.PI * 1.68, false);
  graphics.stroke();
  graphics.moveTo(x - 14, y - 8);
  graphics.lineTo(x - 19, y + 1);
  graphics.lineTo(x - 8, y - 1);
  graphics.close();
  graphics.fill();
  graphics.moveTo(x - 5, y - 4);
  graphics.lineTo(x + 8, y + 7);
  graphics.stroke();
  graphics.moveTo(x + 4, y + 13);
  graphics.lineTo(x + 13, y + 6);
  graphics.lineTo(x + 9, y + 1);
  graphics.lineTo(x, y + 8);
  graphics.close();
  graphics.fill();
}

function drawGroundSlam(graphics: Graphics, x: number, y: number): void {
  graphics.moveTo(x - 5, y + 15);
  graphics.lineTo(x + 4, y - 3);
  graphics.stroke();
  graphics.moveTo(x - 7, y + 12);
  graphics.lineTo(x + 4, y + 15);
  graphics.lineTo(x + 9, y + 9);
  graphics.lineTo(x + 2, y + 5);
  graphics.close();
  graphics.fill();
  graphics.moveTo(x - 17, y - 9);
  graphics.lineTo(x - 8, y - 6);
  graphics.lineTo(x - 3, y - 14);
  graphics.lineTo(x + 3, y - 7);
  graphics.lineTo(x + 10, y - 14);
  graphics.lineTo(x + 17, y - 9);
  graphics.stroke();
}
