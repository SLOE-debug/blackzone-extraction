import { Color, type Scene } from 'cc';
import { type LobbyCameraRig } from '../scene/lobby-camera';
import { type LobbyLightingRig } from '../scene/lobby-lighting';
import { type LobbyObservationSpider } from '../scene/lobby-observation-spider';

/** 调试面板首次显示时读取的大厅参数快照。 */
export interface LobbyDebugSnapshot {
  readonly ambientIlluminance: number;
  readonly ambientSkyColor: string;
  readonly ambientGroundColor: string;
  readonly keyLightFlux: number;
  readonly keyLightAngle: number;
  readonly keyLightRange: number;
  readonly keyLightAttenuation: number;
  readonly keyLightEnabled: boolean;
  readonly keyLightShadowEnabled: boolean;
  readonly orbitCameraEnabled: boolean;
  readonly observationSpiderScale: number;
}

/** 把调试 UI 的数值修改映射到大厅运行时对象。 */
export class LobbyDebugControls {
  constructor(
    private readonly scene: Scene,
    private readonly lightingRig: Readonly<LobbyLightingRig>,
    private readonly cameraRig: LobbyCameraRig,
    private readonly observationSpider: LobbyObservationSpider,
  ) {}

  /** 获取面板控件的初始值。 */
  public getSnapshot(): LobbyDebugSnapshot {
    const ambient = this.scene.globals.ambient;
    return Object.freeze({
      ambientIlluminance: ambient.skyIllum,
      ambientSkyColor: colorToHex(ambient.skyLightingColor),
      ambientGroundColor: colorToHex(ambient.groundLightingColor),
      keyLightFlux: this.lightingRig.keyLight.luminousFlux,
      keyLightAngle: this.lightingRig.keyLight.spotAngle,
      keyLightRange: this.lightingRig.keyLight.range,
      keyLightAttenuation: this.lightingRig.keyLight.angleAttenuationStrength,
      keyLightEnabled: this.lightingRig.keyLight.enabled,
      keyLightShadowEnabled: this.lightingRig.keyLight.shadowEnabled,
      orbitCameraEnabled: this.cameraRig.orbitEnabled,
      observationSpiderScale: this.observationSpider.scale,
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

  /** 设置顶部主射灯光通量。 */
  public setKeyLightFlux(value: number): void {
    this.lightingRig.keyLight.luminousFlux = value;
  }

  /** 设置顶部主射灯锥角。 */
  public setKeyLightAngle(value: number): void {
    this.lightingRig.keyLight.spotAngle = value;
  }

  /** 设置真实聚光灯影响范围。 */
  public setKeyLightRange(value: number): void {
    this.lightingRig.keyLight.range = value;
  }

  /** 设置真实聚光灯锥角边缘衰减。 */
  public setKeyLightAttenuation(value: number): void {
    this.lightingRig.keyLight.angleAttenuationStrength = value;
  }

  /** 开关大厅唯一真实聚光灯，用于隔离验证实际受光结果。 */
  public setKeyLightEnabled(value: boolean): void {
    this.lightingRig.keyLight.enabled = value;
  }

  /** 开关真实聚光灯阴影。 */
  public setKeyLightShadowEnabled(value: boolean): void {
    this.lightingRig.keyLight.shadowEnabled = value;
  }

  /** 开关支持旋转、平移焦点和缩放的完整轨道相机。 */
  public setOrbitCameraEnabled(value: boolean): void {
    this.cameraRig.setOrbitEnabled(value);
  }

  /** 设置墙后观察蜘蛛的统一缩放。 */
  public setObservationSpiderScale(value: number): void {
    this.observationSpider.setScale(value);
  }
}

/** 把 Cocos 字节色转换为浏览器颜色输入值。 */
function colorToHex(color: Readonly<Color>): string {
  return `#${toHexByte(color.r)}${toHexByte(color.g)}${toHexByte(color.b)}`;
}

/** 把浏览器十六进制颜色转换为 Cocos Color。 */
function hexToColor(value: string): Color {
  const parsed = Number.parseInt(value.replace('#', ''), 16);
  return new Color(
    parsed >> 16 & 0xff,
    parsed >> 8 & 0xff,
    parsed & 0xff,
    255,
  );
}

/** 把单个字节格式化为两位十六进制字符串。 */
function toHexByte(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}
