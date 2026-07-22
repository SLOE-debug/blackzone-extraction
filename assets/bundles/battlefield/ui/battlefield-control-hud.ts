import {
  type Camera,
  type EventKeyboard,
  input,
  Input,
  KeyCode,
  Node,
} from 'cc';
import { ScreenUiCanvas } from '../../../core/ui/screen-ui-canvas';
import { VirtualJoystick } from '../../../core/ui/virtual-joystick';
import { VirtualJoystickActionIcon } from '../../../core/ui/virtual-joystick-graphics';
import {
  BattlefieldEquipmentLabelHud,
  type BattlefieldEquipmentLabelPresentation,
} from '../equipment/ui/battlefield-equipment-label-hud';
import { type BattlefieldEquipmentLibrary } from '../equipment/catalog/battlefield-equipment-contracts';
import { BattlefieldInteractionAction } from '../interaction/model/battlefield-interaction';
import {
  BattlefieldCameraOrbitInput,
  type MutableBattlefieldCameraAzimuthDelta,
} from './battlefield-camera-orbit-input';
import { BATTLEFIELD_CONTROL_STYLE } from './battlefield-control-style';
import { BattlefieldDefeatDialog } from './battlefield-defeat-dialog';
import { BattlefieldGameplayGraphics } from './battlefield-gameplay-graphics';
import { BattlefieldPlayerStatusHud } from './battlefield-player-status-hud';
import { type WeaponAmmunitionStatus } from '../equipment/model/weapon-ammunition-status';
import { BattlefieldWeaponStatusHud } from './battlefield-weapon-status-hud';

const BATTLEFIELD_INTERACTION_ICONS = Object.freeze({
  [BattlefieldInteractionAction.OpenContainer]: VirtualJoystickActionIcon.OpenContainer,
  [BattlefieldInteractionAction.PickupEquipment]: VirtualJoystickActionIcon.PickupEquipment,
} satisfies Readonly<Record<BattlefieldInteractionAction, VirtualJoystickActionIcon>>);

/** 战场场景持续读取的屏幕空间控制状态。 */
export interface BattlefieldScreenControlState {
  readonly moveX: number;
  readonly moveY: number;
  readonly aimX: number;
  readonly aimY: number;
  readonly aiming: boolean;
  readonly cameraOrbitDeltaX: number;
}

interface MutableBattlefieldScreenControlState {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  aiming: boolean;
  cameraOrbitDeltaX: number;
}

/** 装配左右虚拟摇杆，并提供便于桌面预览的键盘输入。 */
export class BattlefieldControlHud {
  public readonly state: BattlefieldScreenControlState;
  private readonly canvas: ScreenUiCanvas;
  private readonly gameplayGraphics: BattlefieldGameplayGraphics;
  private readonly movementJoystick: VirtualJoystick;
  private readonly aimJoystick: VirtualJoystick;
  private readonly equipmentLabel: BattlefieldEquipmentLabelHud;
  private readonly playerStatus: BattlefieldPlayerStatusHud;
  private readonly weaponStatus: BattlefieldWeaponStatusHud;
  private readonly defeatDialog: BattlefieldDefeatDialog;
  private readonly cameraOrbitInput: BattlefieldCameraOrbitInput;
  private readonly cameraAzimuthDelta: MutableBattlefieldCameraAzimuthDelta = { x: 0 };
  private readonly mutableState: MutableBattlefieldScreenControlState = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    aiming: false,
    cameraOrbitDeltaX: 0,
  };
  private layoutWidth = -1;
  private layoutHeight = -1;
  private moveUp = false;
  private moveDown = false;
  private moveLeft = false;
  private moveRight = false;
  private aimUp = false;
  private aimDown = false;
  private aimLeft = false;
  private aimRight = false;
  private contextAction: BattlefieldInteractionAction | null = null;
  private contextActionPressed = false;
  private interactionKeyDown = false;
  private inputRegistered = false;
  private disposed = false;

  constructor(
    parent: Node,
    worldCamera: Camera,
    equipmentLibrary: BattlefieldEquipmentLibrary,
    onReturnToLobbyRequested: () => void,
  ) {
    this.state = this.mutableState;
    this.canvas = new ScreenUiCanvas(parent, 'BattlefieldControlCanvas');
    let gameplayGraphics: BattlefieldGameplayGraphics | null = null;
    let movementJoystick: VirtualJoystick | null = null;
    let aimJoystick: VirtualJoystick | null = null;
    let cameraOrbitInput: BattlefieldCameraOrbitInput | null = null;
    let equipmentLabel: BattlefieldEquipmentLabelHud | null = null;
    let playerStatus: BattlefieldPlayerStatusHud | null = null;
    let weaponStatus: BattlefieldWeaponStatusHud | null = null;
    let defeatDialog: BattlefieldDefeatDialog | null = null;
    try {
      gameplayGraphics = new BattlefieldGameplayGraphics(this.canvas.node);
      movementJoystick = new VirtualJoystick(
        this.canvas.node,
        'MovementJoystick',
        BATTLEFIELD_CONTROL_STYLE.movement,
      );
      aimJoystick = new VirtualJoystick(
        this.canvas.node,
        'AimJoystick',
        BATTLEFIELD_CONTROL_STYLE.aim,
      );
      cameraOrbitInput = new BattlefieldCameraOrbitInput(this.canvas.node);
      equipmentLabel = new BattlefieldEquipmentLabelHud(
        this.canvas.node,
        worldCamera,
        equipmentLibrary,
      );
      playerStatus = new BattlefieldPlayerStatusHud(this.canvas.node);
      weaponStatus = new BattlefieldWeaponStatusHud(this.canvas.node);
      defeatDialog = new BattlefieldDefeatDialog(
        this.canvas.node,
        onReturnToLobbyRequested,
      );
      this.movementJoystick = movementJoystick;
      this.aimJoystick = aimJoystick;
      this.gameplayGraphics = gameplayGraphics;
      this.cameraOrbitInput = cameraOrbitInput;
      this.equipmentLabel = equipmentLabel;
      this.playerStatus = playerStatus;
      this.weaponStatus = weaponStatus;
      this.defeatDialog = defeatDialog;
      this.synchronizeLayout();
      this.synchronizeGameplayGraphics();
      this.canvas.node.active = false;
    } catch (error: unknown) {
      defeatDialog?.dispose();
      weaponStatus?.dispose();
      playerStatus?.dispose();
      equipmentLabel?.dispose();
      cameraOrbitInput?.dispose();
      movementJoystick?.dispose();
      aimJoystick?.dispose();
      gameplayGraphics?.dispose();
      this.canvas.dispose();
      throw error;
    }
  }

  /** 同步窗口布局，并合并触摸摇杆与桌面键盘状态。 */
  public update(): void {
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
    this.writeMovementState();
    this.writeAimState();
    this.writeCameraOrbitState();
    this.defeatDialog.update();
    this.synchronizeGameplayGraphics();
    if (this.aimJoystick.consumeActionPress()) {
      this.contextActionPressed = true;
    }
  }

  /** 切换右摇杆的普通瞄准与场景操作图案。 */
  public setContextAction(action: BattlefieldInteractionAction | null): void {
    if (this.disposed || this.contextAction === action) {
      return;
    }
    this.contextAction = action;
    this.contextActionPressed = false;
    this.aimJoystick.setActionIcon(action === null
      ? null
      : BATTLEFIELD_INTERACTION_ICONS[action]);
    this.synchronizeGameplayGraphics();
  }

  /** 读取并清除触摸或 E 键产生的一次场景操作。 */
  public consumeContextActionPress(): boolean {
    const pressed = this.contextAction !== null && this.contextActionPressed;
    this.contextActionPressed = false;
    return pressed;
  }

  /** 同步靠近玩家的装备世界标签。 */
  public presentEquipmentLabel(
    presentation: Readonly<BattlefieldEquipmentLabelPresentation> | null,
  ): void {
    this.equipmentLabel.present(presentation);
  }

  /** 同步右上角玩家当前生命值和最大生命值。 */
  public presentPlayerHealth(health: number, maximumHealth: number): void {
    this.playerStatus.present(health, maximumHealth);
    this.synchronizeGameplayGraphics();
  }

  /** 同步右上角当前枪械、口径、弹匣和备用弹药。 */
  public presentWeaponAmmunition(status: Readonly<WeaponAmmunitionStatus> | null): void {
    this.weaponStatus.present(status);
    this.synchronizeGameplayGraphics();
  }

  /** 显示死亡弹窗，并清除仍残留的场景交互提示。 */
  public showDefeatDialog(): void {
    if (this.disposed) {
      return;
    }
    this.setContextAction(null);
    this.presentEquipmentLabel(null);
    this.defeatDialog.show();
  }

  /** 同步返回大厅异步加载的等待状态。 */
  public setReturnToLobbyPending(pending: boolean): void {
    this.defeatDialog.setPending(pending);
  }

  /** 解除全局键盘监听并销毁双摇杆 Canvas。 */
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
    this.weaponStatus.dispose();
    this.equipmentLabel.dispose();
    this.movementJoystick.dispose();
    this.aimJoystick.dispose();
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
      style.aim.interactionRadius,
    );
    const maximumHorizontalInset = Math.max(
      0,
      width * 0.5
        - style.movement.interactionRadius
        - style.aim.interactionRadius
        - style.minimumCenterGap * 0.5,
    );
    const horizontalInset = Math.min(style.horizontalEdgeInset, maximumHorizontalInset);
    const bottomInset = Math.min(
      style.bottomEdgeInset,
      Math.max(0, height - maximumInteractionRadius * 2),
    );
    const leftX = -width * 0.5 + style.movement.interactionRadius + horizontalInset;
    const rightX = width * 0.5 - style.aim.interactionRadius - horizontalInset;
    const centerY = -height * 0.5
      + maximumInteractionRadius
      + bottomInset;
    this.movementJoystick.setPosition(leftX, centerY);
    this.aimJoystick.setPosition(rightX, centerY);
    this.playerStatus.synchronizeLayout(width, height);
    this.weaponStatus.synchronizeLayout(width, height);
    this.layoutWidth = width;
    this.layoutHeight = height;
  }

  /** 把双摇杆、生命条和弹药板同步到唯一 Graphics 组件。 */
  private synchronizeGameplayGraphics(): void {
    this.gameplayGraphics.synchronize(
      this.canvas.transform.width,
      this.canvas.transform.height,
      this.movementJoystick,
      this.aimJoystick,
      this.playerStatus,
      this.weaponStatus,
    );
  }

  /** 左摇杆优先，未触摸时使用 WASD。 */
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

  /** 右摇杆优先，未触摸时使用方向键或 IJKL，并把瞄准值归一化。 */
  private writeAimState(): void {
    if (this.contextAction !== null) {
      this.mutableState.aimX = 0;
      this.mutableState.aimY = 0;
      this.mutableState.aiming = false;
      return;
    }
    const joystick = this.aimJoystick.value;
    let aimX = joystick.x;
    let aimY = joystick.y;
    let magnitude = joystick.magnitude;
    if (magnitude <= 0) {
      aimX = Number(this.aimRight) - Number(this.aimLeft);
      aimY = Number(this.aimUp) - Number(this.aimDown);
      magnitude = Math.hypot(aimX, aimY);
    }
    const aiming = magnitude >= BATTLEFIELD_CONTROL_STYLE.aimActivationMagnitude;
    const inverseLength = aiming ? 1 / Math.hypot(aimX, aimY) : 0;
    this.mutableState.aimX = aimX * inverseLength;
    this.mutableState.aimY = aimY * inverseLength;
    this.mutableState.aiming = aiming;
  }

  /** 只取走水平旋转增量；输入层不产生任何纵向俯仰量。 */
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

  /** 将类型化按键映射到移动或瞄准职责。 */
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
      case KeyCode.ARROW_UP:
      case KeyCode.KEY_I:
        this.aimUp = pressed;
        break;
      case KeyCode.ARROW_DOWN:
      case KeyCode.KEY_K:
        this.aimDown = pressed;
        break;
      case KeyCode.ARROW_LEFT:
      case KeyCode.KEY_J:
        this.aimLeft = pressed;
        break;
      case KeyCode.ARROW_RIGHT:
      case KeyCode.KEY_L:
        this.aimRight = pressed;
        break;
    }
  }
}
