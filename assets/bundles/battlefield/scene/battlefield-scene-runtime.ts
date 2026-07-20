import { Color, error as logError, type Material, Node, type Scene } from 'cc';
import { BundleService } from '../../../core/bundles/bundle-service';
import { type SceneRuntime } from '../../../core/contracts/scene-runtime';
import { FeatureId, SceneId } from '../../../core/contracts/runtime-id';
import { SceneService } from '../../../core/scenes/scene-service';
import { ChunkRuntimeRegistry } from '../../../core/world/chunk-runtime-registry';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import {
  VanguardAction,
  VanguardPopulation,
  VanguardWeaponPose,
} from '../../../player/vanguard';
import { BattlefieldPlayerAimController } from '../combat/battlefield-player-aim-controller';
import { BattlefieldDebugControls } from '../debug/battlefield-debug-controls';
import { BattlefieldDebugPanel } from '../debug/battlefield-debug-panel';
import { BattlefieldEnvironmentPopulation } from '../environment/population/battlefield-environment-population';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../equipment/model/battlefield-equipment-library';
import { BattlefieldEquipmentPickupSystem } from '../equipment/population/battlefield-equipment-pickup-system';
import {
  type BattlefieldWeaponOwnerPose,
  BattlefieldPlayerWeaponRuntime,
} from '../equipment/population/battlefield-player-weapon-runtime';
import { BattlefieldSceneInteractionSystem } from '../interaction/population/battlefield-scene-interaction-system';
import { BATTLEFIELD_TREASURE_LOOT_TABLE } from '../loot/model/battlefield-treasure-loot-table';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import {
  type MutableBattlefieldAimTarget,
  type BattlefieldMonsterCombatTarget,
  BattlefieldMonsterPopulation,
} from '../population/battlefield-monster-population';
import { BattlefieldRenderer } from '../rendering/battlefield-renderer';
import { BattlefieldTreasurePopulation } from '../treasure-chest/population/battlefield-treasure-population';
import { BattlefieldControlHud } from '../ui/battlefield-control-hud';
import {
  createBattlefieldCamera,
  type BattlefieldCameraRig,
} from './battlefield-camera';
import { BATTLEFIELD_LIGHTING } from './battlefield-lighting';

enum BattlefieldSceneState {
  Created,
  Initialized,
  Disposed,
}

interface MutableBattlefieldMonsterCombatTarget extends BattlefieldMonsterCombatTarget {
  x: number;
  z: number;
  collisionRadius: number;
}

interface MutableBattlefieldWeaponOwnerPose extends BattlefieldWeaponOwnerPose {
  leftX: number;
  leftY: number;
  leftZ: number;
  rightX: number;
  rightY: number;
  rightZ: number;
  heading: number;
  alive: boolean;
}

/** 战场场景门面，只编排环境、玩家、相机和怪物群体生命周期。 */
export class BattlefieldSceneRuntime implements SceneRuntime {
  private readonly bundleService = new BundleService();
  private readonly sceneService = new SceneService(this.bundleService);
  private readonly playerAim = new BattlefieldPlayerAimController();
  private state = BattlefieldSceneState.Created;
  private runtimeRoot: Node | null = null;
  private renderer: BattlefieldRenderer | null = null;
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
  private readonly monsterCombatTarget: MutableBattlefieldMonsterCombatTarget = {
    x: 0,
    z: 0,
    collisionRadius: 0,
  };
  private readonly weaponOwnerPose: MutableBattlefieldWeaponOwnerPose = {
    leftX: 0,
    leftY: 0,
    leftZ: 0,
    rightX: 0,
    rightY: 0,
    rightZ: 0,
    heading: 0,
    alive: true,
  };
  private readonly weaponAimTarget: MutableBattlefieldAimTarget = {
    x: 0,
    y: 0,
    z: 0,
  };
  private weaponFiringRequested = false;
  private defeatPresented = false;
  private returningToLobby = false;

  constructor(
    private readonly sceneEntry: Node,
    private readonly scene: Scene,
    private readonly surfaceMaterialTemplate: Material,
  ) {}

  /** 在全部资源创建成功后提交战场环境光和无阴影设置。 */
  public initialize(commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>): void {
    if (this.state !== BattlefieldSceneState.Created) {
      throw new Error('战场场景只能初始化一次。');
    }
    const runtimeRoot = new Node('Battlefield');
    this.sceneEntry.addChild(runtimeRoot);
    let battlefieldRenderer: BattlefieldRenderer | null = null;
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
    try {
      battlefieldRenderer = new BattlefieldRenderer(runtimeRoot, this.surfaceMaterialTemplate);
      environment = new BattlefieldEnvironmentPopulation(runtimeRoot);
      player = new VanguardPopulation(runtimeRoot, this.surfaceMaterialTemplate, {
        position: BATTLEFIELD_LAYOUT.playerPosition,
        heading: Math.PI,
        action: VanguardAction.Idle,
      }, environment.movementConstraint);
      playerWeapon = new BattlefieldPlayerWeaponRuntime(
        runtimeRoot,
        this.surfaceMaterialTemplate,
        BATTLEFIELD_EQUIPMENT_LIBRARY,
      );
      monsters = new BattlefieldMonsterPopulation(
        runtimeRoot,
        this.surfaceMaterialTemplate,
        commonMonsters,
      );
      treasures = new BattlefieldTreasurePopulation(
        runtimeRoot,
        this.surfaceMaterialTemplate,
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
      cameraRig = createBattlefieldCamera(runtimeRoot);
      cameraRig.setFollowTarget(player.positionX, player.positionY, player.positionZ, true);
      controlHud = new BattlefieldControlHud(
        runtimeRoot,
        cameraRig.camera,
        BATTLEFIELD_EQUIPMENT_LIBRARY,
        this.handleReturnToLobbyRequested,
      );
      controlHud.presentPlayerHealth(player.health, player.maximumHealth);
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

      this.scene.globals.ambient.skyLightingColor = new Color(38, 48, 44, 255);
      this.scene.globals.ambient.groundLightingColor = new Color(9, 14, 13, 255);
      this.scene.globals.ambient.skyIllum = BATTLEFIELD_LIGHTING.ambientIlluminance;
      this.scene.globals.skybox.enabled = false;
      this.scene.globals.fog.enabled = false;
      this.scene.globals.shadows.enabled = BATTLEFIELD_LIGHTING.shadowsEnabled;

      debugPanel = new BattlefieldDebugPanel(
        new BattlefieldDebugControls(this.scene, cameraRig, player, monsters),
      );
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
      battlefieldRenderer?.dispose();
      runtimeRoot.destroy();
      this.state = BattlefieldSceneState.Disposed;
      throw error;
    }

    this.runtimeRoot = runtimeRoot;
    this.renderer = battlefieldRenderer;
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
    this.state = BattlefieldSceneState.Initialized;
  }

  /** 推进双摇杆输入、玩家移动瞄准、怪物群体和跟随相机。 */
  public update(deltaTime: number): void {
    if (this.state !== BattlefieldSceneState.Initialized) {
      return;
    }
    this.controlHud?.update();
    if (this.returningToLobby) {
      return;
    }
    this.interactionSystem?.consumeActionInput();
    this.weaponFiringRequested = this.applyPlayerControlIntent();
    this.player?.update(deltaTime);
    if (this.player !== null) {
      this.environment?.update(
        this.player.positionX,
        this.player.positionZ,
      );
      const chunkTransition = this.environment?.consumeChunkTransition() ?? null;
      if (chunkTransition !== null && this.environment !== null) {
        this.chunkRuntimes?.synchronize(chunkTransition, this.environment);
      }
      this.renderer?.updateCenter(this.player.positionX, this.player.positionZ);
    }
    if (this.player !== null && this.monsters !== null && this.playerWeapon !== null) {
      const pose = this.weaponOwnerPose;
      this.player.writeWeaponSockets(pose);
      pose.heading = this.player.heading;
      pose.alive = this.player.isAlive;
      this.playerWeapon.update(
        deltaTime,
        pose,
        this.weaponFiringRequested ? this.weaponAimTarget : null,
        this.monsters,
      );
    }
    if (this.player !== null && this.monsters !== null) {
      const target = this.monsterCombatTarget;
      target.x = this.player.positionX;
      target.z = this.player.positionZ;
      target.collisionRadius = this.player.collisionRadius;
      const attackDamage = this.monsters.update(
        deltaTime,
        this.player.isAlive ? target : null,
      );
      if (attackDamage > 0) {
        this.player.damage(attackDamage);
      }
    } else {
      this.monsters?.update(deltaTime, null);
    }
    if (this.player !== null) {
      this.controlHud?.presentPlayerHealth(
        this.player.health,
        this.player.maximumHealth,
      );
    }
    this.presentDefeatIfNeeded();
    this.treasures?.update(deltaTime);
    if (this.player !== null && this.cameraRig !== null) {
      this.cameraRig.setFollowTarget(
        this.player.positionX,
        this.player.positionY,
        this.player.positionZ,
      );
    }
    this.cameraRig?.update(deltaTime);
    if (this.player !== null) {
      this.interactionSystem?.synchronize(this.player.positionX, this.player.positionZ);
    }
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
    this.renderer?.dispose();
    if (this.runtimeRoot?.isValid === true) {
      this.runtimeRoot.destroy();
    }
    this.runtimeRoot = null;
    this.renderer = null;
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
  }

  /** 将屏幕摇杆映射为世界方向，并在右摇杆方向附近应用轻量怪物吸附。 */
  private applyPlayerControlIntent(): boolean {
    const player = this.player;
    const monsters = this.monsters;
    const cameraRig = this.cameraRig;
    const controls = this.controlHud?.state;
    if (player === null || monsters === null || cameraRig === null || controls === undefined) {
      return false;
    }
    if (!player.isAlive) {
      return false;
    }
    return this.playerAim.apply(
      player,
      monsters,
      cameraRig,
      controls,
      this.playerWeapon?.vanguardWeaponPose ?? VanguardWeaponPose.Unarmed,
      this.playerWeapon?.vanguardAttackAnimationAmount ?? 0,
      this.weaponAimTarget,
    );
  }

  /** 首次观察到玩家生命归零时冻结交互并显示死亡弹窗。 */
  private presentDefeatIfNeeded(): void {
    if (this.defeatPresented || this.player?.isAlive !== false) {
      return;
    }
    this.defeatPresented = true;
    this.weaponFiringRequested = false;
    this.interactionSystem?.suspend();
    this.controlHud?.showDefeatDialog();
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
