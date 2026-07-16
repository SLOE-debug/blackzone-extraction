import { Camera, Color, Node, Vec3 } from 'cc';
import {
  OrbitCameraController,
  type OrbitCameraOptions,
} from '../../core/camera/orbit-camera-controller';
import { LOBBY_LAYOUT } from '../model/lobby-layout';

const CAMERA_POSITION = new Vec3(0, 2.35, 9.4);
const CAMERA_TARGET = new Vec3(0, 2.95, LOBBY_LAYOUT.focusZ - 0.45);
const CAMERA_DISTANCE = Vec3.distance(CAMERA_POSITION, CAMERA_TARGET);

const ORBIT_CAMERA_OPTIONS: OrbitCameraOptions = Object.freeze({
  target: CAMERA_TARGET,
  distance: 6.2,
  minimumDistance: 3.8,
  maximumDistance: 6.6,
  azimuthAngle: Math.atan2(
    CAMERA_POSITION.x - CAMERA_TARGET.x,
    CAMERA_POSITION.z - CAMERA_TARGET.z,
  ),
  polarAngle: Math.acos((CAMERA_POSITION.y - CAMERA_TARGET.y) / CAMERA_DISTANCE),
  minimumPolarAngle: 0.72,
  maximumPolarAngle: 1.68,
  rotateSpeed: 0.0045,
  zoomSpeed: 0.0012,
  dampingFactor: 0.16,
});

/** 管理固定大厅机位与可选轨道控制器之间的切换。 */
export class LobbyCameraRig {
  public readonly camera: Camera;
  private orbitController: OrbitCameraController | null = null;

  constructor(parent: Node) {
    this.camera = createCamera(parent);
  }

  /** 当前是否由轨道控制器接管相机姿态。 */
  public get orbitEnabled(): boolean {
    return this.orbitController !== null;
  }

  /** 开关轨道模式；关闭时立即恢复正式固定机位。 */
  public setOrbitEnabled(enabled: boolean): void {
    if (enabled === this.orbitEnabled) {
      return;
    }
    if (enabled) {
      this.orbitController = new OrbitCameraController(
        this.camera,
        ORBIT_CAMERA_OPTIONS,
      );
      return;
    }
    this.orbitController?.dispose();
    this.orbitController = null;
    applyFixedCameraPose(this.camera);
  }

  /** 更新轨道模式的惯性旋转与缩放。 */
  public update(deltaTime: number): void {
    this.orbitController?.update(deltaTime);
  }

  /** 解除轨道输入监听。 */
  public dispose(): void {
    this.orbitController?.dispose();
    this.orbitController = null;
  }
}

/** 创建正对角色与圆形背景的固定第三人称相机。 */
export function createLobbyCamera(parent: Node): LobbyCameraRig {
  return new LobbyCameraRig(parent);
}

/** 创建并配置大厅实际使用的 Cocos Camera。 */
function createCamera(parent: Node): Camera {
  const cameraNode = new Node('MainCamera');
  parent.addChild(cameraNode);

  const camera = cameraNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.PERSPECTIVE;
  camera.fovAxis = Camera.FOVAxis.VERTICAL;
  camera.fov = 50;
  camera.near = 0.1;
  camera.far = 60;
  camera.aperture = Camera.Aperture.F5_6;
  camera.shutter = Camera.Shutter.D60;
  camera.iso = Camera.ISO.ISO200;
  camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  camera.clearColor = new Color(16, 0, 5, 255);
  applyFixedCameraPose(camera);
  return camera;
}

/** 恢复正式大厅使用的固定位置与视线。 */
function applyFixedCameraPose(camera: Camera): void {
  camera.node.setPosition(CAMERA_POSITION);
  camera.node.lookAt(CAMERA_TARGET, Vec3.UNIT_Y);
}
