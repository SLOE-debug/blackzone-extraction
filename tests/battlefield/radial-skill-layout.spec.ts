import { describe, expect, it } from 'vitest';
import { calculateBattlefieldRadialSkillLayout } from '../../assets/bundles/battlefield/ui/battlefield-radial-skill-layout';

describe('武器技能径向布局', () => {
  it('三枚技能全部位于右摇杆左侧或上侧', () => {
    const layout = calculateBattlefieldRadialSkillLayout(240, -120, 90);
    expect(layout[0]).toEqual({ x: 150, y: -120 });
    expect(layout[1]?.x).toBeLessThan(240);
    expect(layout[1]?.y).toBeGreaterThan(-120);
    expect(layout[2]).toEqual({ x: 240, y: -30 });
  });
});
