import { describe, expect, it } from 'vitest';
import { AmmunitionType } from '../../assets/core/equipment/equipment';
import { AMMUNITION_CALIBER_LABEL } from '../../assets/bundles/battlefield/equipment/model/weapon-ammunition-status';
import { BATTLEFIELD_WEAPON_STATUS_STYLE } from '../../assets/bundles/battlefield/ui/battlefield-weapon-status-style';

describe('武器弹药 HUD 契约', () => {
  it('为全部口径提供玩家可读短名', () => {
    expect(AMMUNITION_CALIBER_LABEL).toEqual({
      [AmmunitionType.FiftyActionExpress]: '.50 AE',
      [AmmunitionType.TwelveGauge]: '12 GA',
      [AmmunitionType.FortyFiveAcp]: '.45 ACP',
      [AmmunitionType.FiveFiveSixNato]: '5.56×45',
      [AmmunitionType.SevenSixTwoByThirtyNine]: '7.62×39',
    });
  });

  it('面板保持在移动端可容纳的紧凑尺寸', () => {
    expect(BATTLEFIELD_WEAPON_STATUS_STYLE.panelWidth).toBeLessThanOrEqual(134);
    expect(BATTLEFIELD_WEAPON_STATUS_STYLE.panelHeight).toBeLessThanOrEqual(24);
  });
});
