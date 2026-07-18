import { _decorator, Component, error as logError } from 'cc';
import { type SceneRuntime } from '../../../core/contracts/scene-runtime';
import { RuntimePerformanceController } from '../../../core/performance/runtime-performance-controller';
import { RUNTIME_PERFORMANCE_PROFILE } from '../../../core/performance/runtime-performance-platform';

const { ccclass } = _decorator;

/** 独立战场 Scene 的帧循环与资源释放入口。 */
@ccclass('BattlefieldSceneEntry')
export class BattlefieldSceneEntry extends Component {
  private runtime: SceneRuntime | null = null;
  private performanceController: RuntimePerformanceController | null = null;
  private disposed = false;

  /** 在场景激活前绑定已经完成初始化的战场运行时。 */
  public bind(runtime: SceneRuntime): void {
    if (this.disposed || this.runtime !== null) {
      throw new Error('战场 Scene 入口只能绑定一次运行时。');
    }
    this.runtime = runtime;
    if (this.node.activeInHierarchy) {
      this.initializePerformanceController();
    }
  }

  protected onLoad(): void {
    this.initializePerformanceController();
  }

  /** 推进战场性能控制器和玩法运行时。 */
  protected update(deltaTime: number): void {
    this.performanceController?.update(deltaTime);
    this.runtime?.update(deltaTime);
  }

  protected onDestroy(): void {
    this.disposed = true;
    this.runtime?.dispose();
    this.performanceController?.dispose();
    this.runtime = null;
    this.performanceController = null;
  }

  /** 场景激活后取得战场独立的性能控制生命周期。 */
  private initializePerformanceController(): void {
    if (this.disposed || this.performanceController !== null || this.runtime === null) {
      return;
    }
    try {
      this.performanceController = new RuntimePerformanceController(RUNTIME_PERFORMANCE_PROFILE);
    } catch (initializationError: unknown) {
      const message = initializationError instanceof Error
        ? initializationError.stack ?? initializationError.message
        : String(initializationError);
      logError(`战场性能控制器初始化失败：${message}`);
    }
  }
}
