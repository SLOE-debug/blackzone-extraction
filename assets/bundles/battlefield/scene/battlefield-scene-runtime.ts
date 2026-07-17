import { Color, director, type Material, Node, renderer } from 'cc';
import { type SceneRuntime } from '../../../core/contracts/scene-runtime';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { VanguardAction, VanguardPopulation } from '../../../player/vanguard';
import { BattlefieldDebugControls } from '../debug/battlefield-debug-controls';
import { BattlefieldDebugPanel } from '../debug/battlefield-debug-panel';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import { BattlefieldMonsterPopulation } from '../population/battlefield-monster-population';
import { BattlefieldRenderer } from '../rendering/battlefield-renderer';
import { createBattlefieldCamera, type BattlefieldCameraRig } from './battlefield-camera';
import { createBattlefieldLighting } from './battlefield-lighting';

enum BattlefieldSceneState {
  Created,
  Initialized,
  Disposed,
}

/** 战场场景门面，只编排环境、玩家、灯光、相机和怪物群体生命周期。 */
export class BattlefieldSceneRuntime implements SceneRuntime {
  private state = BattlefieldSceneState.Created;
  private runtimeRoot: Node | null = null;
  private renderer: BattlefieldRenderer | null = null;
  private player: VanguardPopulation | null = null;
  private monsters: BattlefieldMonsterPopulation | null = null;
  private cameraRig: BattlefieldCameraRig | null = null;
  private debugPanel: BattlefieldDebugPanel | null = null;

  constructor(
    private readonly sceneEntry: Node,
    private readonly surfaceMaterialTemplate: Material,
  ) {}

  /** 在全部资源创建成功后提交战场全局光照与阴影设置。 */
  public initialize(commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>): void {
    if (this.state !== BattlefieldSceneState.Created) {
      throw new Error('战场场景只能初始化一次。');
    }
    const scene = director.getScene();
    if (scene === null) {
      throw new Error('战场初始化时没有活动场景。');
    }

    const runtimeRoot = new Node('Battlefield');
    this.sceneEntry.addChild(runtimeRoot);
    let battlefieldRenderer: BattlefieldRenderer | null = null;
    let player: VanguardPopulation | null = null;
    let monsters: BattlefieldMonsterPopulation | null = null;
    let cameraRig: BattlefieldCameraRig | null = null;
    let debugPanel: BattlefieldDebugPanel | null = null;
    try {
      battlefieldRenderer = new BattlefieldRenderer(runtimeRoot, this.surfaceMaterialTemplate);
      player = new VanguardPopulation(runtimeRoot, this.surfaceMaterialTemplate, {
        position: BATTLEFIELD_LAYOUT.playerPosition,
        heading: Math.PI,
        action: VanguardAction.Idle,
      });
      monsters = new BattlefieldMonsterPopulation(
        runtimeRoot,
        this.surfaceMaterialTemplate,
        commonMonsters,
      );
      const lightingRig = createBattlefieldLighting(runtimeRoot);
      cameraRig = createBattlefieldCamera(runtimeRoot);

      scene.globals.ambient.skyLightingColor = new Color(38, 48, 44, 255);
      scene.globals.ambient.groundLightingColor = new Color(9, 14, 13, 255);
      scene.globals.ambient.skyIllum = 920;
      scene.globals.skybox.enabled = false;
      scene.globals.fog.enabled = false;
      scene.globals.shadows.enabled = true;
      scene.globals.shadows.type = renderer.scene.ShadowType.ShadowMap;
      scene.globals.shadows.shadowMapSize = 512;
      scene.globals.shadows.maxReceived = 2;
      scene.globals.shadows.shadowColor = new Color(5, 8, 8, 190);

      debugPanel = new BattlefieldDebugPanel(
        new BattlefieldDebugControls(scene, lightingRig, cameraRig),
      );
    } catch (error: unknown) {
      debugPanel?.dispose();
      cameraRig?.dispose();
      monsters?.dispose();
      player?.dispose();
      battlefieldRenderer?.dispose();
      runtimeRoot.destroy();
      this.state = BattlefieldSceneState.Disposed;
      throw error;
    }

    this.runtimeRoot = runtimeRoot;
    this.renderer = battlefieldRenderer;
    this.player = player;
    this.monsters = monsters;
    this.cameraRig = cameraRig;
    this.debugPanel = debugPanel;
    this.state = BattlefieldSceneState.Initialized;
  }

  /** 推进玩家待机姿态和玩家附近的基础怪物群体。 */
  public update(deltaTime: number): void {
    if (this.state !== BattlefieldSceneState.Initialized) {
      return;
    }
    this.player?.update(deltaTime);
    this.monsters?.update(deltaTime);
    this.cameraRig?.update(deltaTime);
  }

  /** 释放战场程序化 Mesh、动态实体与场景节点。 */
  public dispose(): void {
    if (this.state === BattlefieldSceneState.Disposed) {
      return;
    }
    this.debugPanel?.dispose();
    this.cameraRig?.dispose();
    this.monsters?.dispose();
    this.player?.dispose();
    this.renderer?.dispose();
    if (this.runtimeRoot?.isValid === true) {
      this.runtimeRoot.destroy();
    }
    this.runtimeRoot = null;
    this.renderer = null;
    this.player = null;
    this.monsters = null;
    this.cameraRig = null;
    this.debugPanel = null;
    this.state = BattlefieldSceneState.Disposed;
  }
}
