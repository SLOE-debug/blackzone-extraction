import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  quantizeCurveCrawlerHitFlash,
  quantizeCurveCrawlerLiquidDrain,
} from '../model/curve-crawler-color-signal';
import {
  CurveCrawlerMeshSemantic,
  type CurveCrawlerMeshPlan,
} from './curve-crawler-mesh-plan';

const COLOR_BYTE_SCALE = 1 / 255;
const LEG_RED = 84 * COLOR_BYTE_SCALE;
const LEG_GREEN = 75 * COLOR_BYTE_SCALE;
const LEG_BLUE = 96 * COLOR_BYTE_SCALE;
const FOOT_RED = 72 * COLOR_BYTE_SCALE;
const FOOT_GREEN = 64 * COLOR_BYTE_SCALE;
const FOOT_BLUE = 82 * COLOR_BYTE_SCALE;
const ABDOMEN_RED = 102 * COLOR_BYTE_SCALE;
const ABDOMEN_GREEN = 92 * COLOR_BYTE_SCALE;
const ABDOMEN_BLUE = 112 * COLOR_BYTE_SCALE;
const THORAX_RED = 90 * COLOR_BYTE_SCALE;
const THORAX_GREEN = 80 * COLOR_BYTE_SCALE;
const THORAX_BLUE = 101 * COLOR_BYTE_SCALE;
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
const CRACK_RED = 19 * COLOR_BYTE_SCALE;
const CRACK_GREEN = 16 * COLOR_BYTE_SCALE;
const CRACK_BLUE = 22 * COLOR_BYTE_SCALE;
const EGG_RED = 151 * COLOR_BYTE_SCALE;
const EGG_GREEN = 137 * COLOR_BYTE_SCALE;
const EGG_BLUE = 121 * COLOR_BYTE_SCALE;
const EGG_SHARD_RED = 186 * COLOR_BYTE_SCALE;
const EGG_SHARD_GREEN = 142 * COLOR_BYTE_SCALE;
const EGG_SHARD_BLUE = 94 * COLOR_BYTE_SCALE;

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
  const hitFlash = quantizeCurveCrawlerHitFlash(
    state.data.animation.hitFlash[entityIndex] ?? 0,
  );
  const liquidDrain = quantizeCurveCrawlerLiquidDrain(
    state.data.animation.liquidDrain[entityIndex] ?? 0,
  );
  const eyeRed = mix(EYE_RED, HIT_RED, hitFlash);
  const eyeGreen = mix(EYE_GREEN, HIT_GREEN, hitFlash);
  const eyeBlue = mix(EYE_BLUE, HIT_BLUE, hitFlash);
  const liquidRed = mix(LIQUID_RED, DRAINED_LIQUID_RED, liquidDrain);
  const liquidGreen = mix(LIQUID_GREEN, DRAINED_LIQUID_GREEN, liquidDrain);
  const liquidBlue = mix(LIQUID_BLUE, DRAINED_LIQUID_BLUE, liquidDrain);

  for (let localVertex = 0; localVertex < plan.vertexCount; localVertex++) {
    const colorOffset = (entityVertexOffset + localVertex) * 4;
    switch (plan.semanticIds[localVertex]) {
      case CurveCrawlerMeshSemantic.Leg:
        writeHitColor(colors, colorOffset, LEG_RED, LEG_GREEN, LEG_BLUE, hitFlash);
        break;
      case CurveCrawlerMeshSemantic.Foot:
        writeHitColor(colors, colorOffset, FOOT_RED, FOOT_GREEN, FOOT_BLUE, hitFlash);
        break;
      case CurveCrawlerMeshSemantic.Abdomen:
        writeHitColor(colors, colorOffset, ABDOMEN_RED, ABDOMEN_GREEN, ABDOMEN_BLUE, hitFlash);
        break;
      case CurveCrawlerMeshSemantic.Thorax:
        writeHitColor(colors, colorOffset, THORAX_RED, THORAX_GREEN, THORAX_BLUE, hitFlash);
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
      case CurveCrawlerMeshSemantic.EmergenceCrack:
        colors[colorOffset] = CRACK_RED;
        colors[colorOffset + 1] = CRACK_GREEN;
        colors[colorOffset + 2] = CRACK_BLUE;
        break;
      case CurveCrawlerMeshSemantic.EmergenceEgg:
        colors[colorOffset] = EGG_RED;
        colors[colorOffset + 1] = EGG_GREEN;
        colors[colorOffset + 2] = EGG_BLUE;
        break;
      case CurveCrawlerMeshSemantic.EmergenceShard:
        colors[colorOffset] = EGG_SHARD_RED;
        colors[colorOffset + 1] = EGG_SHARD_GREEN;
        colors[colorOffset + 2] = EGG_SHARD_BLUE;
        break;
      default:
        throw new Error(`Curve Crawler 网格包含未知顶点语义：${plan.semanticIds[localVertex]}`);
    }
    colors[colorOffset + 3] = 1;
  }
}

/** 将身体分区的固有色与受击闪烁写入目标顶点。 */
function writeHitColor(
  colors: Float32Array,
  colorOffset: number,
  red: number,
  green: number,
  blue: number,
  hitFlash: number,
): void {
  colors[colorOffset] = mix(red, HIT_RED, hitFlash);
  colors[colorOffset + 1] = mix(green, HIT_GREEN, hitFlash);
  colors[colorOffset + 2] = mix(blue, HIT_BLUE, hitFlash);
}

/** 将两个颜色通道按事件强度线性混合。 */
function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
