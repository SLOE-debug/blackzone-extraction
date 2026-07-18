import { Color, type Scene } from 'cc';
import { type BattlefieldCameraRig } from '../scene/battlefield-camera';

/** 战场调试面板首次显示时读取的参数快照。 */
export interface BattlefieldDebugSnapshot {
  readonly ambientIlluminance: number;
  readonly ambientSkyColor: string;
  readonly ambientGroundColor: string;
  readonly orbitCameraEnabled: boolean;
  readonly followCameraPitchDegrees: number;
}

/** 把 Debug 面板修改映射到战场环境光与相机参数。 */
export class BattlefieldDebugControls {
  constructor(
    private readonly scene: Scene,
    private readonly cameraRig: BattlefieldCameraRig,
  ) {}

  /** 获取面板全部控件的当前值。 */
  public getSnapshot(): BattlefieldDebugSnapshot {
    const ambient = this.scene.globals.ambient;
    return Object.freeze({
      ambientIlluminance: ambient.skyIllum,
      ambientSkyColor: colorToHex(ambient.skyLightingColor),
      ambientGroundColor: colorToHex(ambient.groundLightingColor),
      orbitCameraEnabled: this.cameraRig.orbitEnabled,
      followCameraPitchDegrees: this.cameraRig.followPitchDegrees,
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

  /** 开关脱离玩家跟随、支持平移和缩放的自由调试相机。 */
  public setOrbitCameraEnabled(value: boolean): void {
    this.cameraRig.setOrbitEnabled(value);
  }

  /** 设置正式跟随相机相对水平面的向下俯角。 */
  public setFollowCameraPitchDegrees(value: number): void {
    this.cameraRig.setFollowPitchDegrees(value);
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
