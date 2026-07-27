const DEGREES_TO_RADIANS = Math.PI / 180;
const MINIMUM_WINDUP_TURN_SPEED = 540 * DEGREES_TO_RADIANS;
const MAXIMUM_WINDUP_TURN_SPEED = 1080 * DEGREES_TO_RADIANS;

/**
 * 计算在前摇可用时间内大体朝向攻击目标所需的最低角速度。
 *
 * @param currentHeading 人物开始前摇时的身体朝向。
 * @param targetHeading 本次攻击的权威目标朝向。
 * @param windupSeconds 完整前摇时长。
 * @returns 限制在每秒 540° 至 1080°之间的角速度。
 */
export function calculateRequiredWindupTurnSpeed(
  currentHeading: number,
  targetHeading: number,
  windupSeconds: number,
): number {
  if (!Number.isFinite(currentHeading)
    || !Number.isFinite(targetHeading)
    || !Number.isFinite(windupSeconds)
    || windupSeconds <= 0) {
    throw new Error('大锤前摇转向必须使用有限朝向和正时长。');
  }
  const difference = Math.abs(Math.atan2(
    Math.sin(targetHeading - currentHeading),
    Math.cos(targetHeading - currentHeading),
  ));
  const availableSeconds = Math.max(0.05, windupSeconds * 0.85);
  const requiredSpeed = difference / availableSeconds;
  return Math.max(
    MINIMUM_WINDUP_TURN_SPEED,
    Math.min(MAXIMUM_WINDUP_TURN_SPEED, requiredSpeed),
  );
}
