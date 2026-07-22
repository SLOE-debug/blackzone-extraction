import { type BattlefieldCameraRig } from '../scene/battlefield-camera';
import { BattlefieldMonsterId } from '../model/battlefield-monster-id';
import {
  createBattlefieldDebugMonsterSpawnPosition,
  type BattlefieldDebugPlayerAnchor,
} from './battlefield-debug-monster-spawn';
import { type BattlefieldDebugMonsterSelection } from './battlefield-debug-monster-options';

/** Debug 面板依赖的自动生成配置与精确怪物生成门面。 */
export interface BattlefieldDebugMonsterSpawner {
  readonly automaticGenerationEnabled: boolean;
  isAutomaticMonsterEnabled(id: BattlefieldMonsterId): boolean;
  setAutomaticGenerationEnabled(enabled: boolean): void;
  setAutomaticMonsterEnabled(id: BattlefieldMonsterId, enabled: boolean): void;
  spawnDebugMonster(id: BattlefieldMonsterId, x: number, z: number): void;
}

/** 战场调试面板首次显示时读取的参数快照。 */
export interface BattlefieldDebugSnapshot {
  readonly orbitCameraEnabled: boolean;
  readonly followCameraPitchDegrees: number;
  readonly performanceDiagnosticsEnabled: boolean;
  readonly automaticGenerationEnabled: boolean;
  readonly automaticMonsters: BattlefieldDebugMonsterSelection;
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
      automaticGenerationEnabled: this.monsters.automaticGenerationEnabled,
      automaticMonsters: Object.freeze({
        [BattlefieldMonsterId.CurveCrawler]: this.monsters.isAutomaticMonsterEnabled(
          BattlefieldMonsterId.CurveCrawler,
        ),
        [BattlefieldMonsterId.VenomLobber]: this.monsters.isAutomaticMonsterEnabled(
          BattlefieldMonsterId.VenomLobber,
        ),
      }),
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

  /** 显式启停正式波次的自动怪物生成。 */
  public setAutomaticGenerationEnabled(value: boolean): void {
    this.monsters.setAutomaticGenerationEnabled(value);
  }

  /** 修改自动波次允许生成的怪物原型多选状态。 */
  public setAutomaticMonsterEnabled(id: BattlefieldMonsterId, value: boolean): void {
    this.monsters.setAutomaticMonsterEnabled(id, value);
  }

  /** 在玩家真实朝向前方生成指定怪物，不依赖任何自动生成开关。 */
  public spawnMonsterAhead(id: BattlefieldMonsterId): void {
    const spawn = createBattlefieldDebugMonsterSpawnPosition(this.player);
    this.monsters.spawnDebugMonster(id, spawn.x, spawn.z);
  }

  /** 显式启停高精度分阶段计时和控制台报告。 */
  public setPerformanceDiagnosticsEnabled(value: boolean): void {
    this.diagnostics.setEnabled(value);
  }
}
