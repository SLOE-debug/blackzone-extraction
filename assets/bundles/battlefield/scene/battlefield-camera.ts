import { Camera, Color, Node, Vec3 } from 'cc';
import {
  OrbitCameraController,
  type OrbitCameraOptions,
} from '../../../core/camera/orbit-camera-controller';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import {
  type MutableBattlefieldPlanarDirection,
  writeBattlefieldCameraRelativeDirection,
} from './battlefield-camera-direction';

const CAMERA_TARGET = new Vec3(
  BATTLEFIELD_LAYOUT.playerPosition.x,
  BATTLEFIELD_LAYOUT.playerPosition.y + BATTLEFIELD_LAYOUT.camera.targetOffsetY,
  BATTLEFIELD_LAYOUT.playerPosition.z,
);
const CAMERA_DISTANCE = BATTLEFIELD_LAYOUT.camera.distance;
const CAMERA_AZIMUTH_ANGLE = BATTLEFIELD_LAYOUT.camera.azimuthAngle;
const CAMERA_POLAR_ANGLE = BATTLEFIELD_LAYOUT.camera.polarAngle;
const CAMERA_FOLLOW_SHARPNESS = 9.5;
const CAMERA_TARGET_HEIGHT = BATTLEFIELD_LAYOUT.camera.targetOffsetY;

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

/** 管理固定 45°玩家跟随机位与自由调试轨道相机之间的切换。 */
export class BattlefieldCameraRig {
  public readonly camera: Camera;
  private readonly currentTarget = new Vec3(
    CAMERA_TARGET.x,
    CAMERA_TARGET.y,
    CAMERA_TARGET.z,
  );
  private readonly desiredTarget = new Vec3(
    CAMERA_TARGET.x,
    CAMERA_TARGET.y,
    CAMERA_TARGET.z,
  );
  private readonly cameraPosition = new Vec3();
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
        azimuthAngle: CAMERA_AZIMUTH_ANGLE,
        polarAngle: CAMERA_POLAR_ANGLE,
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
    writeBattlefieldCameraRelativeDirection(
      CAMERA_AZIMUTH_ANGLE,
      screenX,
      screenY,
      result,
    );
  }

  /** 推进自由调试相机或正式固定机位的平滑跟随。 */
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

  /** 按固定方位和 45°俯角保持相机围绕玩家平滑跟随。 */
  private applyFollowPose(): void {
    const horizontalDistance = CAMERA_DISTANCE * Math.sin(CAMERA_POLAR_ANGLE);
    this.cameraPosition.set(
      this.currentTarget.x + horizontalDistance * Math.sin(CAMERA_AZIMUTH_ANGLE),
      this.currentTarget.y + CAMERA_DISTANCE * Math.cos(CAMERA_POLAR_ANGLE),
      this.currentTarget.z + horizontalDistance * Math.cos(CAMERA_AZIMUTH_ANGLE),
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
  return camera;
}
