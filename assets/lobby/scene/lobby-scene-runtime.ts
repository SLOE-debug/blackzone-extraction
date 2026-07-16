import { Color, director, type Material, Node, renderer } from 'cc';
import { RuntimePerformanceController } from '../../core/performance/runtime-performance-controller';
import { RUNTIME_PERFORMANCE_PROFILE } from '../../core/performance/runtime-performance-profile';
import { LobbyDebugControls } from '../debug/lobby-debug-controls';
import { LobbyDebugPanel } from '../debug/lobby-debug-panel';
import { LOBBY_RENDER_QUALITY } from '../model/lobby-render-quality';
import { LobbyRenderer } from '../rendering/lobby-renderer';
import { createLobbyCamera, type LobbyCameraRig } from './lobby-camera';
import { createLobbyLighting } from './lobby-lighting';

enum LobbySceneState {
  Created,
  Initialized,
  Disposed,
}

/** 正式大厅场景门面，只负责性能策略、渲染器、灯光和相机的装配。 */
export class LobbySceneRuntime {
  private state = LobbySceneState.Created;
  private runtimeRoot: Node | null = null;
  private renderer: LobbyRenderer | null = null;
  private debugPanel: LobbyDebugPanel | null = null;
  private cameraRig: LobbyCameraRig | null = null;
  private performanceController: RuntimePerformanceController | null = null;

  constructor(
    private readonly sceneEntry: Node,
    private readonly surfaceMaterialTemplate: Material,
  ) {}

  /** 初始化保留真实聚光灯与阴影的 Low Poly 大厅。 */
  public initialize(): void {
    if (this.state !== LobbySceneState.Created) {
      throw new Error('大厅场景只能初始化一次。');
    }

    const scene = director.getScene();
    if (scene === null) {
      throw new Error('大厅初始化时没有活动场景。');
    }
    scene.globals.ambient.skyLightingColor = new Color(58, 6, 15, 255);
    scene.globals.ambient.groundLightingColor = new Color(22, 1, 6, 255);
    scene.globals.ambient.skyIllum = 1580;
    scene.globals.skybox.enabled = false;
    scene.globals.fog.enabled = false;
    scene.globals.shadows.enabled = true;
    scene.globals.shadows.type = renderer.scene.ShadowType.ShadowMap;
    scene.globals.shadows.shadowMapSize = LOBBY_RENDER_QUALITY.shadowMapSize;
    scene.globals.shadows.maxReceived = 1;
    scene.globals.shadows.shadowColor = new Color(12, 1, 4, 200);

    const runtimeRoot = new Node('Lobby');
    this.sceneEntry.addChild(runtimeRoot);
    let lobbyRenderer: LobbyRenderer | null = null;
    let debugPanel: LobbyDebugPanel | null = null;
    let cameraRig: LobbyCameraRig | null = null;
    let performanceController: RuntimePerformanceController | null = null;
    try {
      performanceController = new RuntimePerformanceController(RUNTIME_PERFORMANCE_PROFILE);
      lobbyRenderer = new LobbyRenderer(runtimeRoot, this.surfaceMaterialTemplate);
      const lightingRig = createLobbyLighting(runtimeRoot, LOBBY_RENDER_QUALITY);
      cameraRig = createLobbyCamera(runtimeRoot);
      debugPanel = new LobbyDebugPanel(
        new LobbyDebugControls(scene, lightingRig, cameraRig),
      );
    } catch (error: unknown) {
      debugPanel?.dispose();
      cameraRig?.dispose();
      lobbyRenderer?.dispose();
      performanceController?.dispose();
      runtimeRoot.destroy();
      this.state = LobbySceneState.Disposed;
      throw error;
    }

    this.runtimeRoot = runtimeRoot;
    this.renderer = lobbyRenderer;
    this.debugPanel = debugPanel;
    this.cameraRig = cameraRig;
    this.performanceController = performanceController;
    this.state = LobbySceneState.Initialized;
  }

  /** 更新自适应渲染比例和可选轨道相机惯性。 */
  public update(deltaTime: number): void {
    if (this.state === LobbySceneState.Initialized) {
      this.performanceController?.update(deltaTime);
      this.cameraRig?.update(deltaTime);
    }
  }

  /** 释放程序化 Mesh、材质和场景节点。 */
  public dispose(): void {
    if (this.state === LobbySceneState.Disposed) {
      return;
    }
    this.debugPanel?.dispose();
    this.cameraRig?.dispose();
    this.renderer?.dispose();
    this.performanceController?.dispose();
    if (this.runtimeRoot?.isValid === true) {
      this.runtimeRoot.destroy();
    }
    this.runtimeRoot = null;
    this.renderer = null;
    this.debugPanel = null;
    this.cameraRig = null;
    this.performanceController = null;
    this.state = LobbySceneState.Disposed;
  }
}
