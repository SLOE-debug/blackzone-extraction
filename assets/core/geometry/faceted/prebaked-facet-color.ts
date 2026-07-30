import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from './static-faceted-mesh-sink';
import { type FacetedTriangleSink } from './faceted-emitter';

const KEY_DIRECTION_X = -0.350878;
const KEY_DIRECTION_Y = 0.802007;
const KEY_DIRECTION_Z = 0.481204;
const VARIANT_COUNT = 7;

/** 生成期分面颜色所属的结构角色。 */
export enum PrebakedFacetRole {
  Exterior,
  Underside,
  Cavity,
  Accent,
}

/** 一套无需运行时灯光的固定分面色调。 */
export interface PrebakedFacetToneProfile {
  readonly top: number;
  readonly litSide: number;
  readonly darkSide: number;
  readonly underside: number;
  readonly cavity: number;
  readonly accent: number;
  readonly facetVariation: number;
}

/** 项目程序化道具默认使用的预烘分面色调。 */
export const DEFAULT_PREBAKED_FACET_TONE = Object.freeze({
  top: 1.08,
  litSide: 0.94,
  darkSide: 0.76,
  underside: 0.58,
  cavity: 0.4,
  accent: 1,
  facetVariation: 0.025,
}) satisfies PrebakedFacetToneProfile;

/** 一个三角形在生成期求值颜色所需的稳定元数据。 */
export interface PrebakedFacetMaterial {
  readonly baseColor: Readonly<FacetedColor>;
  readonly role: PrebakedFacetRole;
  readonly variant: number;
}

/** 供无分配颜色求值复用的可写颜色。 */
export interface MutablePrebakedFacetColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/**
 * 根据绑定姿态面法线、结构角色和确定性变体写出最终 Unlit 颜色。
 *
 * @param result 调用方长期复用的可写颜色。
 * @param material 当前三角形的基础色与结构角色。
 * @param normalX 单位面法线 X。
 * @param normalY 单位面法线 Y。
 * @param normalZ 单位面法线 Z。
 * @param profile 固定色调配置。
 */
export function writePrebakedFacetColor(
  result: MutablePrebakedFacetColor,
  material: Readonly<PrebakedFacetMaterial>,
  normalX: number,
  normalY: number,
  normalZ: number,
  profile: Readonly<PrebakedFacetToneProfile> = DEFAULT_PREBAKED_FACET_TONE,
): void {
  const shade = calculatePrebakedFacetShade(
    material.role,
    material.variant,
    normalX,
    normalY,
    normalZ,
    profile,
  );
  result.red = Math.min(1, material.baseColor.red * shade);
  result.green = Math.min(1, material.baseColor.green * shade);
  result.blue = Math.min(1, material.baseColor.blue * shade);
  result.alpha = material.baseColor.alpha;
}

/** 返回不截断高光增益的预烘分面亮度系数。 */
export function calculatePrebakedFacetShade(
  role: PrebakedFacetRole,
  variant: number,
  normalX: number,
  normalY: number,
  normalZ: number,
  profile: Readonly<PrebakedFacetToneProfile> = DEFAULT_PREBAKED_FACET_TONE,
): number {
  const roleShade = getRoleShade(role, normalX, normalY, normalZ, profile);
  if (role === PrebakedFacetRole.Accent) {
    return Math.max(0, roleShade);
  }
  const wrappedVariant = ((variant % VARIANT_COUNT) + VARIANT_COUNT) % VARIANT_COUNT;
  const centeredVariant = wrappedVariant / (VARIANT_COUNT - 1) * 2 - 1;
  return Math.max(0, roleShade + centeredVariant * profile.facetVariation);
}

/** 创建冻结的预烘分面材质描述。 */
export function prebakedFacetMaterial(
  baseColor: Readonly<FacetedColor>,
  role: PrebakedFacetRole,
  variant: number,
): Readonly<PrebakedFacetMaterial> {
  return Object.freeze({ baseColor, role, variant });
}

/**
 * 接收带结构角色的三角形，并在初始化期转换为普通静态顶点色几何。
 */
export class PrebakedFacetedMeshSink
implements FacetedTriangleSink<Readonly<PrebakedFacetMaterial>> {
  private readonly target = new StaticFacetedMeshSink();
  private readonly color: MutablePrebakedFacetColor = {
    red: 0,
    green: 0,
    blue: 0,
    alpha: 1,
  };

  public get vertexCount(): number {
    return this.target.vertexCount;
  }

  constructor(
    private readonly profile: Readonly<PrebakedFacetToneProfile>
      = DEFAULT_PREBAKED_FACET_TONE,
  ) {}

  /** 将真实面法线转换为最终颜色后写入普通静态几何 Sink。 */
  public appendFlatTriangle(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    normalX: number,
    normalY: number,
    normalZ: number,
    material: Readonly<PrebakedFacetMaterial>,
  ): void {
    writePrebakedFacetColor(
      this.color,
      material,
      normalX,
      normalY,
      normalZ,
      this.profile,
    );
    this.target.appendFlatTriangle(
      ax, ay, az,
      bx, by, bz,
      cx, cy, cz,
      normalX, normalY, normalZ,
      this.color,
    );
  }

  /** 冻结为普通静态表面几何。 */
  public build(): ReturnType<StaticFacetedMeshSink['build']> {
    return this.target.build();
  }
}

function getRoleShade(
  role: PrebakedFacetRole,
  normalX: number,
  normalY: number,
  normalZ: number,
  profile: Readonly<PrebakedFacetToneProfile>,
): number {
  if (role === PrebakedFacetRole.Cavity) {
    return profile.cavity;
  }
  if (role === PrebakedFacetRole.Underside) {
    return profile.underside;
  }
  if (role === PrebakedFacetRole.Accent) {
    return profile.accent;
  }
  if (normalY >= 0.55) {
    return profile.top;
  }
  if (normalY <= -0.35) {
    return profile.underside;
  }
  const keyFacing = normalX * KEY_DIRECTION_X
    + normalY * KEY_DIRECTION_Y
    + normalZ * KEY_DIRECTION_Z;
  return keyFacing >= 0 ? profile.litSide : profile.darkSide;
}
