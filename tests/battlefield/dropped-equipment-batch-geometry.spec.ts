import { describe, expect, it } from 'vitest';
import { getBattlefieldEquipmentPrototype } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import {
  createDroppedEquipmentBatchGeometry,
  writeDroppedEquipmentBatchPose,
} from '../../assets/bundles/battlefield/equipment/geometry/dropped-equipment-batch-geometry';

const TRANSLATION = Object.freeze({
  m00: 1,
  m01: 0,
  m02: 0,
  m04: 0,
  m05: 1,
  m06: 0,
  m08: 0,
  m09: 0,
  m10: 1,
  m12: 3,
  m13: 2,
  m14: -4,
});

describe('掉落装备批几何', () => {
  it('把不同装备固定流拼为连续区段并只动态改写位置', () => {
    const first = getBattlefieldEquipmentPrototype(EquipmentId.DesertEagle).geometry;
    const second = getBattlefieldEquipmentPrototype(EquipmentId.HandgunAmmunition).geometry;
    const packed = createDroppedEquipmentBatchGeometry([first, second]);

    expect(packed.vertexOffsets).toEqual([0, first.vertexCount]);
    expect(packed.geometry.vertexCount).toBe(first.vertexCount + second.vertexCount);
    expect(packed.geometry.indexCount).toBe(first.indexCount + second.indexCount);
    expect(packed.geometry.index[first.indexCount]).toBe(
      (second.index[0] ?? 0) + first.vertexCount,
    );

    writeDroppedEquipmentBatchPose(first, packed.geometry, 0, true, TRANSLATION);
    expect(packed.geometry.positions[0]).toBeCloseTo(
      (first.positions[0] ?? 0) + TRANSLATION.m12,
      6,
    );
    writeDroppedEquipmentBatchPose(
      second,
      packed.geometry,
      first.vertexCount,
      false,
      TRANSLATION,
    );
    for (let vertex = first.vertexCount; vertex < packed.geometry.vertexCount; vertex++) {
      expect(packed.geometry.positions[vertex * 3]).toBe(TRANSLATION.m12);
      expect(packed.geometry.positions[vertex * 3 + 1]).toBe(TRANSLATION.m13);
      expect(packed.geometry.positions[vertex * 3 + 2]).toBe(TRANSLATION.m14);
    }
  });
});
