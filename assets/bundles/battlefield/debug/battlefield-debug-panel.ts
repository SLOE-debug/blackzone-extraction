import { BrowserDebugPanel } from '../../../core/debug/browser-debug-panel';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import { type BattlefieldDebugControls } from './battlefield-debug-controls';
import { BATTLEFIELD_DEBUG_MONSTER_OPTIONS } from './battlefield-debug-monster-options';
import { BattlefieldHammerSweepDebugVisualization } from './battlefield-hammer-sweep-debug-visualization';
import { SLEDGEHAMMER_SPIN_KNOCKBACK_TUNING_RANGES } from '../equipment/items/sledgehammer/sledgehammer-spin-knockback-tuning';

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
  private readonly hammerSweepVisualization: BattlefieldHammerSweepDebugVisualization | null;

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
    panel.addSection('武器判定');
    panel.addBoolean(
      '锤头扫掠诊断',
      snapshot.hammerSweepDiagnosticsEnabled,
      (value) => {
        controls.setHammerSweepDiagnosticsEnabled(value);
      },
    );
    const sweepCanvas = panel.addCanvas('黄线：轨迹　青色：胶囊　红点：命中', 288, 180);
    const spinKnockback = snapshot.spinKnockback;
    const tuningRanges = SLEDGEHAMMER_SPIN_KNOCKBACK_TUNING_RANGES;
    panel.addSection('旋风击退调参（实时）');
    panel.addNumber(
      '基础冲量',
      tuningRanges.impulse.minimum,
      tuningRanges.impulse.maximum,
      tuningRanges.impulse.step,
      spinKnockback.impulse,
      (value) => controls.setSpinKnockbackImpulse(value),
    );
    panel.addNumber(
      '前段倍率',
      tuningRanges.pulseMinimumScale.minimum,
      tuningRanges.pulseMinimumScale.maximum,
      tuningRanges.pulseMinimumScale.step,
      spinKnockback.pulseMinimumScale,
      (value) => controls.setSpinPulseMinimumScale(value),
    );
    panel.addNumber(
      '后段倍率',
      tuningRanges.pulseMaximumScale.minimum,
      tuningRanges.pulseMaximumScale.maximum,
      tuningRanges.pulseMaximumScale.step,
      spinKnockback.pulseMaximumScale,
      (value) => controls.setSpinPulseMaximumScale(value),
    );
    panel.addNumber(
      '终结倍率',
      tuningRanges.finalScale.minimum,
      tuningRanges.finalScale.maximum,
      tuningRanges.finalScale.step,
      spinKnockback.finalScale,
      (value) => controls.setSpinFinalScale(value),
    );
    panel.addNumber(
      '速度上限',
      tuningRanges.maximumSpeed.minimum,
      tuningRanges.maximumSpeed.maximum,
      tuningRanges.maximumSpeed.step,
      spinKnockback.maximumSpeed,
      (value) => controls.setSpinMaximumKnockbackSpeed(value),
    );
    panel.addNumber(
      '持续时间',
      tuningRanges.durationSeconds.minimum,
      tuningRanges.durationSeconds.maximum,
      tuningRanges.durationSeconds.step,
      spinKnockback.durationSeconds,
      (value) => controls.setSpinKnockbackDurationSeconds(value),
    );
    panel.addNumber(
      '径向权重',
      tuningRanges.pulseRadialWeight.minimum,
      tuningRanges.pulseRadialWeight.maximum,
      tuningRanges.pulseRadialWeight.step,
      spinKnockback.pulseRadialWeight,
      (value) => controls.setSpinPulseRadialWeight(value),
    );
    panel.addNumber(
      '切向权重',
      tuningRanges.pulseTangentialWeight.minimum,
      tuningRanges.pulseTangentialWeight.maximum,
      tuningRanges.pulseTangentialWeight.step,
      spinKnockback.pulseTangentialWeight,
      (value) => controls.setSpinPulseTangentialWeight(value),
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
    this.hammerSweepVisualization = sweepCanvas === null
      ? null
      : new BattlefieldHammerSweepDebugVisualization(
        sweepCanvas,
        controls.hammerSweepDebug,
      );
  }

  /** 从浏览器页面移除战场调试面板。 */
  public dispose(): void {
    this.hammerSweepVisualization?.dispose();
    this.panel.dispose();
  }
}
