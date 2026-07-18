import { Color, Graphics } from 'cc';

enum JoystickDirectionMarker {
  None,
  Up,
  Down,
  Left,
  Right,
}

/** 虚拟摇杆的扁平圆形配色。 */
export interface VirtualJoystickPalette {
  readonly base: Readonly<Color>;
  readonly rim: Readonly<Color>;
  readonly accent: Readonly<Color>;
  readonly handle: Readonly<Color>;
}

/** 绘制实色圆形底座、简洁方向刻度和扁平摇杆帽。 */
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
  fillCircle(graphics, radius, 0, 0, palette.base);
  strokeCircle(graphics, radius - 2, 0, 0, palette.rim, 4);
  drawDirectionMarkers(
    graphics,
    radius,
    handleX,
    handleY,
    palette.rim,
    palette.accent,
    active,
  );

  fillCircle(graphics, handleRadius, handleX, handleY, palette.handle);
  strokeCircle(
    graphics,
    handleRadius - 2,
    handleX,
    handleY,
    active ? palette.accent : palette.rim,
    4,
  );
}

/** 绘制四个方向点，并按摇杆帽当前主方向点亮其中一个。 */
function drawDirectionMarkers(
  graphics: Graphics,
  radius: number,
  handleX: number,
  handleY: number,
  rim: Readonly<Color>,
  accent: Readonly<Color>,
  active: boolean,
): void {
  const markerDistance = radius - 12;
  const highlighted = resolveDirectionMarker(handleX, handleY, active);
  drawDirectionMarker(
    graphics,
    0,
    markerDistance,
    JoystickDirectionMarker.Up,
    highlighted,
    rim,
    accent,
  );
  drawDirectionMarker(
    graphics,
    0,
    -markerDistance,
    JoystickDirectionMarker.Down,
    highlighted,
    rim,
    accent,
  );
  drawDirectionMarker(
    graphics,
    -markerDistance,
    0,
    JoystickDirectionMarker.Left,
    highlighted,
    rim,
    accent,
  );
  drawDirectionMarker(
    graphics,
    markerDistance,
    0,
    JoystickDirectionMarker.Right,
    highlighted,
    rim,
    accent,
  );
}

/** 绘制单枚方向点，点亮状态同时略微放大以增强辨识度。 */
function drawDirectionMarker(
  graphics: Graphics,
  x: number,
  y: number,
  direction: JoystickDirectionMarker,
  highlighted: JoystickDirectionMarker,
  rim: Readonly<Color>,
  accent: Readonly<Color>,
): void {
  const active = direction === highlighted;
  fillCircle(graphics, active ? 4 : 3, x, y, active ? accent : rim);
}

/** 按主轴判断摇杆帽最接近的四向标记，中心位置不点亮。 */
function resolveDirectionMarker(
  handleX: number,
  handleY: number,
  active: boolean,
): JoystickDirectionMarker {
  if (!active || Math.hypot(handleX, handleY) <= 0.5) {
    return JoystickDirectionMarker.None;
  }
  if (Math.abs(handleX) >= Math.abs(handleY)) {
    return handleX >= 0
      ? JoystickDirectionMarker.Right
      : JoystickDirectionMarker.Left;
  }
  return handleY >= 0
    ? JoystickDirectionMarker.Up
    : JoystickDirectionMarker.Down;
}

/** 填充一个确定半径的圆形路径。 */
function fillCircle(
  graphics: Graphics,
  radius: number,
  centerX: number,
  centerY: number,
  color: Readonly<Color>,
): void {
  graphics.fillColor = color;
  graphics.circle(centerX, centerY, radius);
  graphics.fill();
}

/** 描边一个确定半径的圆形路径。 */
function strokeCircle(
  graphics: Graphics,
  radius: number,
  centerX: number,
  centerY: number,
  color: Readonly<Color>,
  lineWidth: number,
): void {
  graphics.strokeColor = color;
  graphics.lineWidth = lineWidth;
  graphics.circle(centerX, centerY, radius);
  graphics.stroke();
}
