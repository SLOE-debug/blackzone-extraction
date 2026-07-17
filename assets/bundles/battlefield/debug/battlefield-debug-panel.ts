import { BrowserDebugPanel } from '../../../core/debug/browser-debug-panel';
import { type BattlefieldDebugControls } from './battlefield-debug-controls';

const PANEL_OPTIONS = Object.freeze({
  id: 'battlefield-debug-panel',
  title: '战场调试',
  accentColor: '#277f79',
  outputColor: '#c4eee7',
  width: 310,
});

/** 浏览器预览使用的战场灯光与相机调试面板。 */
export class BattlefieldDebugPanel {
  private readonly panel: BrowserDebugPanel;

  constructor(controls: BattlefieldDebugControls) {
    const snapshot = controls.getSnapshot();
    const panel = new BrowserDebugPanel(PANEL_OPTIONS);
    panel.addBoolean('轨道相机', snapshot.orbitCameraEnabled, (value) => {
      controls.setOrbitCameraEnabled(value);
    });
    panel.addNumber('环境光亮度', 0, 5000, 25, snapshot.ambientIlluminance, (value) => {
      controls.setAmbientIlluminance(value);
    });
    panel.addColor('天空环境色', snapshot.ambientSkyColor, (value) => {
      controls.setAmbientSkyColor(value);
    });
    panel.addColor('地面环境色', snapshot.ambientGroundColor, (value) => {
      controls.setAmbientGroundColor(value);
    });
    panel.addNumber('主灯流明', 0, 200000, 1000, snapshot.keyLightFlux, (value) => {
      controls.setKeyLightFlux(value);
    });
    panel.addColor('主灯颜色', snapshot.keyLightColor, (value) => {
      controls.setKeyLightColor(value);
    });
    panel.addNumber('主灯锥角', 15, 120, 1, snapshot.keyLightAngle, (value) => {
      controls.setKeyLightAngle(value);
    });
    panel.addNumber('主灯范围', 5, 100, 1, snapshot.keyLightRange, (value) => {
      controls.setKeyLightRange(value);
    });
    panel.addNumber('边缘衰减', 0, 1, 0.01, snapshot.keyLightAttenuation, (value) => {
      controls.setKeyLightAttenuation(value);
    });
    panel.addBoolean('主射灯启用', snapshot.keyLightEnabled, (value) => {
      controls.setKeyLightEnabled(value);
    });
    panel.addBoolean('实时阴影', snapshot.keyLightShadowEnabled, (value) => {
      controls.setKeyLightShadowEnabled(value);
    });
    this.panel = panel;
  }

  /** 从浏览器页面移除战场调试面板。 */
  public dispose(): void {
    this.panel.dispose();
  }
}
