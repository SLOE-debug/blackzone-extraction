import { Camera, Color, Node, Vec3 } from 'cc';
import { LOBBY_LAYOUT } from '../model/lobby-layout';

const CAMERA_POSITION = new Vec3(0, 2.35, 10.4);
const CAMERA_TARGET = new Vec3(0, 2.75, LOBBY_LAYOUT.focusZ - 0.45);

/** 创建正对角色与圆形背景的固定第三人称相机。 */
export function createLobbyCamera(parent: Node): Camera {
  const cameraNode = new Node('MainCamera');
  parent.addChild(cameraNode);
  cameraNode.setPosition(CAMERA_POSITION);
  cameraNode.lookAt(CAMERA_TARGET);

  const camera = cameraNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.PERSPECTIVE;
  camera.fovAxis = Camera.FOVAxis.VERTICAL;
  camera.fov = 52;
  camera.near = 0.1;
  camera.far = 60;
  camera.aperture = Camera.Aperture.F5_6;
  camera.shutter = Camera.Shutter.D60;
  camera.iso = Camera.ISO.ISO200;
  camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  camera.clearColor = new Color(16, 0, 5, 255);
  return camera;
}
