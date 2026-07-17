import { Color, director, error as logError, type Material, Node, renderer } from 'cc';
import { VanguardPopulation } from '../../player/vanguard';
import { LobbyDebugControls } from '../debug/lobby-debug-controls';
import { LobbyDebugPanel } from '../debug/lobby-debug-panel';
import { LOBBY_RENDER_QUALITY } from '../model/lobby-render-quality';
import { LobbySceneEvent } from '../model/lobby-scene-event';
import { LOBBY_VANGUARD_OPTIONS } from '../model/lobby-vanguard-options';
import { LobbyRenderer } from '../rendering/lobby-renderer';
import { LobbyStartButton } from '../ui/lobby-start-button';
import { LobbyUiCanvas } from '../ui/lobby-ui-canvas';
import { createLobbyCamera, type LobbyCameraRig } from './lobby-camera';
import { createLobbyLighting } from './lobby-lighting';
import { LobbyObservationSpider } from './lobby-observation-spider';

enum LobbySceneState {
  Created,
  Initialized,
  Disposed,
}

/** 正式大厅场景门面，负责渲染、灯光、相机、UI 和观察窗展示的装配。 */
export class LobbySceneRuntime {
  private state = LobbySceneState.Created;
  private runtimeRoot: Node | null = null;
  private renderer: LobbyRenderer | null = null;
  private debugPanel: LobbyDebugPanel | null = null;
  private cameraRig: LobbyCameraRig | null = null;
  private observationSpider: LobbyObservationSpider | null = null;
  private vanguard: VanguardPopulation | null = null;
  private uiCanvas: LobbyUiCanvas | null = null;
  private startButton: LobbyStartButton | null = null;

  constructor(
    private readonly sceneEntry: Node,
    private readonly surfaceMaterialTemplate: Material,
  ) {}

  /** 返回大厅独占 Canvas，供主流程挂接全屏转场遮罩。 */
  public get uiCanvasNode(): Node {
    if (this.state !== LobbySceneState.Initialized || this.uiCanvas === null) {
      throw new Error('大厅 UI Canvas 尚未完成初始化。');
    }
    return this.uiCanvas.node;
  }

  /** 初始化真实聚光灯，并保留调试面板按需开启阴影的 Low Poly 大厅。 */
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
    let observationSpider: LobbyObservationSpider | null = null;
    let vanguard: VanguardPopulation | null = null;
    let uiCanvas: LobbyUiCanvas | null = null;
    let startButton: LobbyStartButton | null = null;
    try {
      lobbyRenderer = new LobbyRenderer(runtimeRoot, this.surfaceMaterialTemplate);
      vanguard = new VanguardPopulation(
        runtimeRoot,
        this.surfaceMaterialTemplate,
        LOBBY_VANGUARD_OPTIONS,
      );
      const lightingRig = createLobbyLighting(runtimeRoot, LOBBY_RENDER_QUALITY);
      cameraRig = createLobbyCamera(runtimeRoot);
      uiCanvas = new LobbyUiCanvas(runtimeRoot);
      startButton = new LobbyStartButton(uiCanvas.node, cameraRig.camera, () => {
        this.sceneEntry.emit(LobbySceneEvent.StartGameRequested);
      });
      observationSpider = new LobbyObservationSpider(
        runtimeRoot,
        this.surfaceMaterialTemplate,
      );
      debugPanel = new LobbyDebugPanel(
        new LobbyDebugControls(scene, lightingRig, cameraRig, observationSpider),
      );
    } catch (error: unknown) {
      debugPanel?.dispose();
      observationSpider?.dispose();
      startButton?.dispose();
      uiCanvas?.dispose();
      vanguard?.dispose();
      cameraRig?.dispose();
      lobbyRenderer?.dispose();
      runtimeRoot.destroy();
      this.state = LobbySceneState.Disposed;
      throw error;
    }
    if (observationSpider === null) {
      throw new Error('大厅观察窗蜘蛛控制器未完成创建。');
    }

    this.runtimeRoot = runtimeRoot;
    this.renderer = lobbyRenderer;
    this.debugPanel = debugPanel;
    this.cameraRig = cameraRig;
    this.observationSpider = observationSpider;
    this.vanguard = vanguard;
    this.uiCanvas = uiCanvas;
    this.startButton = startButton;
    this.state = LobbySceneState.Initialized;
    void observationSpider.initialize().catch((spiderError: unknown) => {
      if (this.state === LobbySceneState.Disposed) {
        return;
      }
      const message = spiderError instanceof Error
        ? spiderError.stack ?? spiderError.message
        : String(spiderError);
      logError(`大厅观察窗蜘蛛加载失败：${message}`);
    });
  }

  /** 更新自适应渲染比例、轨道相机、主角展示动作和墙后蜘蛛动画。 */
  public update(deltaTime: number): void {
    if (this.state === LobbySceneState.Initialized) {
      this.cameraRig?.update(deltaTime);
      this.vanguard?.update(deltaTime);
      this.uiCanvas?.synchronizeFrame();
      this.startButton?.update();
      this.observationSpider?.update(deltaTime);
    }
  }

  /** 释放程序化 Mesh、材质和场景节点。 */
  public dispose(): void {
    if (this.state === LobbySceneState.Disposed) {
      return;
    }
    this.debugPanel?.dispose();
    this.startButton?.dispose();
    this.uiCanvas?.dispose();
    this.cameraRig?.dispose();
    this.observationSpider?.dispose();
    this.vanguard?.dispose();
    this.renderer?.dispose();
    if (this.runtimeRoot?.isValid === true) {
      this.runtimeRoot.destroy();
    }
    this.runtimeRoot = null;
    this.renderer = null;
    this.debugPanel = null;
    this.cameraRig = null;
    this.observationSpider = null;
    this.vanguard = null;
    this.uiCanvas = null;
    this.startButton = null;
    this.state = LobbySceneState.Disposed;
  }
}
