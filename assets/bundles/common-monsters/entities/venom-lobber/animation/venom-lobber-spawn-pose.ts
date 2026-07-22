/** 返回尾刺破土与身体牵引阶段的局部前向 Root 偏移。 */
export function calculateVenomLobberSpawnRootForward(stateTime: number): number {
  if (stateTime <= 0.25) {
    return -0.9;
  }
  const progress = smoothStep(clamp01((stateTime - 0.25) / 1.1));
  return cubicBezier(-0.9, -1.45, 0.42, 0, progress);
}

/** 返回出生阶段的局部 Root 高度；负延迟期间保证整个模型完全隐藏。 */
export function calculateVenomLobberSpawnRootElevation(stateTime: number): number {
  if (stateTime < 0) {
    return -12;
  }
  if (stateTime <= 0.25) {
    return -7.45;
  }
  const progress = smoothStep(clamp01((stateTime - 0.25) / 1.1));
  return cubicBezier(-7.45, -6.25, -0.7, 0, progress);
}

/** 身体牵引期间最多只保留十度前倾。 */
export function calculateVenomLobberSpawnRootPitch(stateTime: number): number {
  if (stateTime <= 0.25) {
    return 0;
  }
  const progress = smoothStep(clamp01((stateTime - 0.25) / 1.1));
  return Math.sin(progress * Math.PI) * Math.PI / 18;
}

/** 六足落地后的短促下压，不改变总出生时长。 */
export function calculateVenomLobberSpawnLandingBob(stateTime: number): number {
  return stateTime >= 1.35
    ? -Math.sin(clamp01((stateTime - 1.35) / 0.25) * Math.PI) * 0.18
    : 0;
}

function cubicBezier(
  start: number,
  firstControl: number,
  secondControl: number,
  end: number,
  progress: number,
): number {
  const inverse = 1 - progress;
  return inverse * inverse * inverse * start
    + 3 * inverse * inverse * progress * firstControl
    + 3 * inverse * progress * progress * secondControl
    + progress * progress * progress * end;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

function smoothStep(value: number): number {
  return value * value * (3 - value * 2);
}
