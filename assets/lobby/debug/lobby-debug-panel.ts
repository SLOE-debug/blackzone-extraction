import { BrowserDebugPanel } from '../../core/debug/browser-debug-panel';
import { LOBBY_OBSERVATION_SPIDER_CONFIG } from '../model/lobby-observation-spider-config';
import { type LobbyDebugControls } from './lobby-debug-controls';

const PANEL_OPTIONS = Object.freeze({
  id: 'lobby-debug-panel',
  title: '大厅调试',
  accentColor: '#a51f32',
  outputColor: '#f2c8cd',
  width: 300,
});

/** 浏览器预览使用的大厅参数面板。 */
export class LobbyDebugPanel {
  private readonly panel: BrowserDebugPanel;

  constructor(controls: LobbyDebugControls) {
    const snapshot = controls.getSnapshot();
    const panel = new BrowserDebugPanel(PANEL_OPTIONS);
    panel.addNumber('环境光', 0, 2000, 10, snapshot.ambientIlluminance, (value) => {
      controls.setAmbientIlluminance(value);
    });
    panel.addColor('天空环境色', snapshot.ambientSkyColor, (value) => {
      controls.setAmbientSkyColor(value);
    });
    panel.addColor('地面环境色', snapshot.ambientGroundColor, (value) => {
      controls.setAmbientGroundColor(value);
    });
    panel.addBoolean('轨道相机', snapshot.orbitCameraEnabled, (value) => {
      controls.setOrbitCameraEnabled(value);
    });
    panel.addNumber(
      '蜘蛛大小',
      LOBBY_OBSERVATION_SPIDER_CONFIG.minimumScale,
      LOBBY_OBSERVATION_SPIDER_CONFIG.maximumScale,
      0.1,
      snapshot.observationSpiderScale,
      (value) => controls.setObservationSpiderScale(value),
    );
    panel.addNumber('主射灯流明', 0, 24000, 100, snapshot.keyLightFlux, (value) => {
      controls.setKeyLightFlux(value);
    });
    panel.addNumber('主射灯锥角', 15, 75, 1, snapshot.keyLightAngle, (value) => {
      controls.setKeyLightAngle(value);
    });
    panel.addNumber('主射灯范围', 1, 20, 0.1, snapshot.keyLightRange, (value) => {
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

  /** 从浏览器页面移除调试面板。 */
  public dispose(): void {
    this.panel.dispose();
  }
}
