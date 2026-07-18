import { Color, Graphics } from 'cc';

/** 虚拟摇杆的确定性分面配色。 */
export interface VirtualJoystickPalette {
  readonly base: Readonly<Color>;
  readonly border: Readonly<Color>;
  readonly accent: Readonly<Color>;
  readonly handle: Readonly<Color>;
}

/** 绘制八边形底座、方向刻度和当前摇杆帽。 */
export function drawVirtualJoystick(
  graphics: Graphics,
  radius: number,
  handleRadius: number,
  handleX: number,
  handleY: number,
  palette: Readonly<VirtualJoystickPalette>,
  active: boolean,
): void {
  graphics.clear();
  fillRegularPolygon(graphics, 8, radius, 0, 0, palette.border, Math.PI / 8);
  fillRegularPolygon(graphics, 8, radius - 5, 0, 0, palette.base, Math.PI / 8);
  drawDirectionTicks(graphics, radius, palette.accent);
  const activeScale = active ? 1.08 : 1;
  fillRegularPolygon(
    graphics,
    8,
    handleRadius * activeScale,
    handleX,
    handleY,
    palette.border,
    Math.PI / 8,
  );
  fillRegularPolygon(
    graphics,
    8,
    (handleRadius - 4) * activeScale,
    handleX,
    handleY,
    active ? palette.accent : palette.handle,
    Math.PI / 8,
  );
}

/** 绘制四个短方向刻度，使底座在低透明度下仍易辨认。 */
function drawDirectionTicks(graphics: Graphics, radius: number, color: Readonly<Color>): void {
  graphics.strokeColor = color;
  graphics.lineWidth = 3;
  const inner = radius - 18;
  const outer = radius - 9;
  graphics.moveTo(0, inner);
  graphics.lineTo(0, outer);
  graphics.moveTo(0, -inner);
  graphics.lineTo(0, -outer);
  graphics.moveTo(inner, 0);
  graphics.lineTo(outer, 0);
  graphics.moveTo(-inner, 0);
  graphics.lineTo(-outer, 0);
  graphics.stroke();
}

/** 按固定边数填充规则多边形。 */
function fillRegularPolygon(
  graphics: Graphics,
  sideCount: number,
  radius: number,
  centerX: number,
  centerY: number,
  color: Readonly<Color>,
  angleOffset: number,
): void {
  graphics.fillColor = color;
  for (let side = 0; side < sideCount; side++) {
    const angle = angleOffset + side / sideCount * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (side === 0) {
      graphics.moveTo(x, y);
    } else {
      graphics.lineTo(x, y);
    }
  }
  graphics.close();
  graphics.fill();
}
