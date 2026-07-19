import { describe, expect, it } from 'vitest';
import { evaluateTreasureChestLidAngle } from '../../assets/bundles/battlefield/treasure-chest/animation/treasure-chest-animation';
import { TREASURE_CHEST_BODY_GEOMETRY } from '../../assets/bundles/battlefield/treasure-chest/geometry/treasure-chest-body-geometry';
import { TREASURE_CHEST_LID_GEOMETRY } from '../../assets/bundles/battlefield/treasure-chest/geometry/treasure-chest-lid-geometry';
import {
  createTreasureChestBatchGeometry,
  writeTreasureChestLidPose,
} from '../../assets/bundles/battlefield/treasure-chest/geometry/treasure-chest-batch-geometry';
import { BATTLEFIELD_TREASURE_CHEST_SPAWNS } from '../../assets/bundles/battlefield/treasure-chest/model/battlefield-treasure-chest-spawn';
import { worldCoordinateToEnvironmentChunk } from '../../assets/bundles/battlefield/environment/model/battlefield-environment-chunk';
import { TREASURE_CHEST_PALETTE } from '../../assets/bundles/battlefield/treasure-chest/geometry/treasure-chest-palette';
import {
  evaluateTreasureChestAttention,
  TREASURE_CHEST_ATTENTION,
} from '../../assets/bundles/battlefield/treasure-chest/animation/treasure-chest-attention';

describe('程序化 Low Poly 宝箱', () => {
  it('主体和箱盖均由有限、非退化、带单位法线的固定三角拓扑构成', () => {
    for (const geometry of [TREASURE_CHEST_BODY_GEOMETRY, TREASURE_CHEST_LID_GEOMETRY]) {
      expect(geometry.vertexCount).toBeGreaterThan(30);
      expect(geometry.vertexCount % 3).toBe(0);
      expect(geometry.indexCount).toBe(geometry.vertexCount);
      for (let offset = 0; offset < geometry.normals.length; offset += 3) {
        expect(Math.hypot(
          geometry.normals[offset] ?? 0,
          geometry.normals[offset + 1] ?? 0,
          geometry.normals[offset + 2] ?? 0,
        )).toBeCloseTo(1, 5);
      }
    }
  });

  it('箱盖先越过最终角度再平滑回落到稳定打开角', () => {
    expect(evaluateTreasureChestLidAngle(0)).toBeCloseTo(0);
    const overshoot = evaluateTreasureChestLidAngle(1.08 * 0.72);
    const final = evaluateTreasureChestLidAngle(1.08);
    expect(overshoot).toBeLessThan(final);
    expect(final).toBeCloseTo(-108);
  });

  it('箱体和动态箱盖共享一个固定索引批次且开盖只改写箱盖区段', () => {
    const batch = createTreasureChestBatchGeometry();
    const geometry = batch.geometry;
    expect(geometry.vertexCount).toBe(
      TREASURE_CHEST_BODY_GEOMETRY.vertexCount + TREASURE_CHEST_LID_GEOMETRY.vertexCount,
    );
    expect(geometry.indexCount).toBe(
      TREASURE_CHEST_BODY_GEOMETRY.indexCount + TREASURE_CHEST_LID_GEOMETRY.indexCount,
    );
    const bodyPositions = geometry.positions.slice(
      0,
      TREASURE_CHEST_BODY_GEOMETRY.vertexCount * 3,
    );
    const closedLidPositions = geometry.positions.slice(batch.lidVertexOffset * 3);
    writeTreasureChestLidPose(batch, -108);
    expect(Array.from(geometry.positions.slice(
      0,
      TREASURE_CHEST_BODY_GEOMETRY.vertexCount * 3,
    ))).toEqual(Array.from(bodyPositions));
    expect(Array.from(geometry.positions.slice(batch.lidVertexOffset * 3)))
      .not.toEqual(Array.from(closedLidPositions));
  });

  it('横向轮廓保持紧凑并通过克制的同材质色阶维持辨识度', () => {
    const bodyBounds = TREASURE_CHEST_BODY_GEOMETRY.computeBounds();
    const bodyWidth = bodyBounds.maxX - bodyBounds.minX;
    const bodyDepth = bodyBounds.maxZ - bodyBounds.minZ;
    expect(bodyWidth).toBeLessThan(2.15);
    expect(bodyWidth / bodyDepth).toBeLessThan(1.5);
    expect(TREASURE_CHEST_PALETTE.timberDark.red).toBeGreaterThan(0.2);
    expect(TREASURE_CHEST_PALETTE.timberLight.red).toBeLessThan(0.65);
    expect(TREASURE_CHEST_PALETTE.metalLight.red)
      .toBeGreaterThan(TREASURE_CHEST_PALETTE.timberLight.red);
  });

  it('清单中的宝箱坐标与声明的 Chunk 所有权一致', () => {
    for (const spawn of BATTLEFIELD_TREASURE_CHEST_SPAWNS) {
      expect(worldCoordinateToEnvironmentChunk(spawn.x)).toBe(spawn.chunk.x);
      expect(worldCoordinateToEnvironmentChunk(spawn.z)).toBe(spawn.chunk.z);
    }
  });

  it('关闭宝箱使用距离增强的克制呼吸提示且打开后回到最低值', () => {
    const distant = { red: 0, green: 0, blue: 0 };
    const nearby = { red: 0, green: 0, blue: 0 };
    const inactive = { red: 0, green: 0, blue: 0 };
    const peakTime = TREASURE_CHEST_ATTENTION.cycleDuration * 0.5;
    evaluateTreasureChestAttention(peakTime, 100, true, distant);
    evaluateTreasureChestAttention(peakTime, 1, true, nearby);
    evaluateTreasureChestAttention(peakTime, 1, false, inactive);
    expect(nearby.red).toBeGreaterThan(distant.red);
    expect(nearby.red).toBe(TREASURE_CHEST_ATTENTION.nearbyPeak.red);
    expect(nearby.green).toBe(TREASURE_CHEST_ATTENTION.nearbyPeak.green);
    expect(nearby.blue).toBe(TREASURE_CHEST_ATTENTION.nearbyPeak.blue);
    expect(nearby.red).toBeLessThanOrEqual(64);
    expect(inactive).toEqual(TREASURE_CHEST_ATTENTION.minimum);
  });
});
