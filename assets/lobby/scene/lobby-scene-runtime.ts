import { Color, director, type Material, Node, renderer } from 'cc';
import { LobbyDebugControls } from '../debug/lobby-debug-controls';
import { LobbyDebugPanel } from '../debug/lobby-debug-panel';
import { LobbyRenderer } from '../rendering/lobby-renderer';
import { createLobbyCamera } from './lobby-camera';
import { createLobbyLighting } from './lobby-lighting';

enum LobbySceneState {
  Created,
  Initialized,
  Disposed,
}

/** 正式大厅场景门面，只负责渲染器、灯光和相机的装配。 */
export class LobbySceneRuntime {
  private state = LobbySceneState.Created;
  private runtimeRoot: Node | null = null;
  private renderer: LobbyRenderer | null = null;
  private debugPanel: LobbyDebugPanel | null = null;

  constructor(
    private readonly sceneEntry: Node,
    private readonly surfaceMaterialTemplate: Material,
  ) {}

  /** 初始化暗红 Low Poly 大厅和 Cocos 内置半球环境光。 */
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
    scene.globals.ambient.skyIllum = 500;
    scene.globals.skybox.enabled = false;
    scene.globals.fog.enabled = false;
    scene.globals.shadows.enabled = true;
    scene.globals.shadows.type = renderer.scene.ShadowType.ShadowMap;
    scene.globals.shadows.shadowMapSize = 1024;
    scene.globals.shadows.maxReceived = 1;
    scene.globals.shadows.shadowColor = new Color(12, 1, 4, 200);

    const runtimeRoot = new Node('Lobby');
    this.sceneEntry.addChild(runtimeRoot);
    let lobbyRenderer: LobbyRenderer | null = null;
    let debugPanel: LobbyDebugPanel | null = null;
    try {
      lobbyRenderer = new LobbyRenderer(runtimeRoot, this.surfaceMaterialTemplate);
      const lightingRig = createLobbyLighting(runtimeRoot);
      createLobbyCamera(runtimeRoot);
      debugPanel = new LobbyDebugPanel(
        new LobbyDebugControls(scene, lightingRig),
      );
    } catch (error: unknown) {
      debugPanel?.dispose();
      lobbyRenderer?.dispose();
      runtimeRoot.destroy();
      this.state = LobbySceneState.Disposed;
      throw error;
    }

    this.runtimeRoot = runtimeRoot;
    this.renderer = lobbyRenderer;
    this.debugPanel = debugPanel;
    this.state = LobbySceneState.Initialized;
  }

  /** 释放程序化 Mesh、材质和场景节点。 */
  public dispose(): void {
    if (this.state === LobbySceneState.Disposed) {
      return;
    }
    this.debugPanel?.dispose();
    this.renderer?.dispose();
    if (this.runtimeRoot?.isValid === true) {
      this.runtimeRoot.destroy();
    }
    this.runtimeRoot = null;
    this.renderer = null;
    this.debugPanel = null;
    this.state = LobbySceneState.Disposed;
  }
}
