/** 单枚技能按钮的屏幕中心。 */
export interface BattlefieldRadialSkillPosition {
  readonly x: number;
  readonly y: number;
}

/** 计算摇杆左侧、左上侧和上侧的 MOBA 技能扇区。 */
export function calculateBattlefieldRadialSkillLayout(
  centerX: number,
  centerY: number,
  orbitRadius: number,
): readonly Readonly<BattlefieldRadialSkillPosition>[] {
  if (![centerX, centerY, orbitRadius].every(Number.isFinite) || orbitRadius <= 0) {
    throw new Error('径向技能键布局必须使用有限中心和正轨道半径。');
  }
  const diagonal = orbitRadius * Math.SQRT1_2;
  return Object.freeze([
    Object.freeze({ x: centerX - orbitRadius, y: centerY }),
    Object.freeze({ x: centerX - diagonal, y: centerY + diagonal }),
    Object.freeze({ x: centerX, y: centerY + orbitRadius }),
  ]);
}
