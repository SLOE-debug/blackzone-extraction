import { error as logError, type EffectAsset, type Material, Node, type Scene } from 'cc';
import { BundleService } from '../../../core/bundles/bundle-service';
import { type SceneRuntime } from '../../../core/contracts/scene-runtime';
import { FeatureId, SceneId } from '../../../core/contracts/runtime-id';
import { SceneService } from '../../../core/scenes/scene-service';
import { ChunkRuntimeRegistry } from '../../../core/world/chunk-runtime-registry';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import {
  VanguardAction,
  VanguardPopulation,
  VanguardRenderMode,
} from '../../../player/vanguard';
import { BattlefieldDebugControls } from '../debug/battlefield-debug-controls';
import { BattlefieldDebugPanel } from '../debug/battlefield-debug-panel';
import { BattlefieldPerformanceLogger } from '../debug/battlefield-performance-logger';
import { BattlefieldEnvironmentPopulation } from '../environment/population/battlefield-environment-population';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../equipment/catalog/battlefield-equipment-catalog';
import { BattlefieldEquipmentPickupSystem } from '../equipment/population/battlefield-equipment-pickup-system';
import { BattlefieldPlayerWeaponRuntime } from '../equipment/population/battlefield-player-weapon-runtime';
import { BattlefieldSceneInteractionSystem } from '../interaction/population/battlefield-scene-interaction-system';
import { BATTLEFIELD_TREASURE_LOOT_TABLE } from '../loot/model/battlefield-treasure-loot-table';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import {
  BattlefieldMonsterPopulation,
} from '../population/battlefield-monster-population';
import { BattlefieldGroundRenderer } from '../rendering/battlefield-ground-renderer';
import { BattlefieldTreasurePopulation } from '../treasure-chest/population/battlefield-treasure-population';
import { BattlefieldControlHud } from '../ui/battlefield-control-hud';
import {
  createBattlefieldCamera,
  type BattlefieldCameraRig,
} from './battlefield-camera';
import { BattlefieldWorld } from '../world/battlefield-world';

enum BattlefieldSceneState {
  Created,
  Initialized,
  Disposed,
}

/** 战场场景门面，只编排环境、玩家、相机和怪物群体生命周期。 */
export class BattlefieldSceneRuntime implements SceneRuntime {
  private readonly bundleService = new BundleService();
  private readonly sceneService = new SceneService(this.bundleService);
  private readonly performanceLogger = new BattlefieldPerformanceLogger();
  private state = BattlefieldSceneState.Created;
  private runtimeRoot: Node | null = null;
  private groundRenderer: BattlefieldGroundRenderer | null = null;
  private environment: BattlefieldEnvironmentPopulation | null = null;
  private player: VanguardPopulation | null = null;
  private playerWeapon: BattlefieldPlayerWeaponRuntime | null = null;
  private monsters: BattlefieldMonsterPopulation | null = null;
  private treasures: BattlefieldTreasurePopulation | null = null;
  private chunkRuntimes: ChunkRuntimeRegistry<BattlefieldEnvironmentPopulation> | null = null;
  private cameraRig: BattlefieldCameraRig | null = null;
  private controlHud: BattlefieldControlHud | null = null;
  private interactionSystem: BattlefieldSceneInteractionSystem | null = null;
  private debugPanel: BattlefieldDebugPanel | null = null;
  private world: BattlefieldWorld | null = null;
  private returningToLobby = false;

  constructor(
    private readonly sceneEntry: Node,
    private readonly scene: Scene,
    private readonly surfaceMaterialTemplate: Material,
    private readonly curveCrawlerGpuEffect: EffectAsset,
  ) {}

  /** 创建全部战场资源，并把批量蜘蛛绑定到已加载的 GPU 形变 Effect。 */
  public initialize(commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>): void {
    if (this.state !== BattlefieldSceneState.Created) {
      throw new Error('战场场景只能初始化一次。');
    }
    const runtimeRoot = new Node('Battlefield');
    this.sceneEntry.addChild(runtimeRoot);
    let groundRenderer: BattlefieldGroundRenderer | null = null;
    let environment: BattlefieldEnvironmentPopulation | null = null;
    let player: VanguardPopulation | null = null;
    let playerWeapon: BattlefieldPlayerWeaponRuntime | null = null;
    let monsters: BattlefieldMonsterPopulation | null = null;
    let treasures: BattlefieldTreasurePopulation | null = null;
    let chunkRuntimes: ChunkRuntimeRegistry<BattlefieldEnvironmentPopulation> | null = null;
    let cameraRig: BattlefieldCameraRig | null = null;
    let controlHud: BattlefieldControlHud | null = null;
    let interactionSystem: BattlefieldSceneInteractionSystem | null = null;
    let debugPanel: BattlefieldDebugPanel | null = null;
    let world: BattlefieldWorld | null = null;
    try {
      groundRenderer = new BattlefieldGroundRenderer(runtimeRoot);
      environment = new BattlefieldEnvironmentPopulation(runtimeRoot);
      player = new VanguardPopulation(
        runtimeRoot,
        this.surfaceMaterialTemplate,
        VanguardRenderMode.Unlit,
        {
          position: BATTLEFIELD_LAYOUT.playerPosition,
          heading: Math.PI,
          action: VanguardAction.Idle,
        },
        environment.movementConstraint,
      );
      cameraRig = createBattlefieldCamera(runtimeRoot);
      cameraRig.setFollowTarget(player.positionX, player.positionY, player.positionZ, true);
      playerWeapon = new BattlefieldPlayerWeaponRuntime(
        runtimeRoot,
        BATTLEFIELD_EQUIPMENT_LIBRARY,
      );
      monsters = new BattlefieldMonsterPopulation(
        runtimeRoot,
        this.surfaceMaterialTemplate,
        commonMonsters,
        this.curveCrawlerGpuEffect,
        cameraRig.camera,
        player.positionX,
        player.positionZ,
      );
      treasures = new BattlefieldTreasurePopulation(
        runtimeRoot,
        BATTLEFIELD_EQUIPMENT_LIBRARY,
        BATTLEFIELD_TREASURE_LOOT_TABLE,
      );
      chunkRuntimes = new ChunkRuntimeRegistry<BattlefieldEnvironmentPopulation>();
      chunkRuntimes.register(treasures);
      const initialChunkTransition = environment.consumeChunkTransition();
      if (initialChunkTransition === null) {
        throw new Error('战场环境初始化后缺少首个 Chunk 窗口差集。');
      }
      chunkRuntimes.synchronize(initialChunkTransition, environment);
      treasures.completeInitialRendering();
      controlHud = new BattlefieldControlHud(
        runtimeRoot,
        cameraRig.camera,
        BATTLEFIELD_EQUIPMENT_LIBRARY,
        this.handleReturnToLobbyRequested,
      );
      controlHud.presentPlayerHealth(player.health, player.maximumHealth);
      controlHud.presentWeaponAmmunition(playerWeapon.ammunitionStatus);
      const equipmentPickup = new BattlefieldEquipmentPickupSystem(
        treasures,
        playerWeapon,
        player,
      );
      interactionSystem = new BattlefieldSceneInteractionSystem(
        treasures,
        equipmentPickup,
        controlHud,
      );
      interactionSystem.synchronize(player.positionX, player.positionZ);

      this.scene.globals.ambient.skyIllum = 0;
      this.scene.globals.skybox.enabled = false;
      this.scene.globals.fog.enabled = false;
      this.scene.globals.shadows.enabled = false;
      this.scene.globals.skin.enabled = false;

      debugPanel = new BattlefieldDebugPanel(
        new BattlefieldDebugControls(
          cameraRig,
          player,
          monsters,
          this.performanceLogger,
        ),
      );
      this.performanceLogger.bindSources(Object.freeze({
        player,
        chunks: chunkRuntimes,
        environment,
        ground: groundRenderer,
        monsters,
        treasures,
      }));
      world = new BattlefieldWorld(Object.freeze({
        performance: this.performanceLogger,
        player,
        camera: cameraRig,
        environment,
        chunks: chunkRuntimes,
        ground: groundRenderer,
        weapon: playerWeapon,
        monsters,
        treasures,
        controls: controlHud,
        interaction: interactionSystem,
      }));
    } catch (error: unknown) {
      debugPanel?.dispose();
      interactionSystem?.dispose();
      controlHud?.dispose();
      cameraRig?.dispose();
      chunkRuntimes?.dispose();
      treasures?.dispose();
      monsters?.dispose();
      playerWeapon?.dispose();
      player?.dispose();
      environment?.dispose();
      groundRenderer?.dispose();
      runtimeRoot.destroy();
      this.state = BattlefieldSceneState.Disposed;
      throw error;
    }

    this.runtimeRoot = runtimeRoot;
    this.groundRenderer = groundRenderer;
    this.environment = environment;
    this.player = player;
    this.playerWeapon = playerWeapon;
    this.monsters = monsters;
    this.treasures = treasures;
    this.chunkRuntimes = chunkRuntimes;
    this.cameraRig = cameraRig;
    this.controlHud = controlHud;
    this.interactionSystem = interactionSystem;
    this.debugPanel = debugPanel;
    this.world = world;
    this.state = BattlefieldSceneState.Initialized;
  }

  /** 把一帧战场推进交给轻量 World 与 Scheduler。 */
  public update(deltaTime: number): void {
    if (this.state !== BattlefieldSceneState.Initialized) {
      return;
    }
    this.world?.step(deltaTime, this.returningToLobby);
  }

  /** 释放战场程序化 Mesh、动态实体与场景节点。 */
  public dispose(): void {
    if (this.state === BattlefieldSceneState.Disposed) {
      return;
    }
    this.state = BattlefieldSceneState.Disposed;
    this.debugPanel?.dispose();
    this.interactionSystem?.dispose();
    this.controlHud?.dispose();
    this.cameraRig?.dispose();
    this.chunkRuntimes?.dispose();
    this.treasures?.dispose();
    this.monsters?.dispose();
    this.playerWeapon?.dispose();
    this.player?.dispose();
    this.environment?.dispose();
    this.groundRenderer?.dispose();
    if (this.runtimeRoot?.isValid === true) {
      this.runtimeRoot.destroy();
    }
    this.runtimeRoot = null;
    this.groundRenderer = null;
    this.environment = null;
    this.player = null;
    this.playerWeapon = null;
    this.monsters = null;
    this.treasures = null;
    this.chunkRuntimes = null;
    this.cameraRig = null;
    this.controlHud = null;
    this.interactionSystem = null;
    this.debugPanel = null;
    this.world = null;
  }

  private readonly handleReturnToLobbyRequested = (): void => {
    void this.returnToLobby();
  };

  /** 加载主包大厅 Scene，成功后先释放战场资源再提交切换。 */
  private async returnToLobby(): Promise<void> {
    if (this.state !== BattlefieldSceneState.Initialized || this.returningToLobby) {
      return;
    }
    this.returningToLobby = true;
    this.controlHud?.setReturnToLobbyPending(true);
    try {
      const lobbyScene = await this.sceneService.load(SceneId.Lobby);
      if (this.state !== BattlefieldSceneState.Initialized) {
        lobbyScene.scene?.destroy();
        return;
      }
      this.dispose();
      this.sceneService.run(lobbyScene);
    } catch (error: unknown) {
      if (this.state === BattlefieldSceneState.Initialized) {
        this.returningToLobby = false;
        this.controlHud?.setReturnToLobbyPending(false);
      }
      const message = error instanceof Error
        ? error.stack ?? error.message
        : String(error);
      logError(`返回大厅失败：${message}`);
    }
  }
}
