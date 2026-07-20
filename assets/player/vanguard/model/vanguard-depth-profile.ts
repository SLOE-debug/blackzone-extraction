import { VANGUARD_ANATOMY } from './vanguard-anatomy';

interface VanguardDepthProfileSample {
  readonly height: number;
  readonly frontScale: number;
  readonly backScale: number;
}

/**
 * 从靴底到帽顶连续变化的前后纵深轮廓。
 *
 * 胸背承担主要体积，头部和帽子保持克制，腿脚向地面逐渐收窄。
 * 前后使用不同倍率，让侧面轮廓避免成为以原点为中心的机械拉伸。
 */
const VANGUARD_DEPTH_PROFILE = Object.freeze([
  sample(0, 1.1, 1.14),
  sample(0.2, 1.16, 1.2),
  sample(0.75, 1.23, 1.3),
  sample(1.5, 1.32, 1.4),
  sample(2.05, 1.4, 1.5),
  sample(2.7, 1.44, 1.55),
  sample(3.15, 1.38, 1.5),
  sample(3.3, 1.26, 1.42),
  sample(3.7, 1.22, 1.38),
  sample(4.15, 1.18, 1.32),
] satisfies readonly VanguardDepthProfileSample[]);

/**
 * 把美术基准 Z 坐标转换为最终角色纵深。
 *
 * @param height 角色绑定姿态中的局部高度。
 * @param depth 未应用侧面体积曲线的 Z 坐标，正值朝角色正面。
 * @returns 应写入控制笼或模拟静止态的最终 Z 坐标。
 */
export function resolveVanguardDepth(height: number, depth: number): number {
  const last = VANGUARD_DEPTH_PROFILE[VANGUARD_DEPTH_PROFILE.length - 1];
  if (last === undefined) {
    throw new Error('主角纵深轮廓缺少采样点。');
  }
  if (height <= (VANGUARD_DEPTH_PROFILE[0]?.height ?? 0)) {
    return depth * selectScale(VANGUARD_DEPTH_PROFILE[0] ?? last, depth);
  }
  for (let index = 1; index < VANGUARD_DEPTH_PROFILE.length; index++) {
    const upper = VANGUARD_DEPTH_PROFILE[index];
    const lower = VANGUARD_DEPTH_PROFILE[index - 1];
    if (upper === undefined || lower === undefined || height > upper.height) {
      continue;
    }
    const interval = Math.max(upper.height - lower.height, 0.000001);
    const alpha = Math.max(0, Math.min(1, (height - lower.height) / interval));
    const lowerScale = selectScale(lower, depth);
    const upperScale = selectScale(upper, depth);
    return depth * (lowerScale + (upperScale - lowerScale) * alpha);
  }
  return depth * selectScale(last, depth);
}

/** 返回指定高度下能够包住前后两侧的对称碰撞半径。 */
export function resolveVanguardDepthRadius(height: number, radius: number): number {
  return Math.max(
    resolveVanguardDepth(height, radius),
    -resolveVanguardDepth(height, -radius),
  );
}

/** 披风躯干碰撞椭球使用的最终前后半径。 */
export const VANGUARD_TORSO_COLLISION_DEPTH_RADIUS = resolveVanguardDepthRadius(
  VANGUARD_ANATOMY.chestY,
  0.37,
);

function selectScale(samplePoint: VanguardDepthProfileSample, depth: number): number {
  return depth >= 0 ? samplePoint.frontScale : samplePoint.backScale;
}

function sample(
  height: number,
  frontScale: number,
  backScale: number,
): VanguardDepthProfileSample {
  return Object.freeze({ height, frontScale, backScale });
}
