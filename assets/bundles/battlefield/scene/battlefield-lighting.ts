import { Color, Node, renderer, SpotLight, Vec3 } from 'cc';

/** 战场 Debug 与运行时共享的灯光门面。 */
export interface BattlefieldLightingRig {
  readonly keyLight: SpotLight;
}

/** 创建覆盖玩家附近生成区域的高位冷白聚光灯。 */
export function createBattlefieldLighting(parent: Node): BattlefieldLightingRig {
  const lightNode = new Node('BattlefieldKeyLight');
  parent.addChild(lightNode);
  lightNode.setPosition(3.5, 25, 5.5);
  lightNode.lookAt(new Vec3(0, 0, 0), Vec3.UNIT_Z);

  const light = lightNode.addComponent(SpotLight);
  light.color = new Color(210, 228, 218, 255);
  light.size = 0.35;
  light.luminousFlux = 26000;
  light.range = 58;
  light.spotAngle = 76;
  light.angleAttenuationStrength = 0.42;
  light.shadowPcf = renderer.scene.PCFType.HARD;
  light.shadowBias = 0.0002;
  light.shadowNormalBias = 0.02;
  light.shadowEnabled = true;
  return Object.freeze({ keyLight: light });
}
