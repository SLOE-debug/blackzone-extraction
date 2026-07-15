import { Color, Node, renderer, SpotLight } from 'cc';
import { LOBBY_LAYOUT } from '../model/lobby-layout';

/** 创建大厅唯一的实时主光源。 */
export function createLobbySpotlight(parent: Node): SpotLight {
  const lightNode = new Node('MainSpotlight');
  parent.addChild(lightNode);
  lightNode.setPosition(0, LOBBY_LAYOUT.lightY, LOBBY_LAYOUT.focusZ);
  lightNode.setRotationFromEuler(-90, 0, 0);

  const spotLight = lightNode.addComponent(SpotLight);
  spotLight.color = new Color(255, 235, 205, 255);
  spotLight.luminousFlux = 2200;
  spotLight.size = 0.12;
  spotLight.range = 10;
  spotLight.spotAngle = 32;
  spotLight.angleAttenuationStrength = 0.18;
  spotLight.shadowEnabled = true;
  spotLight.shadowPcf = renderer.scene.PCFType.SOFT_2X;
  spotLight.shadowBias = 0.00008;
  spotLight.shadowNormalBias = 0.01;
  return spotLight;
}
