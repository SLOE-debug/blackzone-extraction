import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  CurveCrawlerMeshSemantic,
  type CurveCrawlerMeshPlan,
} from './curve-crawler-mesh-plan';

const COLOR_BYTE_SCALE = 1 / 255;
const BODY_RED = 92 * COLOR_BYTE_SCALE;
const BODY_GREEN = 84 * COLOR_BYTE_SCALE;
const BODY_BLUE = 102 * COLOR_BYTE_SCALE;
const EYE_RED = 1;
const EYE_GREEN = 168 * COLOR_BYTE_SCALE;
const EYE_BLUE = 188 * COLOR_BYTE_SCALE;
const HIT_RED = 1;
const HIT_GREEN = 12 * COLOR_BYTE_SCALE;
const HIT_BLUE = 7 * COLOR_BYTE_SCALE;
const LIQUID_RED = 27 * COLOR_BYTE_SCALE;
const LIQUID_GREEN = 82 * COLOR_BYTE_SCALE;
const LIQUID_BLUE = 45 * COLOR_BYTE_SCALE;
const DRAINED_LIQUID_RED = 8 * COLOR_BYTE_SCALE;
const DRAINED_LIQUID_GREEN = 30 * COLOR_BYTE_SCALE;
const DRAINED_LIQUID_BLUE = 17 * COLOR_BYTE_SCALE;

/**
 * 按编译后的语义 ID 写入一个实体的事件驱动颜色流。
 *
 * 身体和双眼响应受击闪烁；液体只响应液化收拢进度。普通步态不会调用本函数。
 */
export function evaluateCurveCrawlerColors(
  state: CurveCrawlerState,
  plan: CurveCrawlerMeshPlan,
  entityIndex: number,
  entityVertexOffset: number,
  colors: Float32Array,
): void {
  const hitFlash = state.data.animation.hitFlash[entityIndex] ?? 0;
  const liquidDrain = state.data.animation.liquidDrain[entityIndex] ?? 0;
  const bodyRed = mix(BODY_RED, HIT_RED, hitFlash);
  const bodyGreen = mix(BODY_GREEN, HIT_GREEN, hitFlash);
  const bodyBlue = mix(BODY_BLUE, HIT_BLUE, hitFlash);
  const eyeRed = mix(EYE_RED, HIT_RED, hitFlash);
  const eyeGreen = mix(EYE_GREEN, HIT_GREEN, hitFlash);
  const eyeBlue = mix(EYE_BLUE, HIT_BLUE, hitFlash);
  const liquidRed = mix(LIQUID_RED, DRAINED_LIQUID_RED, liquidDrain);
  const liquidGreen = mix(LIQUID_GREEN, DRAINED_LIQUID_GREEN, liquidDrain);
  const liquidBlue = mix(LIQUID_BLUE, DRAINED_LIQUID_BLUE, liquidDrain);

  for (let localVertex = 0; localVertex < plan.vertexCount; localVertex++) {
    const colorOffset = (entityVertexOffset + localVertex) * 4;
    switch (plan.semanticIds[localVertex]) {
      case CurveCrawlerMeshSemantic.Body:
        colors[colorOffset] = bodyRed;
        colors[colorOffset + 1] = bodyGreen;
        colors[colorOffset + 2] = bodyBlue;
        break;
      case CurveCrawlerMeshSemantic.Eye:
        colors[colorOffset] = eyeRed;
        colors[colorOffset + 1] = eyeGreen;
        colors[colorOffset + 2] = eyeBlue;
        break;
      case CurveCrawlerMeshSemantic.Liquid:
        colors[colorOffset] = liquidRed;
        colors[colorOffset + 1] = liquidGreen;
        colors[colorOffset + 2] = liquidBlue;
        break;
      default:
        throw new Error(`Curve Crawler 网格包含未知顶点语义：${plan.semanticIds[localVertex]}`);
    }
    colors[colorOffset + 3] = 1;
  }
}

/** 将两个颜色通道按事件强度线性混合。 */
function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
