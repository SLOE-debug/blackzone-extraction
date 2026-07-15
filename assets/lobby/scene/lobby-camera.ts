import { Camera, Color, Node, Vec3 } from 'cc';
import { LOBBY_LAYOUT } from '../model/lobby-layout';

const CAMERA_WAIST_HEIGHT = 1.65;
const CAMERA_TARGET = new Vec3(0, CAMERA_WAIST_HEIGHT, LOBBY_LAYOUT.focusZ);

/** 创建正对角色与圆形背景的固定第三人称相机。 */
export function createLobbyCamera(parent: Node): Camera {
  const cameraNode = new Node('MainCamera');
  parent.addChild(cameraNode);
  cameraNode.setPosition(0, CAMERA_WAIST_HEIGHT, 10.15);
  cameraNode.lookAt(CAMERA_TARGET);

  const camera = cameraNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.PERSPECTIVE;
  camera.fovAxis = Camera.FOVAxis.VERTICAL;
  camera.fov = 64;
  camera.near = 0.1;
  camera.far = 60;
  camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  camera.clearColor = new Color(23, 2, 7, 255);
  return camera;
}
