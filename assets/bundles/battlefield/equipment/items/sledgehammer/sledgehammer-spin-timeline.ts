import { SLEDGEHAMMER_PROGRESSION } from './sledgehammer-progression';

/**
 * 把旋风已推进时间转换为累计旋转角，起转和收势使用线性角速度渐变。
 *
 * @param elapsedSeconds 当前旋风已经推进的秒数。
 * @returns 从动作起点累计的正向旋转弧度。
 */
export function calculateSledgehammerSpinAngle(elapsedSeconds: number): number {
  const config = SLEDGEHAMMER_PROGRESSION;
  const elapsed = Math.max(0, Math.min(config.spinDurationSeconds, elapsedSeconds));
  const activeSeconds = config.spinDurationSeconds
    - config.spinStartupSeconds
    - config.spinRecoverySeconds;
  const weightedDuration = activeSeconds
    + config.spinStartupSeconds * 0.5
    + config.spinRecoverySeconds * 0.5;
  const totalAngle = config.spinRevolutions * Math.PI * 2;
  const angularSpeed = totalAngle / weightedDuration;
  if (elapsed < config.spinStartupSeconds) {
    return angularSpeed * elapsed * elapsed / (2 * config.spinStartupSeconds);
  }
  const startupAngle = angularSpeed * config.spinStartupSeconds * 0.5;
  const activeElapsed = elapsed - config.spinStartupSeconds;
  if (activeElapsed < activeSeconds) {
    return startupAngle + angularSpeed * activeElapsed;
  }
  const recoveryElapsed = Math.min(
    config.spinRecoverySeconds,
    activeElapsed - activeSeconds,
  );
  return startupAngle
    + angularSpeed * activeSeconds
    + angularSpeed * recoveryElapsed
    - angularSpeed * recoveryElapsed * recoveryElapsed / (2 * config.spinRecoverySeconds);
}
