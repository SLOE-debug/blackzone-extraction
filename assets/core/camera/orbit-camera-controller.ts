import { Camera, EventMouse, input, Input, Vec3 } from 'cc';
import { wrapAngle } from '../math/scalar';

const MOTION_EPSILON = 0.00001;

/** Y-up 三维场景使用的轨道相机初始化参数。 */
export interface OrbitCameraOptions {
  readonly target: Readonly<Vec3>;
  readonly distance: number;
  readonly minimumDistance: number;
  readonly maximumDistance: number;
  readonly azimuthAngle: number;
  readonly polarAngle: number;
  readonly minimumPolarAngle: number;
  readonly maximumPolarAngle: number;
  readonly rotateSpeed: number;
  readonly zoomSpeed: number;
  readonly dampingFactor: number;
}

/** 管理围绕固定目标的鼠标旋转、滚轮缩放和惯性阻尼。 */
export class OrbitCameraController {
  private readonly target = new Vec3();
  private readonly position = new Vec3();
  private distance: number;
  private azimuthAngle: number;
  private polarAngle: number;
  private azimuthDelta = 0;
  private polarDelta = 0;
  private zoomDelta = 0;
  private rotating = false;
  private disposed = false;

  constructor(
    private readonly camera: Camera,
    private readonly options: Readonly<OrbitCameraOptions>,
  ) {
    validateOptions(options);
    Vec3.copy(this.target, options.target);
    this.distance = options.distance;
    this.azimuthAngle = wrapAngle(options.azimuthAngle);
    this.polarAngle = options.polarAngle;
    input.on(Input.EventType.MOUSE_DOWN, this.handleMouseDown, this);
    input.on(Input.EventType.MOUSE_MOVE, this.handleMouseMove, this);
    input.on(Input.EventType.MOUSE_UP, this.handleMouseUp, this);
    input.on(Input.EventType.MOUSE_WHEEL, this.handleMouseWheel, this);
    this.applyTransform();
  }

  /** 按帧率无关的阻尼消费待处理旋转与缩放量。 */
  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('轨道相机帧时间必须是有限非负数。');
    }
    if (deltaTime === 0) {
      return;
    }

    const damping = 1 - Math.pow(1 - this.options.dampingFactor, deltaTime * 60);
    let changed = false;
    if (Math.abs(this.azimuthDelta) > MOTION_EPSILON) {
      const step = this.azimuthDelta * damping;
      this.azimuthAngle = wrapAngle(this.azimuthAngle + step);
      this.azimuthDelta -= step;
      changed = true;
    } else {
      this.azimuthDelta = 0;
    }
    if (Math.abs(this.polarDelta) > MOTION_EPSILON) {
      const step = this.polarDelta * damping;
      const requested = this.polarAngle + step;
      const next = clamp(
        requested,
        this.options.minimumPolarAngle,
        this.options.maximumPolarAngle,
      );
      this.polarAngle = next;
      this.polarDelta = next === requested ? this.polarDelta - step : 0;
      changed = true;
    } else {
      this.polarDelta = 0;
    }
    if (Math.abs(this.zoomDelta) > MOTION_EPSILON) {
      const step = this.zoomDelta * damping;
      const requested = this.distance * Math.exp(step);
      const next = clamp(
        requested,
        this.options.minimumDistance,
        this.options.maximumDistance,
      );
      this.distance = next;
      this.zoomDelta = next === requested ? this.zoomDelta - step : 0;
      changed = true;
    } else {
      this.zoomDelta = 0;
    }

    if (changed) {
      this.applyTransform();
    }
  }

  /** 解除轨道相机注册的全部全局鼠标监听。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    input.off(Input.EventType.MOUSE_DOWN, this.handleMouseDown, this);
    input.off(Input.EventType.MOUSE_MOVE, this.handleMouseMove, this);
    input.off(Input.EventType.MOUSE_UP, this.handleMouseUp, this);
    input.off(Input.EventType.MOUSE_WHEEL, this.handleMouseWheel, this);
    this.rotating = false;
    this.disposed = true;
  }

  private handleMouseDown(event: EventMouse): void {
    this.rotating = event.getButton() === EventMouse.BUTTON_LEFT;
  }

  private handleMouseMove(event: EventMouse): void {
    if (!this.rotating) {
      return;
    }
    this.azimuthDelta -= event.getDeltaX() * this.options.rotateSpeed;
    this.polarDelta += event.getDeltaY() * this.options.rotateSpeed;
  }

  private handleMouseUp(event: EventMouse): void {
    if (event.getButton() === EventMouse.BUTTON_LEFT) {
      this.rotating = false;
    }
  }

  private handleMouseWheel(event: EventMouse): void {
    this.zoomDelta += event.getScrollY() * this.options.zoomSpeed;
  }

  /** 按 Cocos 的 Y-up 坐标系计算轨道位置并朝向目标。 */
  private applyTransform(): void {
    const horizontalDistance = this.distance * Math.sin(this.polarAngle);
    this.position.set(
      this.target.x + horizontalDistance * Math.sin(this.azimuthAngle),
      this.target.y + this.distance * Math.cos(this.polarAngle),
      this.target.z + horizontalDistance * Math.cos(this.azimuthAngle),
    );
    this.camera.node.setPosition(this.position);
    this.camera.node.lookAt(this.target, Vec3.UNIT_Y);
  }
}

/** 验证轨道相机参数不会产生无效姿态或不可操作区间。 */
function validateOptions(options: Readonly<OrbitCameraOptions>): void {
  const numericValues = [
    options.distance,
    options.minimumDistance,
    options.maximumDistance,
    options.azimuthAngle,
    options.polarAngle,
    options.minimumPolarAngle,
    options.maximumPolarAngle,
    options.rotateSpeed,
    options.zoomSpeed,
    options.dampingFactor,
  ];
  if (numericValues.some((value) => !Number.isFinite(value))) {
    throw new Error('轨道相机参数必须是有限数值。');
  }
  if (options.minimumDistance <= 0 || options.maximumDistance < options.minimumDistance) {
    throw new Error('轨道相机距离范围无效。');
  }
  if (options.distance < options.minimumDistance || options.distance > options.maximumDistance) {
    throw new Error('轨道相机初始距离超出允许范围。');
  }
  if (options.minimumPolarAngle <= 0
    || options.maximumPolarAngle >= Math.PI
    || options.maximumPolarAngle < options.minimumPolarAngle
    || options.polarAngle < options.minimumPolarAngle
    || options.polarAngle > options.maximumPolarAngle) {
    throw new Error('轨道相机俯仰角范围无效。');
  }
  if (options.rotateSpeed <= 0 || options.zoomSpeed <= 0) {
    throw new Error('轨道相机输入速度必须是正数。');
  }
  if (options.dampingFactor <= 0 || options.dampingFactor >= 1) {
    throw new Error('轨道相机阻尼系数必须位于零到一之间。');
  }
  if (!Number.isFinite(options.target.x)
    || !Number.isFinite(options.target.y)
    || !Number.isFinite(options.target.z)) {
    throw new Error('轨道相机目标必须由有限坐标组成。');
  }
}

/** 把数值限制在闭区间内。 */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
