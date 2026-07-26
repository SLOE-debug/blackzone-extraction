import { BrowserDebugPanel } from '../../../core/debug/browser-debug-panel';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import { type BattlefieldDebugControls } from './battlefield-debug-controls';
import { BATTLEFIELD_DEBUG_MONSTER_OPTIONS } from './battlefield-debug-monster-options';

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
    panel.addSection('怪物生成');
    panel.addBoolean('是否生成怪物', snapshot.automaticGenerationEnabled, (value) => {
      controls.setAutomaticGenerationEnabled(value);
    });
    panel.addSection('生成哪些怪物（可多选）');
    for (const option of BATTLEFIELD_DEBUG_MONSTER_OPTIONS) {
      panel.addBoolean(option.label, snapshot.automaticMonsters[option.id], (value) => {
        controls.setAutomaticMonsterEnabled(option.id, value);
      });
    }
    panel.addSection('单只怪物观察');
    for (const option of BATTLEFIELD_DEBUG_MONSTER_OPTIONS) {
      panel.addButton(`在玩家正前方生成 ${option.label}`, () => {
        controls.spawnMonsterAhead(option.id);
      });
    }
    this.panel = panel;
  }

  /** 从浏览器页面移除战场调试面板。 */
  public dispose(): void {
    this.panel.dispose();
  }
}
