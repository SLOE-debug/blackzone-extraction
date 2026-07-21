import { describe, expect, it } from 'vitest';
import {
  createDroppedEquipmentBeamGeometry,
  DROPPED_EQUIPMENT_BEAM_TOPOLOGY,
  writeDroppedEquipmentBeam,
} from '../../assets/bundles/battlefield/equipment/geometry/dropped-equipment-beam-geometry';
import { EQUIPMENT_RARITY_PALETTE } from '../../assets/bundles/battlefield/equipment/model/equipment-rarity-palette';
import { DROPPED_EQUIPMENT_ACCENT_LAYOUT } from '../../assets/bundles/battlefield/equipment/model/dropped-equipment-accent-layout';
import { EquipmentRarity } from '../../assets/core/equipment/equipment';

describe('掉落装备毛笔形渐隐光管', () => {
  it('使用固定低段数拓扑保持独立世界尺度，并从不透明笔腹收束到透明笔锋', () => {
    const geometry = createDroppedEquipmentBeamGeometry(1);
    writeDroppedEquipmentBeam(
      geometry,
      0,
      3,
      1,
      -2,
      EQUIPMENT_RARITY_PALETTE[EquipmentRarity.Rare],
      true,
    );

    expect(geometry.vertexCount).toBe(DROPPED_EQUIPMENT_BEAM_TOPOLOGY.verticesPerBeam);
    const ys: number[] = [];
    const alphas: number[] = [];
    for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
      ys.push(geometry.positions[vertex * 3 + 1] ?? 0);
      alphas.push(geometry.colors[vertex * 4 + 3] ?? 0);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(
      DROPPED_EQUIPMENT_ACCENT_LAYOUT.beamHeight,
      5,
    );
    expect(Math.max(...alphas)).toBe(1);
    expect(Math.min(...alphas)).toBe(0);
    expect(alphas.some((alpha) => alpha > 0 && alpha < 1)).toBe(true);

    const baseY = Math.min(...ys);
    const baseRadii: number[] = [];
    for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
      if (Math.abs((geometry.positions[vertex * 3 + 1] ?? 0) - baseY) > 0.00001) {
        continue;
      }
      baseRadii.push(Math.hypot(
        (geometry.positions[vertex * 3] ?? 0) - 3,
        (geometry.positions[vertex * 3 + 2] ?? 0) + 2,
      ));
    }
    expect(Math.max(...baseRadii) - Math.min(...baseRadii)).toBeGreaterThan(0.08);
  });

  it('等待起飞时把整根光管退化并隐藏', () => {
    const geometry = createDroppedEquipmentBeamGeometry(1);
    writeDroppedEquipmentBeam(
      geometry,
      0,
      4,
      2,
      7,
      EQUIPMENT_RARITY_PALETTE[EquipmentRarity.Common],
      false,
    );

    for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
      expect(geometry.positions[vertex * 3]).toBe(4);
      expect(geometry.positions[vertex * 3 + 1]).toBe(2);
      expect(geometry.positions[vertex * 3 + 2]).toBe(7);
      expect(geometry.colors[vertex * 4 + 3]).toBe(0);
    }
  });
});
