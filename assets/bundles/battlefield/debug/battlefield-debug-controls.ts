import { type BattlefieldCameraRig } from '../scene/battlefield-camera';
import {
  createBattlefieldDebugSpiderSpawnPosition,
  type BattlefieldDebugPlayerAnchor,
} from './battlefield-debug-spider-spawn';

/** Debug 动作写入的临时蜘蛛生成门面。 */
export interface BattlefieldDebugMonsterSpawner {
  spawnDebugCurveCrawler(x: number, z: number): void;
}

/** 战场调试面板首次显示时读取的参数快照。 */
export interface BattlefieldDebugSnapshot {
  readonly orbitCameraEnabled: boolean;
  readonly followCameraPitchDegrees: number;
  readonly performanceDiagnosticsEnabled: boolean;
}

/** 调试面板只依赖的性能采样开关。 */
export interface BattlefieldDebugPerformanceDiagnostics {
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
}

/** 把 Debug 面板修改映射到战场相机与观察动作。 */
export class BattlefieldDebugControls {
  constructor(
    private readonly cameraRig: BattlefieldCameraRig,
    private readonly player: BattlefieldDebugPlayerAnchor,
    private readonly monsters: BattlefieldDebugMonsterSpawner,
    private readonly diagnostics: BattlefieldDebugPerformanceDiagnostics,
  ) {}

  /** 获取面板全部控件的当前值。 */
  public getSnapshot(): BattlefieldDebugSnapshot {
    return Object.freeze({
      orbitCameraEnabled: this.cameraRig.orbitEnabled,
      followCameraPitchDegrees: this.cameraRig.followPitchDegrees,
      performanceDiagnosticsEnabled: this.diagnostics.enabled,
    });
  }

  /** 开关脱离玩家跟随、支持平移和缩放的自由调试相机。 */
  public setOrbitCameraEnabled(value: boolean): void {
    this.cameraRig.setOrbitEnabled(value);
  }

  /** 设置正式跟随相机相对水平面的向下俯角。 */
  public setFollowCameraPitchDegrees(value: number): void {
    this.cameraRig.setFollowPitchDegrees(value);
  }

  /** 在玩家真实朝向前方生成一只用于检查出生动画的蜘蛛。 */
  public spawnCurveCrawlerAhead(): void {
    const spawn = createBattlefieldDebugSpiderSpawnPosition(this.player);
    this.monsters.spawnDebugCurveCrawler(spawn.x, spawn.z);
  }

  /** 显式启停高精度分阶段计时和控制台报告。 */
  public setPerformanceDiagnosticsEnabled(value: boolean): void {
    this.diagnostics.setEnabled(value);
  }
}
