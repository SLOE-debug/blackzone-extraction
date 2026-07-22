import { BrowserDebugPanel } from '../../../core/debug/browser-debug-panel';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import { type BattlefieldDebugControls } from './battlefield-debug-controls';

const PANEL_OPTIONS = Object.freeze({
  id: 'battlefield-debug-panel',
  title: '战场调试',
  accentColor: '#277f79',
  outputColor: '#c4eee7',
  width: 310,
});

/** 浏览器预览使用的战场相机与观察动作调试面板。 */
export class BattlefieldDebugPanel {
  private readonly panel: BrowserDebugPanel;

  constructor(controls: BattlefieldDebugControls) {
    const snapshot = controls.getSnapshot();
    const panel = new BrowserDebugPanel(PANEL_OPTIONS);
    panel.addBoolean('自由调试相机', snapshot.orbitCameraEnabled, (value) => {
      controls.setOrbitCameraEnabled(value);
    });
    panel.addNumber(
      '正式相机俯角',
      BATTLEFIELD_LAYOUT.camera.minimumPitchDegrees,
      BATTLEFIELD_LAYOUT.camera.maximumPitchDegrees,
      1,
      snapshot.followCameraPitchDegrees,
      (value) => {
        controls.setFollowCameraPitchDegrees(value);
      },
    );
    panel.addBoolean(
      '性能诊断日志',
      snapshot.performanceDiagnosticsEnabled,
      (value) => {
        controls.setPerformanceDiagnosticsEnabled(value);
      },
    );
    panel.addButton('在玩家正前方生成蜘蛛', () => {
      controls.spawnCurveCrawlerAhead();
    });
    this.panel = panel;
  }

  /** 从浏览器页面移除战场调试面板。 */
  public dispose(): void {
    this.panel.dispose();
  }
}
