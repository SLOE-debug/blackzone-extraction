/**
 * 用稳定隐式积分推进一个带速度状态的二阶响应字段。
 *
 * @param values 连续标量状态。
 * @param velocities 与标量状态一一对应的速度。
 * @param index 待更新字段索引。
 * @param target 当前目标值。
 * @param angularFrequency 响应角频率。
 * @param dampingRatio 阻尼比；一为临界阻尼，小于一允许受控越界。
 * @param deltaTime 当前帧秒数。
 */
export function updateSecondOrderResponse(
  values: Float32Array,
  velocities: Float32Array,
  index: number,
  target: number,
  angularFrequency: number,
  dampingRatio: number,
  deltaTime: number,
): void {
  if (!Number.isInteger(index) || index < 0 || index >= values.length
    || index >= velocities.length) {
    throw new Error('二阶响应字段索引越界。');
  }
  if (![target, angularFrequency, dampingRatio, deltaTime].every(Number.isFinite)
    || angularFrequency <= 0 || dampingRatio < 0 || deltaTime < 0) {
    throw new Error('二阶响应参数必须是有限且有效的数值。');
  }
  const value = values[index] ?? 0;
  const velocity = velocities[index] ?? 0;
  const frequencyStep = angularFrequency * deltaTime;
  const dampingStep = 2 * dampingRatio * frequencyStep;
  const stiffnessStep = frequencyStep * frequencyStep;
  const denominator = 1 + dampingStep + stiffnessStep;
  values[index] = (
    value * (1 + dampingStep)
      + velocity * deltaTime
      + target * stiffnessStep
  ) / denominator;
  velocities[index] = (
    velocity + angularFrequency * angularFrequency * deltaTime * (target - value)
  ) / denominator;
}
