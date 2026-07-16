import { Color, Node, renderer, SpotLight, Vec3 } from 'cc';
import {
  LOBBY_KEY_LIGHT_CONFIG,
  type LobbySpotlightConfig,
} from '../model/lobby-lighting-config';

/** 大厅实时调试所需的稳定灯光门面。 */
export interface LobbyLightingRig {
  readonly keyLight: SpotLight;
}

/** 创建大厅顶部唯一真实聚光灯。 */
export function createLobbyLighting(parent: Node): LobbyLightingRig {
  return Object.freeze({
    keyLight: createLobbySpotlight(parent, LOBBY_KEY_LIGHT_CONFIG),
  });
}

/** 根据类型化配置创建单盏聚光灯。 */
function createLobbySpotlight(
  parent: Node,
  config: Readonly<LobbySpotlightConfig>,
): SpotLight {
  const lightNode = new Node(config.nodeName);
  parent.addChild(lightNode);
  lightNode.setPosition(config.position.x, config.position.y, config.position.z);
  lightNode.lookAt(
    new Vec3(config.target.x, config.target.y, config.target.z),
    new Vec3(config.up.x, config.up.y, config.up.z),
  );

  const spotLight = lightNode.addComponent(SpotLight);
  const { color } = config;
  spotLight.color = new Color(color.red, color.green, color.blue, 255);
  spotLight.size = config.size;
  spotLight.luminousFlux = config.luminousFlux;
  spotLight.range = config.range;
  spotLight.spotAngle = config.spotAngle;
  spotLight.angleAttenuationStrength = config.angleAttenuationStrength;
  spotLight.shadowEnabled = config.shadowEnabled;
  if (config.shadowEnabled) {
    spotLight.shadowPcf = renderer.scene.PCFType.SOFT_2X;
    spotLight.shadowBias = config.shadowBias;
    spotLight.shadowNormalBias = config.shadowNormalBias;
  }
  return spotLight;
}
