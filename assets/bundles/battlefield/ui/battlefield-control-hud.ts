import { type Camera, type EventKeyboard, input, Input, KeyCode, Node } from 'cc';
import { ScreenUiCanvas } from '../../../core/ui/screen-ui-canvas';
import { VirtualJoystick } from '../../../core/ui/virtual-joystick';
import { VirtualJoystickActionIcon } from '../../../core/ui/virtual-joystick-graphics';
import { type BattlefieldEquipmentLibrary } from '../equipment/catalog/battlefield-equipment-contracts';
import { type BattlefieldInventorySnapshot } from '../equipment/inventory/model/battlefield-inventory-state';
import { type BattlefieldInventoryRuntime } from '../equipment/inventory/population/battlefield-inventory-runtime';
import { BattlefieldInventoryHud } from '../equipment/inventory/ui/battlefield-inventory-hud';
import { type BattlefieldHammerStatus } from '../equipment/population/battlefield-player-weapon-runtime';
import {
  BattlefieldEquipmentLabelHud,
  type BattlefieldEquipmentLabelPresentation,
} from '../equipment/ui/battlefield-equipment-label-hud';
import { BattlefieldInteractionAction } from '../interaction/model/battlefield-interaction';
import {
  BattlefieldCameraOrbitInput,
  type MutableBattlefieldCameraAzimuthDelta,
} from './battlefield-camera-orbit-input';
import { BATTLEFIELD_CONTROL_STYLE } from './battlefield-control-style';
import { BattlefieldDefeatDialog } from './battlefield-defeat-dialog';
import { BattlefieldGameplayGraphics } from './battlefield-gameplay-graphics';
import { BattlefieldPlayerStatusHud } from './battlefield-player-status-hud';
import {
  BattlefieldSkillButton,
  BattlefieldSkillButtonCommand,
} from './battlefield-skill-button';

const BATTLEFIELD_INTERACTION_ICONS = Object.freeze({
  [BattlefieldInteractionAction.OpenContainer]: VirtualJoystickActionIcon.OpenContainer,
  [BattlefieldInteractionAction.PickupEquipment]: VirtualJoystickActionIcon.PickupEquipment,
} satisfies Readonly<Record<BattlefieldInteractionAction, VirtualJoystickActionIcon>>);

/** 战场场景持续读取的屏幕空间控制状态。 */
export interface BattlefieldScreenControlState {
  readonly moveX: number;
  readonly moveY: number;
  readonly attackX: number;
  readonly attackY: number;
  readonly attacking: boolean;
  readonly cameraOrbitDeltaX: number;
}

interface MutableBattlefieldScreenControlState {
  moveX: number;
  moveY: number;
  attackX: number;
  attackY: number;
  attacking: boolean;
  cameraOrbitDeltaX: number;
}

/** 装配移动摇杆、攻击摇杆、内嵌技能键和固定物品栏。 */
export class BattlefieldControlHud {
  public readonly state: BattlefieldScreenControlState;
  private readonly canvas: ScreenUiCanvas;
  private readonly gameplayGraphics: BattlefieldGameplayGraphics;
  private readonly movementJoystick: VirtualJoystick;
  private readonly attackJoystick: VirtualJoystick;
  private readonly skillButton: BattlefieldSkillButton;
  private readonly inventoryHud: BattlefieldInventoryHud;
  private readonly equipmentLabel: BattlefieldEquipmentLabelHud;
  private readonly playerStatus: BattlefieldPlayerStatusHud;
  private readonly defeatDialog: BattlefieldDefeatDialog;
  private readonly cameraOrbitInput: BattlefieldCameraOrbitInput;
  private readonly cameraAzimuthDelta: MutableBattlefieldCameraAzimuthDelta = { x: 0 };
  private readonly mutableState: MutableBattlefieldScreenControlState = {
    moveX: 0,
    moveY: 0,
    attackX: 0,
    attackY: 0,
    attacking: false,
    cameraOrbitDeltaX: 0,
  };
  private layoutWidth = -1;
  private layoutHeight = -1;
  private moveUp = false;
  private moveDown = false;
  private moveLeft = false;
  private moveRight = false;
  private attackUp = false;
  private attackDown = false;
  private attackLeft = false;
  private attackRight = false;
  private contextAction: BattlefieldInteractionAction | null = null;
  private contextActionPressed = false;
  private interactionKeyDown = false;
  private inputRegistered = false;
  private inventoryRevision = -1;
  private disposed = false;

  constructor(
    parent: Node,
    worldCamera: Camera,
    equipmentLibrary: BattlefieldEquipmentLibrary,
    private readonly inventory: BattlefieldInventoryRuntime,
    onReturnToLobbyRequested: () => void,
  ) {
    this.state = this.mutableState;
    this.canvas = new ScreenUiCanvas(parent, 'BattlefieldControlCanvas');
    let gameplayGraphics: BattlefieldGameplayGraphics | null = null;
    let movementJoystick: VirtualJoystick | null = null;
    let attackJoystick: VirtualJoystick | null = null;
    let skillButton: BattlefieldSkillButton | null = null;
    let inventoryHud: BattlefieldInventoryHud | null = null;
    let cameraOrbitInput: BattlefieldCameraOrbitInput | null = null;
    let equipmentLabel: BattlefieldEquipmentLabelHud | null = null;
    let playerStatus: BattlefieldPlayerStatusHud | null = null;
    let defeatDialog: BattlefieldDefeatDialog | null = null;
    try {
      gameplayGraphics = new BattlefieldGameplayGraphics(this.canvas.node);
      movementJoystick = new VirtualJoystick(
        this.canvas.node,
        'MovementJoystick',
        BATTLEFIELD_CONTROL_STYLE.movement,
      );
      attackJoystick = new VirtualJoystick(
        this.canvas.node,
        'AttackJoystick',
        BATTLEFIELD_CONTROL_STYLE.attack,
      );
      skillButton = new BattlefieldSkillButton(this.canvas.node);
      inventoryHud = new BattlefieldInventoryHud(this.canvas.node, (slotIndex) => {
        this.inventory.swapWithSecured(slotIndex);
        this.synchronizeInventory();
      });
      cameraOrbitInput = new BattlefieldCameraOrbitInput(this.canvas.node);
      equipmentLabel = new BattlefieldEquipmentLabelHud(
        this.canvas.node,
        worldCamera,
        equipmentLibrary,
      );
      playerStatus = new BattlefieldPlayerStatusHud(this.canvas.node);
      defeatDialog = new BattlefieldDefeatDialog(
        this.canvas.node,
        onReturnToLobbyRequested,
      );
      this.gameplayGraphics = gameplayGraphics;
      this.movementJoystick = movementJoystick;
      this.attackJoystick = attackJoystick;
      this.skillButton = skillButton;
      this.inventoryHud = inventoryHud;
      this.cameraOrbitInput = cameraOrbitInput;
      this.equipmentLabel = equipmentLabel;
      this.playerStatus = playerStatus;
      this.defeatDialog = defeatDialog;
      this.synchronizeInventory();
      this.synchronizeLayout();
      this.synchronizeGameplayGraphics();
      this.canvas.node.active = false;
    } catch (error: unknown) {
      defeatDialog?.dispose();
      playerStatus?.dispose();
      equipmentLabel?.dispose();
      cameraOrbitInput?.dispose();
      inventoryHud?.dispose();
      skillButton?.dispose();
      movementJoystick?.dispose();
      attackJoystick?.dispose();
      gameplayGraphics?.dispose();
      this.canvas.dispose();
      throw error;
    }
  }

  /** 同步布局，并合并触摸摇杆与桌面键盘状态。 */
  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    if (!this.inputRegistered) {
      this.canvas.node.active = true;
      input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
      input.on(Input.EventType.KEY_UP, this.handleKeyUp, this);
      this.inputRegistered = true;
    }
    this.canvas.synchronizeFrame();
    this.synchronizeLayout();
    this.skillButton.update(deltaTime);
    this.writeMovementState();
    this.writeAttackState();
    this.writeCameraOrbitState();
    this.defeatDialog.update();
    this.synchronizeInventory();
    if (this.attackJoystick.consumeActionPress()) {
      this.contextActionPressed = true;
    }
    this.synchronizeGameplayGraphics();
  }

  /** 右摇杆中心显示开启/拾取，但技能键始终保持独立。 */
  public setContextAction(action: BattlefieldInteractionAction | null): void {
    if (this.disposed || this.contextAction === action) {
      return;
    }
    this.contextAction = action;
    this.contextActionPressed = false;
    this.attackJoystick.setActionIcon(
      action === null ? null : BATTLEFIELD_INTERACTION_ICONS[action],
    );
    if (action !== null) {
      this.clearAttackState();
    }
    this.synchronizeGameplayGraphics();
  }

  public consumeContextActionPress(): boolean {
    const pressed = this.contextAction !== null && this.contextActionPressed;
    this.contextActionPressed = false;
    return pressed;
  }

  public consumeSkillCommand(): BattlefieldSkillButtonCommand {
    return this.skillButton.consumeCommand();
  }

  public presentHammerStatus(status: Readonly<BattlefieldHammerStatus>): void {
    this.skillButton.presentCharge(
      status.hitCount,
      status.requiredHits,
      status.momentumReady,
    );
    this.synchronizeGameplayGraphics();
  }

  public presentInventory(snapshot: Readonly<BattlefieldInventorySnapshot>): void {
    this.inventoryRevision = snapshot.revision;
    this.inventoryHud.present(snapshot);
    this.synchronizeGameplayGraphics();
  }

  /** 仅在物品栏版本变化时生成新快照并刷新 HUD。 */
  public synchronizeInventory(): void {
    if (this.inventoryRevision === this.inventory.revision) {
      return;
    }
    this.presentInventory(this.inventory.createSnapshot());
  }

  public presentEquipmentLabel(
    presentation: Readonly<BattlefieldEquipmentLabelPresentation> | null,
  ): void {
    this.equipmentLabel.present(presentation);
  }

  public presentPlayerHealth(health: number, maximumHealth: number): void {
    this.playerStatus.present(health, maximumHealth);
    this.synchronizeGameplayGraphics();
  }

  public showDefeatDialog(): void {
    if (this.disposed) {
      return;
    }
    this.setContextAction(null);
    this.presentEquipmentLabel(null);
    this.defeatDialog.show();
  }

  public setReturnToLobbyPending(pending: boolean): void {
    this.defeatDialog.setPending(pending);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.inputRegistered) {
      input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
      input.off(Input.EventType.KEY_UP, this.handleKeyUp, this);
    }
    this.cameraOrbitInput.dispose();
    this.defeatDialog.dispose();
    this.playerStatus.dispose();
    this.equipmentLabel.dispose();
    this.inventoryHud.dispose();
    this.skillButton.dispose();
    this.movementJoystick.dispose();
    this.attackJoystick.dispose();
    this.gameplayGraphics.dispose();
    this.canvas.dispose();
    this.inputRegistered = false;
  }

  private synchronizeLayout(): void {
    const width = this.canvas.transform.width;
    const height = this.canvas.transform.height;
    if (width === this.layoutWidth && height === this.layoutHeight) {
      return;
    }
    const style = BATTLEFIELD_CONTROL_STYLE;
    const maximumInteractionRadius = Math.max(
      style.movement.interactionRadius,
      style.attack.interactionRadius,
    );
    const maximumHorizontalInset = Math.max(
      0,
      width * 0.5
        - style.movement.interactionRadius
        - style.attack.interactionRadius
        - style.minimumCenterGap * 0.5,
    );
    const horizontalInset = Math.min(style.horizontalEdgeInset, maximumHorizontalInset);
    const bottomInset = Math.min(
      style.bottomEdgeInset,
      Math.max(0, height - maximumInteractionRadius * 2),
    );
    const leftX = -width * 0.5 + style.movement.interactionRadius + horizontalInset;
    const rightX = width * 0.5 - style.attack.interactionRadius - horizontalInset;
    const centerY = -height * 0.5 + maximumInteractionRadius + bottomInset;
    this.movementJoystick.setPosition(leftX, centerY);
    this.attackJoystick.setPosition(rightX, centerY);
    this.skillButton.setPosition(
      rightX + style.attack.radius * 0.62,
      centerY + style.attack.radius * 0.62,
    );
    this.inventoryHud.synchronizeLayout(width, height);
    this.playerStatus.synchronizeLayout(width, height);
    this.layoutWidth = width;
    this.layoutHeight = height;
  }

  private synchronizeGameplayGraphics(): void {
    this.gameplayGraphics.synchronize(
      this.canvas.transform.width,
      this.canvas.transform.height,
      this.movementJoystick,
      this.attackJoystick,
      this.playerStatus,
      this.skillButton,
      this.inventoryHud,
    );
  }

  private writeMovementState(): void {
    const joystick = this.movementJoystick.value;
    if (joystick.magnitude > 0) {
      this.mutableState.moveX = joystick.x;
      this.mutableState.moveY = joystick.y;
      return;
    }
    const keyboardX = Number(this.moveRight) - Number(this.moveLeft);
    const keyboardY = Number(this.moveUp) - Number(this.moveDown);
    const inverseLength = keyboardX !== 0 && keyboardY !== 0 ? Math.SQRT1_2 : 1;
    this.mutableState.moveX = keyboardX * inverseLength;
    this.mutableState.moveY = keyboardY * inverseLength;
  }

  private writeAttackState(): void {
    if (this.contextAction !== null) {
      this.clearAttackState();
      return;
    }
    const joystick = this.attackJoystick.value;
    let attackX = joystick.x;
    let attackY = joystick.y;
    let magnitude = joystick.magnitude;
    if (magnitude <= 0) {
      attackX = Number(this.attackRight) - Number(this.attackLeft);
      attackY = Number(this.attackUp) - Number(this.attackDown);
      magnitude = Math.hypot(attackX, attackY);
    }
    const attacking = magnitude > 0;
    const inverseLength = attacking ? 1 / Math.max(Math.hypot(attackX, attackY), 0.0001) : 0;
    this.mutableState.attackX = attackX * inverseLength;
    this.mutableState.attackY = attackY * inverseLength;
    this.mutableState.attacking = attacking;
  }

  private clearAttackState(): void {
    this.mutableState.attackX = 0;
    this.mutableState.attackY = 0;
    this.mutableState.attacking = false;
  }

  private writeCameraOrbitState(): void {
    this.cameraOrbitInput.consume(this.cameraAzimuthDelta);
    this.mutableState.cameraOrbitDeltaX = this.cameraAzimuthDelta.x;
  }

  private handleKeyDown(event: EventKeyboard): void {
    this.setKeyState(event.keyCode, true);
  }

  private handleKeyUp(event: EventKeyboard): void {
    this.setKeyState(event.keyCode, false);
  }

  private setKeyState(keyCode: KeyCode, pressed: boolean): void {
    switch (keyCode) {
      case KeyCode.KEY_W:
        this.moveUp = pressed;
        break;
      case KeyCode.KEY_S:
        this.moveDown = pressed;
        break;
      case KeyCode.KEY_A:
        this.moveLeft = pressed;
        break;
      case KeyCode.KEY_D:
        this.moveRight = pressed;
        break;
      case KeyCode.KEY_E:
        if (pressed && !this.interactionKeyDown && this.contextAction !== null) {
          this.contextActionPressed = true;
        }
        this.interactionKeyDown = pressed;
        break;
      case KeyCode.SPACE:
        this.skillButton.setKeyboardActive(pressed);
        break;
      case KeyCode.ARROW_UP:
      case KeyCode.KEY_I:
        this.attackUp = pressed;
        break;
      case KeyCode.ARROW_DOWN:
      case KeyCode.KEY_K:
        this.attackDown = pressed;
        break;
      case KeyCode.ARROW_LEFT:
      case KeyCode.KEY_J:
        this.attackLeft = pressed;
        break;
      case KeyCode.ARROW_RIGHT:
      case KeyCode.KEY_L:
        this.attackRight = pressed;
        break;
    }
  }
}
