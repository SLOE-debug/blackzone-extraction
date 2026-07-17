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

/** 管理战场固定机位与可交互轨道相机之间的切换。 */
export class BattlefieldCameraRig {
  public readonly camera: Camera;
  private orbitController: OrbitCameraController | null = null;

  constructor(parent: Node) {
    this.camera = createCamera(parent);
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
      this.orbitController = new OrbitCameraController(this.camera, ORBIT_CAMERA_OPTIONS);
      return;
    }
    this.orbitController?.dispose();
    this.orbitController = null;
    applyFixedCameraPose(this.camera);
  }

  /** 推进轨道相机惯性。 */
  public update(deltaTime: number): void {
    this.orbitController?.update(deltaTime);
  }

  /** 解除轨道相机注册的全局输入监听。 */
  public dispose(): void {
    this.orbitController?.dispose();
    this.orbitController = null;
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
  applyFixedCameraPose(camera);
  return camera;
}

function applyFixedCameraPose(camera: Camera): void {
  camera.node.setPosition(CAMERA_POSITION);
  camera.node.lookAt(CAMERA_TARGET, Vec3.UNIT_Y);
}
