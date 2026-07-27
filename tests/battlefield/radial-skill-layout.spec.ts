import { describe, expect, it } from 'vitest';
import { calculateBattlefieldRadialSkillLayout } from '../../assets/bundles/battlefield/ui/battlefield-radial-skill-layout';

describe('武器技能径向布局', () => {
  it('两枚技能等距分布并关于左上对角线对称', () => {
    const centerX = 240;
    const centerY = -120;
    const radius = 90;
    const layout = calculateBattlefieldRadialSkillLayout(centerX, centerY, radius, 2);
    expect(layout).toHaveLength(2);
    const first = layout[0];
    const second = layout[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    const firstAngle = Math.atan2((first?.y ?? 0) - centerY, (first?.x ?? 0) - centerX);
    const secondAngle = Math.atan2((second?.y ?? 0) - centerY, (second?.x ?? 0) - centerX);
    expect(firstAngle).toBeCloseTo(Math.PI * 7 / 8, 6);
    expect(secondAngle).toBeCloseTo(Math.PI * 5 / 8, 6);
    expect(Math.hypot((first?.x ?? 0) - centerX, (first?.y ?? 0) - centerY))
      .toBeCloseTo(radius, 6);
    expect(Math.hypot((second?.x ?? 0) - centerX, (second?.y ?? 0) - centerY))
      .toBeCloseTo(radius, 6);
  });
});
