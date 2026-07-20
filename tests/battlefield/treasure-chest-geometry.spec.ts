import { describe, expect, it } from 'vitest';
import { evaluateTreasureChestLidAngle } from '../../assets/bundles/battlefield/treasure-chest/animation/treasure-chest-animation';
import { TREASURE_CHEST_BODY_GEOMETRY } from '../../assets/bundles/battlefield/treasure-chest/geometry/treasure-chest-body-geometry';
import { TREASURE_CHEST_LID_GEOMETRY } from '../../assets/bundles/battlefield/treasure-chest/geometry/treasure-chest-lid-geometry';
import {
  createTreasureChestBatchGeometry,
  writeTreasureChestLidPose,
} from '../../assets/bundles/battlefield/treasure-chest/geometry/treasure-chest-batch-geometry';
import {
  BATTLEFIELD_TREASURE_CHEST_GENERATION,
  createBattlefieldTreasureChestSpawns,
  type BattlefieldTreasureChestSpawn,
  type BattlefieldTreasureChestPlacementConstraint,
} from '../../assets/bundles/battlefield/treasure-chest/model/battlefield-treasure-chest-spawn';
import { worldCoordinateToEnvironmentChunk } from '../../assets/bundles/battlefield/environment/model/battlefield-environment-chunk';
import { createChunkCoordinate } from '../../assets/core/world/chunk-coordinate';
import { TREASURE_CHEST_PALETTE } from '../../assets/bundles/battlefield/treasure-chest/geometry/treasure-chest-palette';
import {
  evaluateTreasureChestAttention,
  TREASURE_CHEST_ATTENTION,
} from '../../assets/bundles/battlefield/treasure-chest/animation/treasure-chest-attention';
import {
  createTreasureChestBeaconGeometry,
  TREASURE_CHEST_BEACON_TOPOLOGY,
  writeTreasureChestBeaconGeometry,
} from '../../assets/bundles/battlefield/treasure-chest/geometry/treasure-chest-beacon-geometry';
import {
  createSharedTreasureChestBeaconGeometry,
  createSharedTreasureChestBodyGeometry,
  writeSharedTreasureChestBeacon,
  writeSharedTreasureChestBody,
} from '../../assets/bundles/battlefield/treasure-chest/rendering/treasure-chest-shared-geometry';

const UNCONSTRAINED_PLACEMENT: BattlefieldTreasureChestPlacementConstraint = Object.freeze({
  isAreaClear: (): boolean => true,
});

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

  it('起始 Chunk 只保留一个稳定保底宝箱且不会刷在玩家脚边', () => {
    const first = createBattlefieldTreasureChestSpawns(
      createChunkCoordinate(0, 0),
      UNCONSTRAINED_PLACEMENT,
    );
    const second = createBattlefieldTreasureChestSpawns(
      createChunkCoordinate(0, 0),
      UNCONSTRAINED_PLACEMENT,
    );
    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    for (const spawn of first) {
      expect(Math.hypot(spawn.x, spawn.z)).toBeGreaterThanOrEqual(10);
    }
    let initialWindowChestCount = 0;
    for (let chunkX = -2; chunkX <= 2; chunkX++) {
      for (let chunkZ = -2; chunkZ <= 2; chunkZ++) {
        initialWindowChestCount += createBattlefieldTreasureChestSpawns(
          createChunkCoordinate(chunkX, chunkZ),
          UNCONSTRAINED_PLACEMENT,
        ).length;
      }
    }
    expect(initialWindowChestCount).toBeGreaterThanOrEqual(3);
    expect(initialWindowChestCount).toBeLessThanOrEqual(9);
  });

  it('在不同 Chunk 中稀疏随机生成宝箱且坐标所有权始终一致', () => {
    let emptyChunkCount = 0;
    let populatedChunkCount = 0;
    let totalChestCount = 0;
    let sampledChunkCount = 0;
    for (let chunkX = -32; chunkX <= 32; chunkX++) {
      for (let chunkZ = -32; chunkZ <= 32; chunkZ++) {
        if (chunkX === 0 && chunkZ === 0) {
          continue;
        }
        sampledChunkCount++;
        const spawns = createBattlefieldTreasureChestSpawns(
          createChunkCoordinate(chunkX, chunkZ),
          UNCONSTRAINED_PLACEMENT,
        );
        if (spawns.length === 0) {
          emptyChunkCount++;
        } else {
          populatedChunkCount++;
        }
        totalChestCount += spawns.length;
        expect(spawns.length).toBeLessThanOrEqual(
          BATTLEFIELD_TREASURE_CHEST_GENERATION.maximumChestsPerGeneratedChunk,
        );
        for (const spawn of spawns) {
          expect(worldCoordinateToEnvironmentChunk(spawn.x)).toBe(spawn.chunk.x);
          expect(worldCoordinateToEnvironmentChunk(spawn.z)).toBe(spawn.chunk.z);
        }
      }
    }
    expect(emptyChunkCount).toBeGreaterThan(0);
    expect(populatedChunkCount).toBeGreaterThan(0);
    expect(totalChestCount).toBe(populatedChunkCount);
    const observedGenerationChance = populatedChunkCount / sampledChunkCount;
    expect(Math.abs(
      observedGenerationChance - BATTLEFIELD_TREASURE_CHEST_GENERATION.generationChance,
    )).toBeLessThan(0.025);
  });

  it('相邻及对角 Chunk 的宝箱始终保持全局最小间距', () => {
    const spawns: BattlefieldTreasureChestSpawn[] = [];
    for (let chunkX = -16; chunkX <= 16; chunkX++) {
      for (let chunkZ = -16; chunkZ <= 16; chunkZ++) {
        spawns.push(...createBattlefieldTreasureChestSpawns(
          createChunkCoordinate(chunkX, chunkZ),
          UNCONSTRAINED_PLACEMENT,
        ));
      }
    }
    for (let first = 0; first < spawns.length; first++) {
      const firstSpawn = spawns[first];
      if (firstSpawn === undefined) {
        throw new Error('宝箱全局间距测试缺少首个生成结果。');
      }
      for (let second = first + 1; second < spawns.length; second++) {
        const secondSpawn = spawns[second];
        if (secondSpawn === undefined) {
          throw new Error('宝箱全局间距测试缺少第二个生成结果。');
        }
        expect(Math.hypot(
          secondSpawn.x - firstSpawn.x,
          secondSpawn.z - firstSpawn.z,
        )).toBeGreaterThanOrEqual(
          BATTLEFIELD_TREASURE_CHEST_GENERATION.minimumChestSpacing,
        );
      }
    }
  });

  it('关闭宝箱使用距离增强的信标呼吸且打开后完全熄灭', () => {
    const distant = { signalStrength: 0, proximity: 0, pulse: 0 };
    const nearby = { signalStrength: 0, proximity: 0, pulse: 0 };
    const inactive = { signalStrength: 0, proximity: 0, pulse: 0 };
    const peakTime = TREASURE_CHEST_ATTENTION.cycleDuration * 0.5;
    evaluateTreasureChestAttention(peakTime, 100, true, distant);
    evaluateTreasureChestAttention(peakTime, 1, true, nearby);
    evaluateTreasureChestAttention(peakTime, 1, false, inactive);
    expect(nearby.signalStrength).toBeGreaterThan(distant.signalStrength);
    expect(nearby.signalStrength).toBe(TREASURE_CHEST_ATTENTION.nearbyPeak);
    expect(nearby.proximity).toBe(1);
    expect(inactive).toEqual({ signalStrength: 0, proximity: 0, pulse: 0 });
  });

  it('地面信标使用固定无光拓扑且呼吸会同时改写位置和透明度', () => {
    const geometry = createTreasureChestBeaconGeometry();
    expect(geometry.vertexCount).toBe(TREASURE_CHEST_BEACON_TOPOLOGY.vertexCount);
    expect(geometry.indexCount).toBe(TREASURE_CHEST_BEACON_TOPOLOGY.indexCount);
    const idlePositions = geometry.positions.slice();
    const idleColors = geometry.colors.slice();
    writeTreasureChestBeaconGeometry(geometry, 1.1, 0.9);
    expect(Array.from(geometry.positions)).not.toEqual(Array.from(idlePositions));
    expect(Array.from(geometry.colors)).not.toEqual(Array.from(idleColors));
  });

  it('多个宝箱复用连续世界空间箱体与信标拓扑', () => {
    const bodySource = createTreasureChestBatchGeometry();
    const body = createSharedTreasureChestBodyGeometry(bodySource, 2);
    writeSharedTreasureChestBody(bodySource, body, 0, 0, 0, 0, 0, true);
    writeSharedTreasureChestBody(bodySource, body, 1, 10, 2, -4, Math.PI * 0.5, true);
    const bodyStride = bodySource.geometry.vertexCount * 3;
    expect(body.positions.subarray(0, bodyStride)).toEqual(
      bodySource.geometry.getPositionView(),
    );
    const localX = bodySource.geometry.positions[0] ?? 0;
    const localY = bodySource.geometry.positions[1] ?? 0;
    const localZ = bodySource.geometry.positions[2] ?? 0;
    expect(body.positions[bodyStride]).toBeCloseTo(10 + localZ, 5);
    expect(body.positions[bodyStride + 1]).toBeCloseTo(2 + localY, 5);
    expect(body.positions[bodyStride + 2]).toBeCloseTo(-4 - localX, 5);

    const beaconSource = createTreasureChestBeaconGeometry();
    writeTreasureChestBeaconGeometry(beaconSource, 0.7, 0.8);
    const beacon = createSharedTreasureChestBeaconGeometry(beaconSource, 2);
    writeSharedTreasureChestBeacon(beaconSource, beacon, 0, 0, 0, 0, 0);
    writeSharedTreasureChestBeacon(beaconSource, beacon, 1, 10, 2, -4, 0);
    expect(beacon.colors.subarray(0, beaconSource.colors.length)).toEqual(
      beaconSource.getColorView(),
    );
    expect(beacon.index[beaconSource.indexCount]).toBe(beaconSource.vertexCount);
  });
});
