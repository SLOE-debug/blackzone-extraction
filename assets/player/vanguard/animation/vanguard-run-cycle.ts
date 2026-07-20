const TAU = Math.PI * 2;
const CONTACT_FRACTION = 0.43;

/** 右腿并非绝对半周期镜像，保留轻微自然时间差。 */
export const VANGUARD_RUN_RIGHT_PHASE_OFFSET = Math.PI + 0.035;

enum VanguardRunLegChannel {
  HipAngle,
  KneeFlexion,
  FootPitch,
}

interface VanguardRunLegKeyframe {
  readonly phase: number;
  readonly hipAngle: number;
  readonly kneeFlexion: number;
  readonly footPitch: number;
}

// 角度以局部移动方向为正；关键帧依次覆盖落地、承重、蹬地、折腿、提膝和落脚。
const RUN_LEG_KEYFRAMES = Object.freeze([
  keyframe(0, 0.35, 0.21, -0.38),
  keyframe(0.18, 0.03, 0.31, -0.3),
  keyframe(0.43, -0.31, 0.21, -0.65),
  keyframe(0.56, -0.17, 1.31, -0.12),
  keyframe(0.7, 0.31, 1.83, 0),
  keyframe(0.86, 0.49, 0.87, -0.3),
  keyframe(1, 0.35, 0.21, -0.38),
] satisfies readonly Readonly<VanguardRunLegKeyframe>[]);

/** 返回大腿相对竖直向下方向的连续髋关节角度。 */
export function sampleVanguardRunHipAngle(phase: number): number {
  return sampleLegChannel(phase, VanguardRunLegChannel.HipAngle);
}

/** 返回膝关节折叠角；摆动中段会自然收起小腿而不是强行抬高整条腿。 */
export function sampleVanguardRunKneeFlexion(phase: number): number {
  return sampleLegChannel(phase, VanguardRunLegChannel.KneeFlexion);
}

/** 返回脚掌俯仰角；蹬地阶段压低脚尖，落地前恢复脚背控制。 */
export function sampleVanguardRunFootPitch(phase: number): number {
  return sampleLegChannel(phase, VanguardRunLegChannel.FootPitch);
}

/** 返回单脚承重程度，用于柔和重心横移。 */
export function sampleVanguardRunGrounding(phase: number): number {
  const cycle = normalizeCycle(phase);
  if (cycle >= CONTACT_FRACTION) {
    return 0;
  }
  return Math.sin(cycle / CONTACT_FRACTION * Math.PI);
}

/** 返回脚掌从触地建立、稳定承重到离地释放的连续约束权重。 */
export function sampleVanguardRunContactWeight(phase: number): number {
  const cycle = normalizeCycle(phase);
  if (cycle >= 0.5) {
    return 0;
  }
  const contactEstablish = smoothStep(clamp01(cycle / 0.075));
  const contactRelease = smoothStep(clamp01((0.5 - cycle) / 0.11));
  return contactEstablish * contactRelease;
}

/** 返回摆动腿折叠程度，只服务于身体和披风的次级节奏。 */
export function sampleVanguardRunSwingAmount(phase: number): number {
  const cycle = normalizeCycle(phase);
  if (cycle < CONTACT_FRACTION) {
    return 0;
  }
  return Math.sin((cycle - CONTACT_FRACTION) / (1 - CONTACT_FRACTION) * Math.PI);
}

/** 返回与同侧髋部反向的自然摆臂驱动。 */
export function sampleVanguardRunArmDrive(phase: number): number {
  return clampSigned(sampleVanguardRunHipAngle(phase) / 0.49);
}

/** 两脚短暂同时摆动时返回柔和腾空量，不制造规则弹跳。 */
export function sampleVanguardRunFlightAmount(phase: number): number {
  const leftSwing = sampleVanguardRunSwingAmount(phase);
  const rightSwing = sampleVanguardRunSwingAmount(
    phase + VANGUARD_RUN_RIGHT_PHASE_OFFSET,
  );
  return smoothStep(clamp01(Math.min(leftSwing, rightSwing) * 2.25));
}

function sampleLegChannel(phase: number, channel: VanguardRunLegChannel): number {
  const cycle = normalizeCycle(phase);
  const uniqueKeyframeCount = RUN_LEG_KEYFRAMES.length - 1;
  for (let segment = 0; segment < uniqueKeyframeCount; segment++) {
    const from = requireKeyframe(segment);
    const to = requireKeyframe(segment + 1);
    if (cycle > to.phase && segment < uniqueKeyframeCount - 1) {
      continue;
    }
    const duration = to.phase - from.phase;
    const amount = duration > 0 ? (cycle - from.phase) / duration : 0;
    const previousIndex = (segment - 1 + uniqueKeyframeCount) % uniqueKeyframeCount;
    const nextIndex = (segment + 2) % uniqueKeyframeCount;
    return catmullRom(
      readChannel(requireKeyframe(previousIndex), channel),
      readChannel(from, channel),
      readChannel(to, channel),
      readChannel(requireKeyframe(nextIndex), channel),
      clamp01(amount),
    );
  }
  return readChannel(requireKeyframe(0), channel);
}

function readChannel(
  value: Readonly<VanguardRunLegKeyframe>,
  channel: VanguardRunLegChannel,
): number {
  switch (channel) {
    case VanguardRunLegChannel.HipAngle:
      return value.hipAngle;
    case VanguardRunLegChannel.KneeFlexion:
      return value.kneeFlexion;
    case VanguardRunLegChannel.FootPitch:
      return value.footPitch;
  }
}

function catmullRom(
  previous: number,
  from: number,
  to: number,
  next: number,
  amount: number,
): number {
  const amountSquared = amount * amount;
  const amountCubed = amountSquared * amount;
  return 0.5 * (
    2 * from
      + (-previous + to) * amount
      + (2 * previous - 5 * from + 4 * to - next) * amountSquared
      + (-previous + 3 * from - 3 * to + next) * amountCubed
  );
}

function normalizeCycle(phase: number): number {
  const cycle = phase / TAU % 1;
  return cycle < 0 ? cycle + 1 : cycle;
}

function requireKeyframe(index: number): Readonly<VanguardRunLegKeyframe> {
  const value = RUN_LEG_KEYFRAMES[index];
  if (value === undefined) {
    throw new Error('主角跑步关节关键帧索引越界。');
  }
  return value;
}

function keyframe(
  phase: number,
  hipAngle: number,
  kneeFlexion: number,
  footPitch: number,
): Readonly<VanguardRunLegKeyframe> {
  return Object.freeze({ phase, hipAngle, kneeFlexion, footPitch });
}

function smoothStep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - clamped * 2);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
