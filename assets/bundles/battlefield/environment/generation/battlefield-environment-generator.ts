import {
  nextRandom,
  normalizeRandomSeed,
  randomInteger,
  randomRange,
} from '../../../../core/math/xorshift32';
import {
  BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG,
  BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG,
} from '../model/battlefield-environment-config';
import { BATTLEFIELD_ENVIRONMENT_LANDMARKS } from '../model/battlefield-environment-landmarks';
import { BattlefieldEnvironmentPrototype } from '../model/battlefield-environment-prototype';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * 将无限整数 Chunk 坐标确定性展开为当前窗口的环境 Archetype 数据。
 *
 * 生成只发生在玩家跨越 Chunk 边界时；实体槽位和 TypedArray 始终复用。
 */
export class BattlefieldEnvironmentGenerator {
  private readonly randomState = new Uint32Array(1);
  private entitySeed = 1;

  /** 按中心 Chunk 重新填充固定半径窗口。 */
  public populate(
    centerChunkX: number,
    centerChunkZ: number,
    world: BattlefieldEnvironmentWorldState,
  ): void {
    if (!Number.isInteger(centerChunkX) || !Number.isInteger(centerChunkZ)) {
      throw new Error('环境窗口中心必须使用整数 Chunk 坐标。');
    }
    world.reset();
    const radius = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.activeChunkRadius;
    if (Math.abs(centerChunkX) <= radius && Math.abs(centerChunkZ) <= radius) {
      this.beginChunk(0, 0);
      this.populateOriginShowcase(world);
    }
    for (let chunkZ = centerChunkZ - radius; chunkZ <= centerChunkZ + radius; chunkZ++) {
      for (let chunkX = centerChunkX - radius; chunkX <= centerChunkX + radius; chunkX++) {
        if (chunkX === 0 && chunkZ === 0) {
          continue;
        }
        this.beginChunk(chunkX, chunkZ);
        this.populateProceduralChunk(world, chunkX, chunkZ);
      }
    }
  }

  private populateOriginShowcase(world: BattlefieldEnvironmentWorldState): void {
    const landmarks = BATTLEFIELD_ENVIRONMENT_LANDMARKS;
    this.spawnExact(
      world,
      BattlefieldEnvironmentPrototype.RitualAltar,
      landmarks.ritualAltar.x,
      landmarks.ritualAltar.z,
      0.18,
      1,
      0,
      0,
    );
    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.CrystalCluster,
      landmarks.ritualAltar.x,
      landmarks.ritualAltar.z,
      3,
      3.4,
      4.8,
      0,
      0,
    );
    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.GlowPlant,
      landmarks.ritualAltar.x,
      landmarks.ritualAltar.z,
      8,
      2.8,
      5.6,
      0,
      0,
    );

    this.spawnExact(
      world,
      BattlefieldEnvironmentPrototype.VehicleWreck,
      landmarks.vehicleWreck.x,
      landmarks.vehicleWreck.z,
      -0.34,
      1,
      0,
      0,
    );
    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.RockFormation,
      landmarks.vehicleWreck.x,
      landmarks.vehicleWreck.z,
      5,
      3.1,
      5.4,
      0,
      0,
    );

    this.spawnExact(
      world,
      BattlefieldEnvironmentPrototype.CorruptedPool,
      landmarks.corruptedPool.x,
      landmarks.corruptedPool.z,
      0.08,
      1,
      0,
      0,
    );
    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.LuminousMushroom,
      landmarks.corruptedPool.x,
      landmarks.corruptedPool.z,
      9,
      3.2,
      6.1,
      0,
      0,
    );

    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.CrystalCluster,
      landmarks.crystalGrove.x,
      landmarks.crystalGrove.z,
      4,
      0.8,
      4.2,
      0,
      0,
    );
    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.DeadTree,
      0,
      0,
      10,
      17.5,
      21,
      0,
      0,
    );
    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.GlowPlant,
      0,
      0,
      10,
      10,
      20,
      0,
      0,
    );
  }

  private populateProceduralChunk(
    world: BattlefieldEnvironmentWorldState,
    chunkX: number,
    chunkZ: number,
  ): void {
    const size = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
    const centerX = chunkX * size;
    const centerZ = chunkZ * size;
    const organicCenterX = centerX + randomRange(this.randomState, 0, -size * 0.24, size * 0.24);
    const organicCenterZ = centerZ + randomRange(this.randomState, 0, -size * 0.24, size * 0.24);
    const mineralCenterX = centerX + randomRange(this.randomState, 0, -size * 0.28, size * 0.28);
    const mineralCenterZ = centerZ + randomRange(this.randomState, 0, -size * 0.28, size * 0.28);

    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.DeadTree,
      organicCenterX,
      organicCenterZ,
      randomInteger(this.randomState, 0, 3, 6),
      4,
      12,
      chunkX,
      chunkZ,
    );
    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.LuminousMushroom,
      organicCenterX,
      organicCenterZ,
      randomInteger(this.randomState, 0, 2, 5),
      2,
      9,
      chunkX,
      chunkZ,
    );
    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.GlowPlant,
      organicCenterX,
      organicCenterZ,
      randomInteger(this.randomState, 0, 3, 7),
      3,
      13,
      chunkX,
      chunkZ,
    );
    this.spawnRing(
      world,
      BattlefieldEnvironmentPrototype.RockFormation,
      mineralCenterX,
      mineralCenterZ,
      randomInteger(this.randomState, 0, 1, 4),
      2,
      9,
      chunkX,
      chunkZ,
    );
    if (nextRandom(this.randomState, 0) < 0.62) {
      this.spawnRing(
        world,
        BattlefieldEnvironmentPrototype.CrystalCluster,
        mineralCenterX,
        mineralCenterZ,
        randomInteger(this.randomState, 0, 1, 3),
        1.2,
        6.5,
        chunkX,
        chunkZ,
      );
    }
    if (nextRandom(this.randomState, 0) < 0.18) {
      this.spawnRandom(
        world,
        BattlefieldEnvironmentPrototype.CorruptedPool,
        centerX + randomRange(this.randomState, 0, -size * 0.3, size * 0.3),
        centerZ + randomRange(this.randomState, 0, -size * 0.3, size * 0.3),
        chunkX,
        chunkZ,
      );
    }

    const landmarkSelector = hashChunkCoordinates(chunkX, chunkZ, 0x3f29b1);
    if (landmarkSelector % 13 === 0) {
      this.spawnRandom(
        world,
        BattlefieldEnvironmentPrototype.RitualAltar,
        centerX,
        centerZ,
        chunkX,
        chunkZ,
      );
    } else if (landmarkSelector % 11 === 0) {
      this.spawnRandom(
        world,
        BattlefieldEnvironmentPrototype.VehicleWreck,
        centerX,
        centerZ,
        chunkX,
        chunkZ,
      );
    }
  }

  private spawnRing(
    world: BattlefieldEnvironmentWorldState,
    prototype: BattlefieldEnvironmentPrototype,
    centerX: number,
    centerZ: number,
    count: number,
    minimumRadius: number,
    maximumRadius: number,
    chunkX: number,
    chunkZ: number,
  ): void {
    const angleOrigin = randomRange(this.randomState, 0, -Math.PI, Math.PI);
    for (let index = 0; index < count; index++) {
      const angle = angleOrigin + index * GOLDEN_ANGLE
        + randomRange(this.randomState, 0, -0.18, 0.18);
      const radius = randomRange(this.randomState, 0, minimumRadius, maximumRadius);
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      if (Math.hypot(x, z) < BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.playerSafeRadius) {
        continue;
      }
      this.spawnRandom(world, prototype, x, z, chunkX, chunkZ);
    }
  }

  private spawnRandom(
    world: BattlefieldEnvironmentWorldState,
    prototype: BattlefieldEnvironmentPrototype,
    x: number,
    z: number,
    chunkX: number,
    chunkZ: number,
  ): void {
    const config = BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG[prototype];
    this.spawnExact(
      world,
      prototype,
      x,
      z,
      randomRange(this.randomState, 0, -Math.PI, Math.PI),
      randomRange(this.randomState, 0, config.minimumScale, config.maximumScale),
      chunkX,
      chunkZ,
    );
  }

  private spawnExact(
    world: BattlefieldEnvironmentWorldState,
    prototype: BattlefieldEnvironmentPrototype,
    x: number,
    z: number,
    heading: number,
    scale: number,
    chunkX: number,
    chunkZ: number,
  ): void {
    const tint = randomRange(this.randomState, 0, 0.88, 1.12);
    const tintBias = randomRange(this.randomState, 0, -0.035, 0.035);
    world.get(prototype).spawn(Object.freeze({
      x,
      y: 0,
      z,
      heading,
      scale,
      seed: this.nextEntitySeed(),
      tintRed: tint + tintBias,
      tintGreen: tint,
      tintBlue: tint - tintBias,
      chunkX,
      chunkZ,
    }));
  }

  private beginChunk(chunkX: number, chunkZ: number): void {
    this.randomState[0] = hashChunkCoordinates(
      chunkX,
      chunkZ,
      BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.seed,
    );
    this.entitySeed = this.randomState[0] ?? 1;
  }

  private nextEntitySeed(): number {
    this.entitySeed = normalizeRandomSeed(this.entitySeed + 0x9e3779b1);
    return this.entitySeed;
  }
}

function hashChunkCoordinates(chunkX: number, chunkZ: number, seed: number): number {
  let value = normalizeRandomSeed(seed)
    ^ Math.imul(chunkX | 0, 0x45d9f3b)
    ^ Math.imul(chunkZ | 0, 0x119de1f3);
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return normalizeRandomSeed(value);
}
