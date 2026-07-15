import { type TriangleMeshWriter } from '../../../../../core/geometry/triangle-mesh-writer';
import { VolumetricTessellator } from '../../../../../core/geometry/volumetric-tessellator';
import { lerp } from '../../../../../core/math/scalar';
import { CURVE_CRAWLER_FRAGMENT_COUNT } from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  CURVE_CRAWLER_FOOT_LATITUDE_SEGMENTS,
  CURVE_CRAWLER_FOOT_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_LEG_RADIAL_SEGMENTS,
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
  fragmentScale: number,
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
  const startRadius = Math.max(legWidth * 0.5 * fragmentScale, 0.0001);
  const endRadius = Math.max(legWidth * 0.29 * fragmentScale, 0.0001);
  const footRadius = endRadius * 1.2;
  const gaitLift = lift * legLength * 0.11;
  const p0z = bodyWidth * (0.28 - crouchAmount * 0.05);
  let p1z = p0z + legLength * 0.13;
  let p2z = footRadius + legLength * 0.08 + gaitLift * 0.55;
  let p3z = footRadius + gaitLift;

  const waveAmount = animation.waveAmount[entityIndex] ?? 0;
  if (legIndex === (behavior.selectedWaveLeg[entityIndex] ?? 0) && waveAmount > 0.001) {
    const waveSwing = Math.sin(animation.wavePhase[entityIndex] ?? 0) * legLength * 0.22;
    p1x += waveSwing * 0.25 * waveAmount;
    p2x += waveSwing * 0.7 * waveAmount;
    p3x += waveSwing * waveAmount;
    p2y = lerp(p2y, side * (bodyWidth * 0.75 + legLength * 0.25), waveAmount);
    p3y = lerp(p3y, side * (bodyWidth * 0.65 + legLength * 0.18), waveAmount);
    p1z = lerp(p1z, p0z + legLength * 0.4, waveAmount);
    p2z = lerp(p2z, p0z + legLength * 0.64, waveAmount);
    p3z = lerp(p3z, p0z + legLength * 0.76, waveAmount);
  }

  const fragmentOffset = entityIndex * CURVE_CRAWLER_FRAGMENT_COUNT + legIndex;
  const fragmentRotation = animation.fragmentRotation[fragmentOffset] ?? 0;
  if (fragmentRotation !== 0 || fragmentScale < 0.9999) {
    const fragmentRotationCosine = Math.cos(fragmentRotation);
    const fragmentRotationSine = Math.sin(fragmentRotation);
    const relativeP1x = p1x - p0x;
    const relativeP1y = p1y - p0y;
    p1x = p0x + (relativeP1x * fragmentRotationCosine
      - relativeP1y * fragmentRotationSine) * fragmentScale;
    p1y = p0y + (relativeP1x * fragmentRotationSine
      + relativeP1y * fragmentRotationCosine) * fragmentScale;
    const relativeP2x = p2x - p0x;
    const relativeP2y = p2y - p0y;
    p2x = p0x + (relativeP2x * fragmentRotationCosine
      - relativeP2y * fragmentRotationSine) * fragmentScale;
    p2y = p0y + (relativeP2x * fragmentRotationSine
      + relativeP2y * fragmentRotationCosine) * fragmentScale;
    const relativeP3x = p3x - p0x;
    const relativeP3y = p3y - p0y;
    p3x = p0x + (relativeP3x * fragmentRotationCosine
      - relativeP3y * fragmentRotationSine) * fragmentScale;
    p3y = p0y + (relativeP3x * fragmentRotationSine
      + relativeP3y * fragmentRotationCosine) * fragmentScale;
    p1z = p0z + (p1z - p0z) * fragmentScale;
    p2z = p0z + (p2z - p0z) * fragmentScale;
    p3z = p0z + (p3z - p0z) * fragmentScale;
  }

  const originX = transform.x[entityIndex] ?? 0;
  const originY = transform.y[entityIndex] ?? 0;
  const fragmentOffsetX = animation.fragmentOffsetX[fragmentOffset] ?? 0;
  const fragmentOffsetY = animation.fragmentOffsetY[fragmentOffset] ?? 0;
  const fragmentOffsetZ = animation.fragmentOffsetZ[fragmentOffset] ?? 0;
  const worldP0x = transformX(originX, p0x, p0y, headingCosine, headingSine) + fragmentOffsetX;
  const worldP0y = transformY(originY, p0x, p0y, headingCosine, headingSine) + fragmentOffsetY;
  const worldP1x = transformX(originX, p1x, p1y, headingCosine, headingSine) + fragmentOffsetX;
  const worldP1y = transformY(originY, p1x, p1y, headingCosine, headingSine) + fragmentOffsetY;
  const worldP2x = transformX(originX, p2x, p2y, headingCosine, headingSine) + fragmentOffsetX;
  const worldP2y = transformY(originY, p2x, p2y, headingCosine, headingSine) + fragmentOffsetY;
  const worldP3x = transformX(originX, p3x, p3y, headingCosine, headingSine) + fragmentOffsetX;
  const worldP3y = transformY(originY, p3x, p3y, headingCosine, headingSine) + fragmentOffsetY;

  VolumetricTessellator.appendCubicTube(
    writer,
    worldP0x,
    worldP0y,
    p0z + fragmentOffsetZ,
    worldP1x,
    worldP1y,
    p1z + fragmentOffsetZ,
    worldP2x,
    worldP2y,
    p2z + fragmentOffsetZ,
    worldP3x,
    worldP3y,
    p3z + fragmentOffsetZ,
    startRadius,
    endRadius,
    CURVE_CRAWLER_LEG_SEGMENTS,
    CURVE_CRAWLER_LEG_RADIAL_SEGMENTS,
  );
  VolumetricTessellator.appendEllipsoid(
    writer,
    worldP3x,
    worldP3y,
    p3z + fragmentOffsetZ,
    footRadius * 1.1,
    footRadius,
    footRadius,
    (transform.heading[entityIndex] ?? 0) + fragmentRotation,
    CURVE_CRAWLER_FOOT_LONGITUDE_SEGMENTS,
    CURVE_CRAWLER_FOOT_LATITUDE_SEGMENTS,
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
