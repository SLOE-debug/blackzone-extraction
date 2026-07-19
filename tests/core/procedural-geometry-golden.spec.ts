import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createStaticSurfaceGeometry,
  createSurfaceGeometry,
  GeometryIndexFormat,
  type GeometryIndexArray,
  type SurfaceBufferGeometry,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import { battlefieldGroundGeometry } from '../../assets/bundles/battlefield/geometry/battlefield-ground-geometry';
import { shadeBattlefieldGround } from '../../assets/bundles/battlefield/rendering/battlefield-vertex-shading';
import { prepareBattlefieldEnvironment } from '../../assets/bundles/battlefield/environment/compilation/battlefield-environment-preparation';
import {
  BattlefieldEnvironmentPrototype,
  type BattlefieldEnvironmentPrototype as BattlefieldEnvironmentPrototypeId,
} from '../../assets/bundles/battlefield/environment/catalog/battlefield-environment-catalog';
import { lobbyOpaqueGeometry } from '../../assets/lobby/geometry/lobby-opaque-geometry';
import { lobbyEmissiveGeometry } from '../../assets/lobby/geometry/lobby-emissive-geometry';
import { lobbyVertexShading } from '../../assets/lobby/rendering/lobby-vertex-shading';
import { lobbyEmissiveVertexShading } from '../../assets/lobby/rendering/lobby-emissive-vertex-shading';

const PREPARED_ENVIRONMENT = prepareBattlefieldEnvironment();

type GeometryHashArray = Float32Array | Uint8Array | GeometryIndexArray;

const ENVIRONMENT_GOLDEN_HASHES = Object.freeze({
  [BattlefieldEnvironmentPrototype.DeadTree]: 'c4d3717372f2c2542d01c21de22784dd5afb65aba1fcdcf4e01e50fa1c8dc041',
  [BattlefieldEnvironmentPrototype.LuminousMushroom]: '709ce769ab779efa7b9ffa642bacc7c9189079e3e97cf2586035f9bd2849276f',
  [BattlefieldEnvironmentPrototype.CrystalCluster]: '8aa02b33d7a8b20fba7eff616a1bded0ab091912e5de172498fa39715f732cf6',
  [BattlefieldEnvironmentPrototype.RockFormation]: '08e4cc9125f85e67f88a521f52bc98aa5a83fe9d492570bca75eb25ef5c87d4d',
  [BattlefieldEnvironmentPrototype.VehicleWreck]: 'fccdb4b6d122245ad65f36a7a47f92544dbe004b77a3c10ed77863c62d404d16',
  [BattlefieldEnvironmentPrototype.GlowPlant]: 'f0d584f1cfb2718d4f19ca8c9ada53ed46599dc44e07d82f1963fd82cf155225',
  [BattlefieldEnvironmentPrototype.CorruptedPool]: '5f111dadafa29b16d084b36649bdafc1cab45789d7f794a8f398a54832bb1e83',
  [BattlefieldEnvironmentPrototype.RitualAltar]: '4f5954622bae259dea3daec7d51447e69b2b8a1c4477f8ee6dafe5f95f9d81c7',
}) satisfies Readonly<Record<BattlefieldEnvironmentPrototypeId, string>>;

describe('程序化 Low Poly 几何黄金基线', () => {
  it('锁定大厅不透明合批的完整顶点流和索引', () => {
    const metrics = lobbyOpaqueGeometry.metrics;
    const geometry = createStaticSurfaceGeometry(
      metrics.verticesPerEntity,
      metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    const ranges = lobbyOpaqueGeometry.write(writer);
    writer.commit();
    lobbyVertexShading.update(geometry, ranges);

    expect(hashSurfaceGeometry(geometry))
      .toBe('8033826a738231c7657c6645b38c25a2c590e9a99add7e9f9c096029538a155c');
  });

  it('锁定世界原点战场地面的完整顶点流和索引', () => {
    const metrics = battlefieldGroundGeometry.metrics;
    const geometry = createSurfaceGeometry(
      metrics.verticesPerEntity,
      metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    battlefieldGroundGeometry.write(writer, 0, 0);
    writer.commit();
    shadeBattlefieldGround(geometry, 0, 0);

    expect(hashSurfaceGeometry(geometry))
      .toBe('3a5b9bf3f694cffeedcab30c52702b32a292dc957904de9f32e2519bd9fddc1a');
  });

  it('锁定大厅合批发光面的完整顶点流和索引', () => {
    const metrics = lobbyEmissiveGeometry.metrics;
    const geometry = createStaticSurfaceGeometry(
      metrics.verticesPerEntity,
      metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    const ranges = lobbyEmissiveGeometry.write(writer);
    writer.commit();
    lobbyEmissiveVertexShading.update(geometry, ranges);

    expect(hashSurfaceGeometry(geometry))
      .toBe('375aa7ea5f4c77e0641f838d49a396c00b5324844bb4de87ef2d3c5c278380a6');
  });

  it('锁定全部环境原型的局部流、分面变体和索引', () => {
    for (const prepared of PREPARED_ENVIRONMENT.prototypes) {
      const prototype = prepared.definition.prototype;
      const plan = prepared.plan;
      expect(hashGeometryArrays(
        plan.localPositions,
        plan.localNormals,
        plan.localColors,
        plan.facetVariants,
        plan.indices,
      )).toBe(ENVIRONMENT_GOLDEN_HASHES[prototype]);
    }
  });
});

/** 计算完整表面流与索引的稳定 SHA-256。 */
function hashSurfaceGeometry(geometry: SurfaceBufferGeometry): string {
  return hashGeometryArrays(
    geometry.getPositionView(),
    geometry.getNormalView(),
    geometry.getColorView(),
    geometry.getIndexView(),
  );
}

/** 按显式边界连接多个 TypedArray，避免不同流拼接产生歧义。 */
function hashGeometryArrays(...arrays: readonly GeometryHashArray[]): string {
  const hash = createHash('sha256');
  for (const array of arrays) {
    hash.update(`${array.byteLength}:`);
    hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  return hash.digest('hex');
}
