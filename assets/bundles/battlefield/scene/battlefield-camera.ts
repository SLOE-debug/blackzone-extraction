import { Camera, Color, Node, Vec3 } from 'cc';
import {
  OrbitCameraController,
  type OrbitCameraOptions,
} from '../../../core/camera/orbit-camera-controller';
import { wrapAngle } from '../../../core/math/scalar';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import {
  type MutableBattlefieldPlanarDirection,
  writeBattlefieldCameraRelativeDirection,
} from './battlefield-camera-direction';

const MOTION_EPSILON = 0.00001;

const CAMERA_POSITION = new Vec3(
  BATTLEFIELD_LAYOUT.cameraPosition.x,
  BATTLEFIELD_LAYOUT.cameraPosition.y,
  BATTLEFIELD_LAYOUT.cameraPosition.z,
);
const CAMERA_TARGET = new Vec3(
  BATTLEFIELD_LAYOUT.cameraTarget.x,
  BATTLEFIELD_LAYOUT.cameraTarget.y,
  BATTLEFIELD_LAYOUT.cameraTarget.z,
);
const CAMERA_DISTANCE = Vec3.distance(CAMERA_POSITION, CAMERA_TARGET);
const CAMERA_AZIMUTH_ANGLE = Math.atan2(
  CAMERA_POSITION.x - CAMERA_TARGET.x,
  CAMERA_POSITION.z - CAMERA_TARGET.z,
);
const CAMERA_POLAR_ANGLE = Math.acos(
  (CAMERA_POSITION.y - CAMERA_TARGET.y) / CAMERA_DISTANCE,
);
const CAMERA_FOLLOW_SHARPNESS = 9.5;
const CAMERA_TARGET_HEIGHT = BATTLEFIELD_LAYOUT.cameraTarget.y
  - BATTLEFIELD_LAYOUT.playerPosition.y;

const ORBIT_CAMERA_OPTIONS: OrbitCameraOptions = Object.freeze({
  target: CAMERA_TARGET,
  distance: CAMERA_DISTANCE,
  minimumDistance: 5,
  maximumDistance: 80,
  azimuthAngle: CAMERA_AZIMUTH_ANGLE,
  polarAngle: CAMERA_POLAR_ANGLE,
  minimumPolarAngle: 0.18,
  maximumPolarAngle: Math.PI * 0.48,
  rotateSpeed: 0.0045,
  zoomSpeed: 0.0012,
  dollyDragSpeed: 0.011,
  panSpeed: 0.9,
  dampingFactor: 0.16,
});

/** 管理玩家跟随轨道、正式旋转输入与调试轨道相机之间的切换。 */
export class BattlefieldCameraRig {
  public readonly camera: Camera;
  private readonly currentTarget = new Vec3(
    BATTLEFIELD_LAYOUT.cameraTarget.x,
    BATTLEFIELD_LAYOUT.cameraTarget.y,
    BATTLEFIELD_LAYOUT.cameraTarget.z,
  );
  private readonly desiredTarget = new Vec3(
    BATTLEFIELD_LAYOUT.cameraTarget.x,
    BATTLEFIELD_LAYOUT.cameraTarget.y,
    BATTLEFIELD_LAYOUT.cameraTarget.z,
  );
  private readonly cameraPosition = new Vec3();
  private azimuthAngle = CAMERA_AZIMUTH_ANGLE;
  private polarAngle = CAMERA_POLAR_ANGLE;
  private azimuthDelta = 0;
  private polarDelta = 0;
  private orbitController: OrbitCameraController | null = null;

  constructor(parent: Node) {
    this.camera = createCamera(parent);
    this.applyFollowPose();
  }

  /** 当前是否启用了脱离玩家跟随的自由调试相机。 */
  public get orbitEnabled(): boolean {
    return this.orbitController !== null;
  }

  /** 开关自由调试输入；关闭时恢复正式玩家跟随轨道。 */
  public setOrbitEnabled(enabled: boolean): void {
    if (enabled === this.orbitEnabled) {
      return;
    }
    if (enabled) {
      this.orbitController = new OrbitCameraController(this.camera, {
        ...ORBIT_CAMERA_OPTIONS,
        target: this.currentTarget,
        azimuthAngle: this.azimuthAngle,
        polarAngle: this.polarAngle,
      });
      this.clearOrbitMotion();
      return;
    }
    this.orbitController?.dispose();
    this.orbitController = null;
    this.clearOrbitMotion();
    Vec3.copy(this.currentTarget, this.desiredTarget);
    this.applyFollowPose();
  }

  /** 写入玩家脚底位置，供正式机位平滑跟随。 */
  public setFollowTarget(x: number, y: number, z: number, snap = false): void {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error('战场相机跟随目标必须是有限坐标。');
    }
    this.desiredTarget.set(x, y + CAMERA_TARGET_HEIGHT, z);
    if (snap) {
      Vec3.copy(this.currentTarget, this.desiredTarget);
      if (!this.orbitEnabled) {
        this.applyFollowPose();
      }
    }
  }

  /** 累计正式战场中的鼠标或触摸旋转像素增量。 */
  public queueOrbitRotation(deltaX: number, deltaY: number): void {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      throw new Error('战场相机旋转增量必须是有限数值。');
    }
    if (this.orbitEnabled) {
      return;
    }
    this.azimuthDelta -= deltaX * ORBIT_CAMERA_OPTIONS.rotateSpeed;
    // 输入层统一使用屏幕向下为正，这里反转为“上拖上看”的战场操作语义。
    this.polarDelta -= deltaY * ORBIT_CAMERA_OPTIONS.rotateSpeed;
  }

  /** 将屏幕二维输入映射为当前斜俯视机位下的世界 XZ 平面方向。 */
  public writeWorldPlanarDirection(
    screenX: number,
    screenY: number,
    result: MutableBattlefieldPlanarDirection,
  ): void {
    writeBattlefieldCameraRelativeDirection(
      this.azimuthAngle,
      screenX,
      screenY,
      result,
    );
  }

  /** 推进轨道相机惯性或正式机位的平滑跟随。 */
  public update(deltaTime: number): void {
    if (this.orbitController !== null) {
      this.orbitController.update(deltaTime);
      return;
    }
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('战场相机帧时间必须是有限非负数。');
    }
    this.consumeOrbitMotion(deltaTime);
    const response = 1 - Math.exp(-CAMERA_FOLLOW_SHARPNESS * deltaTime);
    this.currentTarget.x += (this.desiredTarget.x - this.currentTarget.x) * response;
    this.currentTarget.y += (this.desiredTarget.y - this.currentTarget.y) * response;
    this.currentTarget.z += (this.desiredTarget.z - this.currentTarget.z) * response;
    this.applyFollowPose();
  }

  /** 解除轨道相机注册的全局输入监听。 */
  public dispose(): void {
    this.orbitController?.dispose();
    this.orbitController = null;
    this.clearOrbitMotion();
  }

  /** 消费正式战场旋转阻尼，并限制俯仰角不穿越目标与地面。 */
  private consumeOrbitMotion(deltaTime: number): void {
    const damping = 1 - Math.pow(
      1 - ORBIT_CAMERA_OPTIONS.dampingFactor,
      deltaTime * 60,
    );
    if (Math.abs(this.azimuthDelta) > MOTION_EPSILON) {
      const step = this.azimuthDelta * damping;
      this.azimuthAngle = wrapAngle(this.azimuthAngle + step);
      this.azimuthDelta -= step;
    } else {
      this.azimuthDelta = 0;
    }
    if (Math.abs(this.polarDelta) > MOTION_EPSILON) {
      const step = this.polarDelta * damping;
      const requested = this.polarAngle + step;
      const next = clamp(
        requested,
        ORBIT_CAMERA_OPTIONS.minimumPolarAngle,
        ORBIT_CAMERA_OPTIONS.maximumPolarAngle,
      );
      this.polarAngle = next;
      this.polarDelta = next === requested ? this.polarDelta - step : 0;
    } else {
      this.polarDelta = 0;
    }
  }

  /** 清空尚未消费的相机旋转惯性。 */
  private clearOrbitMotion(): void {
    this.azimuthDelta = 0;
    this.polarDelta = 0;
  }

  /** 按当前轨道角保持相机围绕玩家平滑跟随。 */
  private applyFollowPose(): void {
    const horizontalDistance = CAMERA_DISTANCE * Math.sin(this.polarAngle);
    this.cameraPosition.set(
      this.currentTarget.x + horizontalDistance * Math.sin(this.azimuthAngle),
      this.currentTarget.y + CAMERA_DISTANCE * Math.cos(this.polarAngle),
      this.currentTarget.z + horizontalDistance * Math.cos(this.azimuthAngle),
    );
    this.camera.node.setPosition(this.cameraPosition);
    this.camera.node.lookAt(this.currentTarget, Vec3.UNIT_Y);
  }
}

/** 把数值限制在闭区间内。 */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

/** 创建战场相机 Rig。 */
export function createBattlefieldCamera(parent: Node): BattlefieldCameraRig {
  return new BattlefieldCameraRig(parent);
}

function createCamera(parent: Node): Camera {
  const cameraNode = new Node('BattlefieldCamera');
  parent.addChild(cameraNode);
  const camera = cameraNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.PERSPECTIVE;
  camera.fovAxis = Camera.FOVAxis.VERTICAL;
  camera.fov = 52;
  camera.near = 0.1;
  camera.far = 180;
  camera.aperture = Camera.Aperture.F5_6;
  camera.shutter = Camera.Shutter.D60;
  camera.iso = Camera.ISO.ISO200;
  camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  camera.clearColor = new Color(7, 12, 12, 255);
  camera.node.setPosition(CAMERA_POSITION);
  camera.node.lookAt(CAMERA_TARGET, Vec3.UNIT_Y);
  return camera;
}
