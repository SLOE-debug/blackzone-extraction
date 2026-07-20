import { Color, Graphics } from 'cc';
import {
  BATTLEFIELD_DEFEAT_DIALOG_STYLE,
  type BattlefieldDefeatDialogColor,
} from './battlefield-defeat-dialog-style';

/** 绘制全屏暗幕与削角死亡信息板。 */
export function drawBattlefieldDefeatDialog(
  graphics: Graphics,
  width: number,
  height: number,
): void {
  const style = BATTLEFIELD_DEFEAT_DIALOG_STYLE;
  graphics.clear();
  graphics.fillColor = createDefeatDialogColor(style.mask);
  graphics.rect(-width * 0.5, -height * 0.5, width, height);
  graphics.fill();
  fillCutPanel(
    graphics,
    style.panelWidth,
    style.panelHeight,
    style.panelCut,
    style.panelBorder,
  );
  fillCutPanel(
    graphics,
    style.panelWidth - 6,
    style.panelHeight - 6,
    style.panelCut - 3,
    style.panelSurface,
  );
  graphics.fillColor = createDefeatDialogColor(style.panelFacet);
  graphics.moveTo(-style.panelWidth * 0.5 + 26, style.panelHeight * 0.5 - 18);
  graphics.lineTo(style.panelWidth * 0.5 - 72, style.panelHeight * 0.5 - 18);
  graphics.lineTo(style.panelWidth * 0.5 - 95, style.panelHeight * 0.5 - 27);
  graphics.lineTo(-style.panelWidth * 0.5 + 42, style.panelHeight * 0.5 - 27);
  graphics.close();
  graphics.fill();
}

/** 绘制底部返回按钮的常态或等待状态。 */
export function drawBattlefieldDefeatButton(
  graphics: Graphics,
  pending: boolean,
): void {
  const style = BATTLEFIELD_DEFEAT_DIALOG_STYLE;
  graphics.clear();
  fillCutPanel(
    graphics,
    style.buttonWidth,
    style.buttonHeight,
    style.buttonCut,
    style.buttonBorder,
  );
  fillCutPanel(
    graphics,
    style.buttonWidth - 5,
    style.buttonHeight - 5,
    style.buttonCut - 2,
    pending ? style.buttonPending : style.buttonSurface,
  );
}

/** 把弹窗配置颜色转换为 Cocos Color。 */
export function createDefeatDialogColor(
  value: Readonly<BattlefieldDefeatDialogColor>,
): Color {
  return new Color(value.red, value.green, value.blue, value.alpha);
}

function fillCutPanel(
  graphics: Graphics,
  width: number,
  height: number,
  cut: number,
  color: Readonly<BattlefieldDefeatDialogColor>,
): void {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  graphics.fillColor = createDefeatDialogColor(color);
  graphics.moveTo(-halfWidth + cut, halfHeight);
  graphics.lineTo(halfWidth - cut, halfHeight);
  graphics.lineTo(halfWidth, halfHeight - cut);
  graphics.lineTo(halfWidth, -halfHeight + cut);
  graphics.lineTo(halfWidth - cut, -halfHeight);
  graphics.lineTo(-halfWidth + cut, -halfHeight);
  graphics.lineTo(-halfWidth, -halfHeight + cut);
  graphics.lineTo(-halfWidth, halfHeight - cut);
  graphics.close();
  graphics.fill();
}
