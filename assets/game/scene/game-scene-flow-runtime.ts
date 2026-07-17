import { error as logError, type Material, Node } from 'cc';
import { BundleService } from '../../core/bundles/bundle-service';
import { createLoadingProgress } from '../../core/contracts/loading-progress';
import { type SceneRuntime } from '../../core/contracts/scene-runtime';
import { FeatureId } from '../../core/contracts/runtime-id';
import { FeatureLoader } from '../../core/features/feature-loader';
import { featureRegistry } from '../../core/features/feature-registry';
import { RuntimePerformanceController } from '../../core/performance/runtime-performance-controller';
import { RUNTIME_PERFORMANCE_PROFILE } from '../../core/performance/runtime-performance-platform';
import { SceneLoadingOverlay } from '../../core/ui/scene-loading-overlay';
import { LobbySceneEvent } from '../../lobby/model/lobby-scene-event';
import { LobbySceneRuntime } from '../../lobby/scene/lobby-scene-runtime';

const MINIMUM_LOADING_DURATION = 0.85;
const MINIMUM_READY_DISPLAY_DURATION = 0.35;
const FAILURE_DISPLAY_DURATION = 2.8;

enum GameSceneFlowState {
  Created,
  Lobby,
  LoadingBattlefield,
  Battlefield,
  Disposed,
}

/** 管理大厅、Loading 遮罩和动态战场 Feature 之间的主场景流程。 */
export class GameSceneFlowRuntime implements SceneRuntime {
  private readonly featureLoader = new FeatureLoader(new BundleService(), featureRegistry);
  private state = GameSceneFlowState.Created;
  private performanceController: RuntimePerformanceController | null = null;
  private lobby: LobbySceneRuntime | null = null;
  private battlefield: SceneRuntime | null = null;
  private pendingBattlefield: SceneRuntime | null = null;
  private loadingOverlay: SceneLoadingOverlay | null = null;
  private loadingElapsed = 0;
  private readyElapsed = 0;
  private failureTimeRemaining = 0;

  constructor(
    private readonly sceneEntry: Node,
    private readonly surfaceMaterialTemplate: Material,
  ) {}

  /** 初始化大厅并监听类型化的开始游戏请求。 */
  public initialize(): void {
    if (this.state !== GameSceneFlowState.Created) {
      throw new Error('主场景流程只能初始化一次。');
    }
    let performanceController: RuntimePerformanceController | null = null;
    let lobby: LobbySceneRuntime | null = null;
    try {
      performanceController = new RuntimePerformanceController(RUNTIME_PERFORMANCE_PROFILE);
      lobby = new LobbySceneRuntime(this.sceneEntry, this.surfaceMaterialTemplate);
      lobby.initialize();
      this.sceneEntry.on(
        LobbySceneEvent.StartGameRequested,
        this.handleStartGameRequested,
        this,
      );
    } catch (error: unknown) {
      lobby?.dispose();
      performanceController?.dispose();
      this.state = GameSceneFlowState.Disposed;
      throw error;
    }
    this.performanceController = performanceController;
    this.lobby = lobby;
    this.state = GameSceneFlowState.Lobby;
  }

  /** 更新当前场景、性能控制器和转场动画。 */
  public update(deltaTime: number): void {
    if (this.state === GameSceneFlowState.Disposed) {
      return;
    }
    this.performanceController?.update(deltaTime);
    switch (this.state) {
      case GameSceneFlowState.Created:
        return;
      case GameSceneFlowState.Lobby:
        this.lobby?.update(deltaTime);
        return;
      case GameSceneFlowState.LoadingBattlefield:
        this.updateBattlefieldTransition(deltaTime);
        return;
      case GameSceneFlowState.Battlefield:
        this.battlefield?.update(deltaTime);
        return;
    }
  }

  /** 释放当前场景、等待提交的战场和全局性能控制权。 */
  public dispose(): void {
    if (this.state === GameSceneFlowState.Disposed) {
      return;
    }
    this.sceneEntry.off(
      LobbySceneEvent.StartGameRequested,
      this.handleStartGameRequested,
      this,
    );
    this.loadingOverlay?.dispose();
    this.pendingBattlefield?.dispose();
    this.battlefield?.dispose();
    this.lobby?.dispose();
    this.performanceController?.dispose();
    this.loadingOverlay = null;
    this.pendingBattlefield = null;
    this.battlefield = null;
    this.lobby = null;
    this.performanceController = null;
    this.state = GameSceneFlowState.Disposed;
  }

  private handleStartGameRequested(): void {
    if (this.state !== GameSceneFlowState.Lobby || this.lobby === null) {
      return;
    }
    this.loadingOverlay = new SceneLoadingOverlay(this.lobby.uiCanvasNode);
    this.loadingOverlay.setProgress(createLoadingProgress(0.05, '正在加载战场分包'));
    this.loadingElapsed = 0;
    this.readyElapsed = 0;
    this.failureTimeRemaining = 0;
    this.state = GameSceneFlowState.LoadingBattlefield;
    void this.loadBattlefield();
  }

  /** 加载战场 Feature，再由战场自身继续加载 Common Monsters。 */
  private async loadBattlefield(): Promise<void> {
    try {
      const feature = await this.featureLoader.load(FeatureId.Battlefield);
      if (this.state !== GameSceneFlowState.LoadingBattlefield) {
        return;
      }
      this.loadingOverlay?.setProgress(createLoadingProgress(0.12, '正在初始化战场'));
      const runtime = await feature.createSceneRuntime(
        this.sceneEntry,
        this.surfaceMaterialTemplate,
        (progress) => {
          if (this.state === GameSceneFlowState.LoadingBattlefield) {
            this.loadingOverlay?.setProgress(progress);
          }
        },
      );
      if (this.state !== GameSceneFlowState.LoadingBattlefield) {
        runtime.dispose();
        return;
      }
      this.pendingBattlefield = runtime;
    } catch (error: unknown) {
      if (this.state !== GameSceneFlowState.LoadingBattlefield) {
        return;
      }
      const message = error instanceof Error
        ? error.stack ?? error.message
        : String(error);
      logError(`战场加载失败：${message}`);
      this.loadingOverlay?.showFailure('战场加载失败，请稍后重试');
      this.failureTimeRemaining = FAILURE_DISPLAY_DURATION;
    }
  }

  private updateBattlefieldTransition(deltaTime: number): void {
    this.lobby?.update(deltaTime);
    this.loadingOverlay?.update(deltaTime);
    const safeDeltaTime = Number.isFinite(deltaTime) && deltaTime > 0
      ? Math.min(deltaTime, 0.05)
      : 0;
    this.loadingElapsed += safeDeltaTime;

    if (this.failureTimeRemaining > 0) {
      this.failureTimeRemaining -= safeDeltaTime;
      if (this.failureTimeRemaining <= 0) {
        this.loadingOverlay?.dispose();
        this.loadingOverlay = null;
        this.state = GameSceneFlowState.Lobby;
      }
      return;
    }
    if (this.pendingBattlefield !== null) {
      this.readyElapsed += safeDeltaTime;
    }
    if (this.pendingBattlefield !== null
      && this.loadingElapsed >= MINIMUM_LOADING_DURATION
      && this.readyElapsed >= MINIMUM_READY_DISPLAY_DURATION) {
      this.commitBattlefieldTransition();
    }
  }

  private commitBattlefieldTransition(): void {
    const battlefield = this.pendingBattlefield;
    if (battlefield === null || this.state !== GameSceneFlowState.LoadingBattlefield) {
      return;
    }
    this.loadingOverlay?.dispose();
    this.loadingOverlay = null;
    this.lobby?.dispose();
    this.lobby = null;
    this.pendingBattlefield = null;
    this.battlefield = battlefield;
    this.state = GameSceneFlowState.Battlefield;
  }
}
