/** 单枚技能按钮的屏幕中心。 */
export interface BattlefieldRadialSkillPosition {
  readonly x: number;
  readonly y: number;
}

const ARC_START = Math.PI;
const ARC_LENGTH = Math.PI * 0.5;

/** 按技能数量把按钮均匀放在摇杆左侧到上侧圆弧的各分段中心。 */
export function calculateBattlefieldRadialSkillLayout(
  centerX: number,
  centerY: number,
  orbitRadius: number,
  skillCount: number,
): readonly Readonly<BattlefieldRadialSkillPosition>[] {
  if (![centerX, centerY, orbitRadius].every(Number.isFinite)
    || orbitRadius <= 0
    || !Number.isSafeInteger(skillCount)
    || skillCount < 0) {
    throw new Error('径向技能键布局必须使用有限中心、正轨道半径和非负技能数。');
  }
  const positions: Readonly<BattlefieldRadialSkillPosition>[] = [];
  for (let index = 0; index < skillCount; index++) {
    const amount = (index + 0.5) / skillCount;
    const angle = ARC_START - ARC_LENGTH * amount;
    positions.push(Object.freeze({
      x: centerX + Math.cos(angle) * orbitRadius,
      y: centerY + Math.sin(angle) * orbitRadius,
    }));
  }
  return Object.freeze(positions);
}
