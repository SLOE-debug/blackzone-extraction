import { BrowserDebugPanel } from '../../../core/debug/browser-debug-panel';
import { type BattlefieldDebugControls } from './battlefield-debug-controls';

const PANEL_OPTIONS = Object.freeze({
  id: 'battlefield-debug-panel',
  title: '战场调试',
  accentColor: '#277f79',
  outputColor: '#c4eee7',
  width: 310,
});

/** 浏览器预览使用的战场环境光与自由相机调试面板。 */
export class BattlefieldDebugPanel {
  private readonly panel: BrowserDebugPanel;

  constructor(controls: BattlefieldDebugControls) {
    const snapshot = controls.getSnapshot();
    const panel = new BrowserDebugPanel(PANEL_OPTIONS);
    panel.addBoolean('自由调试相机', snapshot.orbitCameraEnabled, (value) => {
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
    this.panel = panel;
  }

  /** 从浏览器页面移除战场调试面板。 */
  public dispose(): void {
    this.panel.dispose();
  }
}
