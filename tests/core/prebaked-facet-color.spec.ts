import { describe, expect, it } from 'vitest';
import {
  prebakedFacetMaterial,
  PrebakedFacetRole,
  writePrebakedFacetColor,
} from '../../assets/core/geometry/faceted/prebaked-facet-color';

const BASE = Object.freeze({ red: 0.5, green: 0.4, blue: 0.3, alpha: 1 });

describe('预烘分面颜色', () => {
  it('按结构角色和绑定法线建立稳定亮度层级', () => {
    const top = shade(PrebakedFacetRole.Exterior, 0, 1, 0);
    const litSide = shade(PrebakedFacetRole.Exterior, -1, 0, 0);
    const darkSide = shade(PrebakedFacetRole.Exterior, 1, 0, 0);
    const underside = shade(PrebakedFacetRole.Underside, 0, 1, 0);
    const cavity = shade(PrebakedFacetRole.Cavity, 0, 1, 0);

    expect(top).toBeGreaterThan(litSide);
    expect(litSide).toBeGreaterThan(darkSide);
    expect(darkSide).toBeGreaterThan(underside);
    expect(underside).toBeGreaterThan(cavity);
  });

  it('相同输入重复求值时得到完全一致的顶点色', () => {
    const first = shade(PrebakedFacetRole.Exterior, 0.2, 0.7, 0.4, 6);
    const second = shade(PrebakedFacetRole.Exterior, 0.2, 0.7, 0.4, 6);
    expect(second).toBe(first);
  });
});

function shade(
  role: PrebakedFacetRole,
  normalX: number,
  normalY: number,
  normalZ: number,
  variant = 3,
): number {
  const result = { red: 0, green: 0, blue: 0, alpha: 0 };
  writePrebakedFacetColor(
    result,
    prebakedFacetMaterial(BASE, role, variant),
    normalX,
    normalY,
    normalZ,
  );
  return result.red;
}
