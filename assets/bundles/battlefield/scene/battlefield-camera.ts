import { Camera, Color, Node, Vec3 } from 'cc';
import {
  OrbitCameraController,
  type OrbitCameraOptions,
} from '../../../core/camera/orbit-camera-controller';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';

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
const CAMERA_OFFSET_X = CAMERA_POSITION.x - CAMERA_TARGET.x;
const CAMERA_OFFSET_Y = CAMERA_POSITION.y - CAMERA_TARGET.y;
const CAMERA_OFFSET_Z = CAMERA_POSITION.z - CAMERA_TARGET.z;
const CAMERA_PLANAR_DISTANCE = Math.hypot(CAMERA_OFFSET_X, CAMERA_OFFSET_Z);
const CAMERA_FORWARD_X = -CAMERA_OFFSET_X / CAMERA_PLANAR_DISTANCE;
const CAMERA_FORWARD_Z = -CAMERA_OFFSET_Z / CAMERA_PLANAR_DISTANCE;
const CAMERA_RIGHT_X = -CAMERA_FORWARD_Z;
const CAMERA_RIGHT_Z = CAMERA_FORWARD_X;
const CAMERA_FOLLOW_SHARPNESS = 9.5;
const CAMERA_TARGET_HEIGHT = BATTLEFIELD_LAYOUT.cameraTarget.y
  - BATTLEFIELD_LAYOUT.playerPosition.y;

const ORBIT_CAMERA_OPTIONS: OrbitCameraOptions = Object.freeze({
  target: CAMERA_TARGET,
  distance: CAMERA_DISTANCE,
  minimumDistance: 5,
  maximumDistance: 80,
  azimuthAngle: Math.atan2(
    CAMERA_POSITION.x - CAMERA_TARGET.x,
    CAMERA_POSITION.z - CAMERA_TARGET.z,
  ),
  polarAngle: Math.acos((CAMERA_POSITION.y - CAMERA_TARGET.y) / CAMERA_DISTANCE),
  minimumPolarAngle: 0.18,
  maximumPolarAngle: Math.PI * 0.48,
  rotateSpeed: 0.0045,
  zoomSpeed: 0.0012,
  dollyDragSpeed: 0.011,
  panSpeed: 0.9,
  dampingFactor: 0.16,
});

/** 由调用方复用的世界 XZ 平面方向缓冲。 */
export interface MutableBattlefieldPlanarDirection {
  x: number;
  z: number;
}

/** 管理玩家跟随机位与调试轨道相机之间的切换。 */
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
  private orbitController: OrbitCameraController | null = null;

  constructor(parent: Node) {
    this.camera = createCamera(parent);
    this.applyFollowPose();
  }

  /** 当前是否启用了轨道相机输入。 */
  public get orbitEnabled(): boolean {
    return this.orbitController !== null;
  }

  /** 开关旋转、平移和缩放输入；关闭时恢复正式战场机位。 */
  public setOrbitEnabled(enabled: boolean): void {
    if (enabled === this.orbitEnabled) {
      return;
    }
    if (enabled) {
      this.orbitController = new OrbitCameraController(this.camera, {
        ...ORBIT_CAMERA_OPTIONS,
        target: this.currentTarget,
      });
      return;
    }
    this.orbitController?.dispose();
    this.orbitController = null;
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

  /** 将屏幕二维输入映射为固定斜俯视机位下的世界 XZ 平面方向。 */
  public writeWorldPlanarDirection(
    screenX: number,
    screenY: number,
    result: MutableBattlefieldPlanarDirection,
  ): void {
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      throw new Error('战场屏幕方向必须是有限数值。');
    }
    result.x = CAMERA_RIGHT_X * screenX + CAMERA_FORWARD_X * screenY;
    result.z = CAMERA_RIGHT_Z * screenX + CAMERA_FORWARD_Z * screenY;
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
  }

  /** 保持相机固定方位和俯角，只平移观察中心。 */
  private applyFollowPose(): void {
    this.cameraPosition.set(
      this.currentTarget.x + CAMERA_OFFSET_X,
      this.currentTarget.y + CAMERA_OFFSET_Y,
      this.currentTarget.z + CAMERA_OFFSET_Z,
    );
    this.camera.node.setPosition(this.cameraPosition);
    this.camera.node.lookAt(this.currentTarget, Vec3.UNIT_Y);
  }
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
