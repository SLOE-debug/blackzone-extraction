import {
  type EventKeyboard,
  input,
  Input,
  KeyCode,
  Node,
} from 'cc';
import { ScreenUiCanvas } from '../../../core/ui/screen-ui-canvas';
import { VirtualJoystick } from '../../../core/ui/virtual-joystick';
import {
  BattlefieldCameraOrbitInput,
  type MutableBattlefieldCameraOrbitDelta,
} from './battlefield-camera-orbit-input';
import { BATTLEFIELD_CONTROL_STYLE } from './battlefield-control-style';

/** 战场场景持续读取的屏幕空间控制状态。 */
export interface BattlefieldScreenControlState {
  readonly moveX: number;
  readonly moveY: number;
  readonly aimX: number;
  readonly aimY: number;
  readonly aiming: boolean;
  readonly cameraOrbitDeltaX: number;
  readonly cameraOrbitDeltaY: number;
}

interface MutableBattlefieldScreenControlState {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  aiming: boolean;
  cameraOrbitDeltaX: number;
  cameraOrbitDeltaY: number;
}

/** 装配左右虚拟摇杆，并提供便于桌面预览的键盘输入。 */
export class BattlefieldControlHud {
  public readonly state: BattlefieldScreenControlState;
  private readonly canvas: ScreenUiCanvas;
  private readonly movementJoystick: VirtualJoystick;
  private readonly aimJoystick: VirtualJoystick;
  private readonly cameraOrbitInput: BattlefieldCameraOrbitInput;
  private readonly cameraOrbitDelta: MutableBattlefieldCameraOrbitDelta = { x: 0, y: 0 };
  private readonly mutableState: MutableBattlefieldScreenControlState = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    aiming: false,
    cameraOrbitDeltaX: 0,
    cameraOrbitDeltaY: 0,
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
  private inputRegistered = false;
  private disposed = false;

  constructor(parent: Node) {
    this.state = this.mutableState;
    this.canvas = new ScreenUiCanvas(parent, 'BattlefieldControlCanvas');
    let movementJoystick: VirtualJoystick | null = null;
    let aimJoystick: VirtualJoystick | null = null;
    let cameraOrbitInput: BattlefieldCameraOrbitInput | null = null;
    try {
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
      this.movementJoystick = movementJoystick;
      this.aimJoystick = aimJoystick;
      this.cameraOrbitInput = cameraOrbitInput;
      this.synchronizeLayout();
      this.canvas.node.active = false;
    } catch (error: unknown) {
      cameraOrbitInput?.dispose();
      movementJoystick?.dispose();
      aimJoystick?.dispose();
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
  }

  /** 解除全局键盘监听并销毁双摇杆 Canvas。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    if (this.inputRegistered) {
      input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
      input.off(Input.EventType.KEY_UP, this.handleKeyUp, this);
    }
    this.cameraOrbitInput.dispose();
    this.movementJoystick.dispose();
    this.aimJoystick.dispose();
    this.canvas.dispose();
    this.inputRegistered = false;
    this.disposed = true;
  }

  private synchronizeLayout(): void {
    const width = this.canvas.transform.width;
    const height = this.canvas.transform.height;
    if (width === this.layoutWidth && height === this.layoutHeight) {
      return;
    }
    const style = BATTLEFIELD_CONTROL_STYLE;
    const leftX = -width * 0.5 + style.movement.interactionRadius + style.edgeMargin;
    const rightX = width * 0.5 - style.aim.interactionRadius - style.edgeMargin;
    const centerY = -height * 0.5
      + Math.max(style.movement.interactionRadius, style.aim.interactionRadius)
      + style.edgeMargin;
    this.movementJoystick.setPosition(leftX, centerY);
    this.aimJoystick.setPosition(rightX, centerY);
    this.layoutWidth = width;
    this.layoutHeight = height;
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

  /** 取走鼠标或空白触摸区域累计的相机旋转增量。 */
  private writeCameraOrbitState(): void {
    this.cameraOrbitInput.consume(this.cameraOrbitDelta);
    this.mutableState.cameraOrbitDeltaX = this.cameraOrbitDelta.x;
    this.mutableState.cameraOrbitDeltaY = this.cameraOrbitDelta.y;
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
