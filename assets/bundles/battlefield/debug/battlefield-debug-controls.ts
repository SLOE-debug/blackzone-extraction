import { Color, type Scene } from 'cc';
import { type BattlefieldCameraRig } from '../scene/battlefield-camera';
import { type BattlefieldLightingRig } from '../scene/battlefield-lighting';

/** 战场调试面板首次显示时读取的参数快照。 */
export interface BattlefieldDebugSnapshot {
  readonly ambientIlluminance: number;
  readonly ambientSkyColor: string;
  readonly ambientGroundColor: string;
  readonly keyLightFlux: number;
  readonly keyLightColor: string;
  readonly keyLightAngle: number;
  readonly keyLightRange: number;
  readonly keyLightAttenuation: number;
  readonly keyLightEnabled: boolean;
  readonly keyLightShadowEnabled: boolean;
  readonly orbitCameraEnabled: boolean;
}

/** 把 Debug 面板修改映射到战场灯光、环境和相机 Rig。 */
export class BattlefieldDebugControls {
  constructor(
    private readonly scene: Scene,
    private readonly lightingRig: Readonly<BattlefieldLightingRig>,
    private readonly cameraRig: BattlefieldCameraRig,
  ) {}

  /** 获取面板全部控件的当前值。 */
  public getSnapshot(): BattlefieldDebugSnapshot {
    const ambient = this.scene.globals.ambient;
    const keyLight = this.lightingRig.keyLight;
    return Object.freeze({
      ambientIlluminance: ambient.skyIllum,
      ambientSkyColor: colorToHex(ambient.skyLightingColor),
      ambientGroundColor: colorToHex(ambient.groundLightingColor),
      keyLightFlux: keyLight.luminousFlux,
      keyLightColor: colorToHex(keyLight.color),
      keyLightAngle: keyLight.spotAngle,
      keyLightRange: keyLight.range,
      keyLightAttenuation: keyLight.angleAttenuationStrength,
      keyLightEnabled: keyLight.enabled,
      keyLightShadowEnabled: keyLight.shadowEnabled,
      orbitCameraEnabled: this.cameraRig.orbitEnabled,
    });
  }

  /** 设置 Cocos 半球环境光照度。 */
  public setAmbientIlluminance(value: number): void {
    this.scene.globals.ambient.skyIllum = value;
  }

  /** 设置天空半球环境色。 */
  public setAmbientSkyColor(value: string): void {
    this.scene.globals.ambient.skyLightingColor = hexToColor(value);
  }

  /** 设置地面半球环境色。 */
  public setAmbientGroundColor(value: string): void {
    this.scene.globals.ambient.groundLightingColor = hexToColor(value);
  }

  /** 设置战场主射灯光通量。 */
  public setKeyLightFlux(value: number): void {
    this.lightingRig.keyLight.luminousFlux = value;
  }

  /** 设置战场主射灯颜色。 */
  public setKeyLightColor(value: string): void {
    this.lightingRig.keyLight.color = hexToColor(value);
  }

  /** 设置战场主射灯锥角。 */
  public setKeyLightAngle(value: number): void {
    this.lightingRig.keyLight.spotAngle = value;
  }

  /** 设置战场主射灯有效范围。 */
  public setKeyLightRange(value: number): void {
    this.lightingRig.keyLight.range = value;
  }

  /** 设置战场主射灯锥角边缘衰减。 */
  public setKeyLightAttenuation(value: number): void {
    this.lightingRig.keyLight.angleAttenuationStrength = value;
  }

  /** 开关战场主射灯。 */
  public setKeyLightEnabled(value: boolean): void {
    this.lightingRig.keyLight.enabled = value;
  }

  /** 开关战场主射灯实时阴影。 */
  public setKeyLightShadowEnabled(value: boolean): void {
    this.lightingRig.keyLight.shadowEnabled = value;
  }

  /** 开关脱离玩家跟随、支持平移和缩放的自由调试相机。 */
  public setOrbitCameraEnabled(value: boolean): void {
    this.cameraRig.setOrbitEnabled(value);
  }
}

function colorToHex(color: Readonly<Color>): string {
  return `#${toHexByte(color.r)}${toHexByte(color.g)}${toHexByte(color.b)}`;
}

function hexToColor(value: string): Color {
  const parsed = Number.parseInt(value.replace('#', ''), 16);
  return new Color(
    parsed >> 16 & 0xff,
    parsed >> 8 & 0xff,
    parsed & 0xff,
    255,
  );
}

function toHexByte(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}
