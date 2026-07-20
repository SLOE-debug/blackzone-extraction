import { getLobbyGeometryJitter } from '../lobby-triangle-geometry';
import {
  type LobbyGridSample,
  type LobbyLocalSurfacePoint,
} from '../samplers/lobby-grid-sample';

/** 大厅参数化曲面的法向形变模式。 */
export enum LobbySurfaceNormalDeformation {
  Jitter = 'jitter',
  CaveRelief = 'cave-relief',
}

/** 曲面切向固定扰动配置。 */
export interface LobbySurfaceTangentialJitter {
  readonly seedOffset: number;
  readonly amplitude: number;
}

/** 地面等轻微法向起伏使用的固定扰动。 */
export interface LobbySurfaceNormalJitter {
  readonly kind: LobbySurfaceNormalDeformation.Jitter;
  readonly seedOffset: number;
  readonly amplitude: number;
}

/** 墙体和天花板向大厅内部隆起的洞穴形变。 */
export interface LobbySurfaceCaveRelief {
  readonly kind: LobbySurfaceNormalDeformation.CaveRelief;
  readonly scale: number;
}

/** 大厅曲面采样使用的确定性形变参数。 */
export interface LobbySurfaceDeformationContext {
  readonly seed: number;
  readonly uJitter: Readonly<LobbySurfaceTangentialJitter>;
  readonly vJitter: Readonly<LobbySurfaceTangentialJitter>;
  readonly normal: Readonly<LobbySurfaceNormalJitter | LobbySurfaceCaveRelief>;
}

/**
 * 为大厅 Grid Patch 施加切向扰动与法向形变。
 *
 * @param out 已由 Grid Patch 初始化宽高坐标的局部点。
 * @param sample 当前稳定网格索引和边缘状态。
 * @param context 当前曲面的固定种子与形变幅度。
 */
export function sampleLobbySurface(
  out: LobbyLocalSurfacePoint,
  sample: Readonly<LobbyGridSample>,
  context: Readonly<LobbySurfaceDeformationContext>,
): void {
  if (!sample.edge) {
    out.u += getLobbyGeometryJitter(
      sample.column,
      sample.row,
      context.seed + context.uJitter.seedOffset,
      context.uJitter.amplitude,
    );
    out.v += getLobbyGeometryJitter(
      sample.column,
      sample.row,
      context.seed + context.vJitter.seedOffset,
      context.vJitter.amplitude,
    );
  }

  switch (context.normal.kind) {
    case LobbySurfaceNormalDeformation.Jitter:
      out.n = sample.edge ? 0 : getLobbyGeometryJitter(
        sample.column,
        sample.row,
        context.seed + context.normal.seedOffset,
        context.normal.amplitude,
      );
      return;
    case LobbySurfaceNormalDeformation.CaveRelief:
      out.n = context.normal.scale * getCaveRelief(sample, context.seed);
      return;
    default:
      throw new Error(`未知的大厅曲面法向形变：${String(context.normal)}`);
  }
}

/** 计算边界闭合、内部向法向轴隆起的确定性洞穴高度。 */
function getCaveRelief(sample: Readonly<LobbyGridSample>, seed: number): number {
  if (sample.edge) {
    return 0;
  }

  const horizontal = sample.u01;
  const vertical = sample.v01;
  const edgeFade = Math.sin(Math.PI * horizontal) * Math.sin(Math.PI * vertical);
  const primaryRock = getCaveRockBulge(horizontal, vertical, seed, 17, 0.2, 0.44);
  const secondaryRock = getCaveRockBulge(horizontal, vertical, seed, 31, 0.16, 0.34);
  const ridge = Math.max(0, Math.sin(
    horizontal * Math.PI * 3.2
    - vertical * Math.PI * 2.15
    + seed * 0.23,
  ));
  const detail = getLobbyGeometryJitter(sample.column, sample.row, seed + 73, 0.2);
  const relief = Math.max(
    -0.12,
    0.04 + primaryRock * 1.25 + secondaryRock * 0.85 + ridge * 0.32 + detail,
  );
  return edgeFade * Math.min(1.65, relief);
}

/** 生成由固定 seed 定位的单个宽缓岩体隆起。 */
function getCaveRockBulge(
  horizontal: number,
  vertical: number,
  seed: number,
  salt: number,
  minimumRadius: number,
  radiusRange: number,
): number {
  const centerX = getCaveParameter(seed, salt, 0.18, 0.64);
  const centerY = getCaveParameter(seed, salt + 1, 0.2, 0.6);
  const radiusX = getCaveParameter(seed, salt + 2, minimumRadius, radiusRange);
  const radiusY = getCaveParameter(seed, salt + 3, minimumRadius, radiusRange);
  const offsetX = (horizontal - centerX) / radiusX;
  const offsetY = (vertical - centerY) / radiusY;
  return Math.exp(-(offsetX * offsetX + offsetY * offsetY) * 1.65);
}

/** 把确定性扰动映射到指定参数区间。 */
function getCaveParameter(
  seed: number,
  salt: number,
  minimum: number,
  range: number,
): number {
  const normalized = getLobbyGeometryJitter(seed, salt, 101, 0.5) + 0.5;
  return minimum + normalized * range;
}
