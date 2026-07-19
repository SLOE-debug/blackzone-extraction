import { Color, type Material, Node, type Scene } from 'cc';
import { type SceneRuntime } from '../../../core/contracts/scene-runtime';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import {
  VanguardAction,
  type VanguardControlIntent,
  VanguardPopulation,
} from '../../../player/vanguard';
import { BattlefieldDebugControls } from '../debug/battlefield-debug-controls';
import { BattlefieldDebugPanel } from '../debug/battlefield-debug-panel';
import {
  BattlefieldEnvironmentPopulation,
  type MutableBattlefieldMonsterNestPosition,
} from '../environment/population/battlefield-environment-population';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import {
  type MutableBattlefieldAimTarget,
  type BattlefieldMonsterCombatTarget,
  BattlefieldMonsterPopulation,
} from '../population/battlefield-monster-population';
import { BattlefieldRenderer } from '../rendering/battlefield-renderer';
import { BattlefieldControlHud } from '../ui/battlefield-control-hud';
import {
  createBattlefieldCamera,
  type BattlefieldCameraRig,
} from './battlefield-camera';
import { type MutableBattlefieldPlanarDirection } from './battlefield-camera-direction';
import { BATTLEFIELD_LIGHTING } from './battlefield-lighting';

enum BattlefieldSceneState {
  Created,
  Initialized,
  Disposed,
}

interface MutableVanguardControlIntent extends VanguardControlIntent {
  moveX: number;
  moveZ: number;
  aimX: number;
  aimZ: number;
  aiming: boolean;
}

interface MutableBattlefieldMonsterCombatTarget extends BattlefieldMonsterCombatTarget {
  x: number;
  z: number;
  collisionRadius: number;
}

/** 战场场景门面，只编排环境、玩家、相机和怪物群体生命周期。 */
export class BattlefieldSceneRuntime implements SceneRuntime {
  private state = BattlefieldSceneState.Created;
  private runtimeRoot: Node | null = null;
  private renderer: BattlefieldRenderer | null = null;
  private environment: BattlefieldEnvironmentPopulation | null = null;
  private player: VanguardPopulation | null = null;
  private monsters: BattlefieldMonsterPopulation | null = null;
  private cameraRig: BattlefieldCameraRig | null = null;
  private controlHud: BattlefieldControlHud | null = null;
  private debugPanel: BattlefieldDebugPanel | null = null;
  private readonly movementDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 0 };
  private readonly aimDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 1 };
  private readonly aimTarget: MutableBattlefieldAimTarget = { entityId: -1, x: 0, z: 0 };
  private readonly nearestNest: MutableBattlefieldMonsterNestPosition = { x: 0, z: 0 };
  private readonly monsterCombatTarget: MutableBattlefieldMonsterCombatTarget = {
    x: 0,
    z: 0,
    collisionRadius: 0,
  };
  private readonly playerControlIntent: MutableVanguardControlIntent = {
    moveX: 0,
    moveZ: 0,
    aimX: 0,
    aimZ: 1,
    aiming: false,
  };

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
    let monsters: BattlefieldMonsterPopulation | null = null;
    let cameraRig: BattlefieldCameraRig | null = null;
    let controlHud: BattlefieldControlHud | null = null;
    let debugPanel: BattlefieldDebugPanel | null = null;
    try {
      battlefieldRenderer = new BattlefieldRenderer(runtimeRoot, this.surfaceMaterialTemplate);
      environment = new BattlefieldEnvironmentPopulation(runtimeRoot);
      player = new VanguardPopulation(runtimeRoot, this.surfaceMaterialTemplate, {
        position: BATTLEFIELD_LAYOUT.playerPosition,
        heading: Math.PI,
        action: VanguardAction.Idle,
      }, environment.movementConstraint);
      monsters = new BattlefieldMonsterPopulation(
        runtimeRoot,
        this.surfaceMaterialTemplate,
        commonMonsters,
      );
      cameraRig = createBattlefieldCamera(runtimeRoot);
      cameraRig.setFollowTarget(player.positionX, player.positionY, player.positionZ, true);
      controlHud = new BattlefieldControlHud(runtimeRoot);

      this.scene.globals.ambient.skyLightingColor = new Color(38, 48, 44, 255);
      this.scene.globals.ambient.groundLightingColor = new Color(9, 14, 13, 255);
      this.scene.globals.ambient.skyIllum = BATTLEFIELD_LIGHTING.ambientIlluminance;
      this.scene.globals.skybox.enabled = false;
      this.scene.globals.fog.enabled = false;
      this.scene.globals.shadows.enabled = BATTLEFIELD_LIGHTING.shadowsEnabled;

      debugPanel = new BattlefieldDebugPanel(
        new BattlefieldDebugControls(this.scene, cameraRig),
      );
    } catch (error: unknown) {
      debugPanel?.dispose();
      controlHud?.dispose();
      cameraRig?.dispose();
      monsters?.dispose();
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
    this.monsters = monsters;
    this.cameraRig = cameraRig;
    this.controlHud = controlHud;
    this.debugPanel = debugPanel;
    this.state = BattlefieldSceneState.Initialized;
  }

  /** 推进双摇杆输入、玩家移动瞄准、怪物群体和跟随相机。 */
  public update(deltaTime: number): void {
    if (this.state !== BattlefieldSceneState.Initialized) {
      return;
    }
    this.controlHud?.update();
    this.applyPlayerControlIntent();
    this.player?.update(deltaTime);
    if (this.player !== null) {
      const environmentChanged = this.environment?.update(
        this.player.positionX,
        this.player.positionZ,
      ) ?? false;
      if (environmentChanged
        && this.environment !== null
        && this.monsters !== null
        && !this.environment.containsMonsterNest(this.monsters.nestX, this.monsters.nestZ)
        && this.environment.writeNearestMonsterNest(
          this.player.positionX,
          this.player.positionZ,
          this.nearestNest,
        )) {
        this.monsters.relocateToNest(this.nearestNest.x, this.nearestNest.z);
      }
      this.renderer?.updateCenter(this.player.positionX, this.player.positionZ);
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
    if (this.player !== null && this.cameraRig !== null) {
      this.cameraRig.setFollowTarget(
        this.player.positionX,
        this.player.positionY,
        this.player.positionZ,
      );
    }
    this.cameraRig?.update(deltaTime);
  }

  /** 释放战场程序化 Mesh、动态实体与场景节点。 */
  public dispose(): void {
    if (this.state === BattlefieldSceneState.Disposed) {
      return;
    }
    this.state = BattlefieldSceneState.Disposed;
    this.debugPanel?.dispose();
    this.controlHud?.dispose();
    this.cameraRig?.dispose();
    this.monsters?.dispose();
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
    this.monsters = null;
    this.cameraRig = null;
    this.controlHud = null;
    this.debugPanel = null;
  }

  /** 将屏幕摇杆映射为世界方向，并在右摇杆方向附近应用轻量怪物吸附。 */
  private applyPlayerControlIntent(): void {
    const player = this.player;
    const monsters = this.monsters;
    const cameraRig = this.cameraRig;
    const controls = this.controlHud?.state;
    if (player === null || monsters === null || cameraRig === null || controls === undefined) {
      return;
    }
    cameraRig.queueOrbitRotation(controls.cameraOrbitDeltaX);
    cameraRig.writeWorldPlanarDirection(
      controls.moveX,
      controls.moveY,
      this.movementDirection,
    );
    const intent = this.playerControlIntent;
    intent.moveX = this.movementDirection.x;
    intent.moveZ = this.movementDirection.z;
    intent.aiming = controls.aiming;

    if (controls.aiming) {
      cameraRig.writeWorldPlanarDirection(controls.aimX, controls.aimY, this.aimDirection);
      if (monsters.resolveAimTarget(
        player.positionX,
        player.positionZ,
        this.aimDirection.x,
        this.aimDirection.z,
        this.aimTarget,
      )) {
        const targetDeltaX = this.aimTarget.x - player.positionX;
        const targetDeltaZ = this.aimTarget.z - player.positionZ;
        const inverseDistance = 1 / Math.max(Math.hypot(targetDeltaX, targetDeltaZ), 0.0001);
        this.aimDirection.x = targetDeltaX * inverseDistance;
        this.aimDirection.z = targetDeltaZ * inverseDistance;
      }
      intent.aimX = this.aimDirection.x;
      intent.aimZ = this.aimDirection.z;
    }
    player.setControlIntent(intent);
  }
}
