import { SmoothCurveTessellator } from '../../../../../core/geometry/smooth-curve-tessellator';
import { type TriangleMeshWriter } from '../../../../../core/geometry/triangle-mesh-writer';
import { lerp } from '../../../../../core/math/scalar';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  CURVE_CRAWLER_FOOT_SEGMENTS,
  CURVE_CRAWLER_LEG_SEGMENTS,
} from './curve-crawler-topology';

/**
 * 写入一条 Curve Crawler 腿部的连续贝塞尔曲线与圆形脚端。
 */
export function writeCurveCrawlerLeg(
  writer: TriangleMeshWriter,
  state: CurveCrawlerState,
  entityIndex: number,
  legIndex: number,
  headingCosine: number,
  headingSine: number,
  bodyLength: number,
  bodyWidth: number,
  legLength: number,
  legWidth: number,
): void {
  const { transform, behavior, animation } = state.data;
  const side = legIndex < 4 ? 1 : -1;
  const pair = legIndex % 4;
  const rootAlongBody = bodyLength * (0.42 - pair * 0.28);
  const forwardFan = getLegForwardFan(pair) * legLength;
  const phaseOffset = entityIndex * 8 + legIndex;
  const gaitAngle = (animation.phase[entityIndex] ?? 0)
    + (animation.legPhaseOffsets[phaseOffset] ?? 0);
  const swing = Math.sin(gaitAngle);
  const lift = Math.max(0, Math.cos(gaitAngle));
  const stride = swing * legLength * 0.18;
  const crouchAmount = animation.crouchAmount[entityIndex] ?? 0;
  const outwardScale = 1 - lift * 0.13 + crouchAmount * 0.12;

  const p0x = rootAlongBody;
  const p0y = side * bodyWidth * 0.37;
  let p1x = rootAlongBody + forwardFan * 0.24 - stride * 0.08;
  let p1y = side * (bodyWidth * 0.48 + legLength * 0.28);
  let p2x = rootAlongBody + forwardFan * 0.67 + stride * 0.28;
  let p2y = side * (bodyWidth * 0.42 + legLength * (0.62 - lift * 0.09));
  let p3x = rootAlongBody + forwardFan + stride;
  let p3y = side * (bodyWidth * 0.4 + legLength * 0.78 * outwardScale);

  const waveAmount = animation.waveAmount[entityIndex] ?? 0;
  if (legIndex === (behavior.selectedWaveLeg[entityIndex] ?? 0) && waveAmount > 0.001) {
    const waveSwing = Math.sin(animation.wavePhase[entityIndex] ?? 0) * legLength * 0.22;
    p1x += waveSwing * 0.25 * waveAmount;
    p2x += waveSwing * 0.7 * waveAmount;
    p3x += waveSwing * waveAmount;
    p2y = lerp(p2y, side * (bodyWidth * 0.75 + legLength * 0.25), waveAmount);
    p3y = lerp(p3y, side * (bodyWidth * 0.65 + legLength * 0.18), waveAmount);
  }

  const originX = transform.x[entityIndex] ?? 0;
  const originY = transform.y[entityIndex] ?? 0;
  const worldP0x = transformX(originX, p0x, p0y, headingCosine, headingSine);
  const worldP0y = transformY(originY, p0x, p0y, headingCosine, headingSine);
  const worldP1x = transformX(originX, p1x, p1y, headingCosine, headingSine);
  const worldP1y = transformY(originY, p1x, p1y, headingCosine, headingSine);
  const worldP2x = transformX(originX, p2x, p2y, headingCosine, headingSine);
  const worldP2y = transformY(originY, p2x, p2y, headingCosine, headingSine);
  const worldP3x = transformX(originX, p3x, p3y, headingCosine, headingSine);
  const worldP3y = transformY(originY, p3x, p3y, headingCosine, headingSine);

  SmoothCurveTessellator.appendCubicRibbon(
    writer,
    worldP0x,
    worldP0y,
    worldP1x,
    worldP1y,
    worldP2x,
    worldP2y,
    worldP3x,
    worldP3y,
    legWidth,
    legWidth * 0.58,
    CURVE_CRAWLER_LEG_SEGMENTS,
    CURVE_CRAWLER_FOOT_SEGMENTS,
    0,
  );
}

function getLegForwardFan(pair: number): number {
  switch (pair) {
    case 0:
      return 0.72;
    case 1:
      return 0.25;
    case 2:
      return -0.25;
    case 3:
      return -0.72;
    default:
      throw new Error(`无效的 Curve Crawler 腿部对索引：${pair}`);
  }
}

function transformX(originX: number, localX: number, localY: number, cosine: number, sine: number): number {
  return originX + localX * cosine - localY * sine;
}

function transformY(originY: number, localX: number, localY: number, cosine: number, sine: number): number {
  return originY + localX * sine + localY * cosine;
}
