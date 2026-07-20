import { Color, Node, renderer, SpotLight, Vec3 } from 'cc';
import {
  LOBBY_KEY_LIGHT_CONFIG,
  type LobbySpotlightConfig,
} from '../model/lobby-lighting-config';
import {
  type LobbyRenderQuality,
  LobbyShadowFiltering,
} from '../model/lobby-render-quality';

/** 大厅实时调试所需的稳定灯光门面。 */
export interface LobbyLightingRig {
  readonly keyLight: SpotLight;
}

/** 创建大厅顶部唯一真实聚光灯。 */
export function createLobbyLighting(
  parent: Node,
  quality: Readonly<LobbyRenderQuality>,
): LobbyLightingRig {
  return Object.freeze({
    keyLight: createLobbySpotlight(parent, LOBBY_KEY_LIGHT_CONFIG, quality),
  });
}

/** 根据类型化配置创建单盏聚光灯。 */
function createLobbySpotlight(
  parent: Node,
  config: Readonly<LobbySpotlightConfig>,
  quality: Readonly<LobbyRenderQuality>,
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
  spotLight.shadowPcf = getShadowPcf(quality.shadowFiltering);
  spotLight.shadowBias = config.shadowBias;
  spotLight.shadowNormalBias = config.shadowNormalBias;
  spotLight.shadowEnabled = config.shadowEnabled;
  return spotLight;
}

/** 把领域阴影等级映射到 Cocos 聚光灯滤波枚举。 */
function getShadowPcf(filtering: LobbyShadowFiltering): number {
  switch (filtering) {
    case LobbyShadowFiltering.Hard:
      return renderer.scene.PCFType.HARD;
    case LobbyShadowFiltering.Soft2X:
      return renderer.scene.PCFType.SOFT_2X;
  }
}
