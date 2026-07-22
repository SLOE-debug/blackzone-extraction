import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CurveCrawlerGpuGeometry } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-gpu-geometry';
import { curveCrawlerMeshPlan } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-compiler';
import { CurveCrawlerMeshSemantic } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-plan';
import {
  CURVE_CRAWLER_GPU_POSE_COMPONENT_COUNT,
  CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT,
  CurveCrawlerGpuPoseBuffer,
  CurveCrawlerGpuPoseTexel,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/gpu/curve-crawler-gpu-pose-layout';
import { CurveCrawlerGpuVertexAttribute } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/gpu/curve-crawler-gpu-vertex-layout';
import { createCurveCrawlerMeshTestState } from './mesh-test-fixture';

describe('Curve Crawler GPU 形变数据', () => {
  it('Effect 与 TypeScript 姿态 Texel 宽度及 Position/Normal 同源契约一致', () => {
    const effect = readFileSync(new URL(
      '../../assets/bundles/common-monsters/effects/curve-crawler-gpu.effect',
      import.meta.url,
    ), 'utf8');
    expect(effect).toContain(
      `poseTextureSize: { value: [${CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT},`,
    );
    expect(effect).toContain('in vec3 a_normal;');
    expect(effect).toContain(`in vec4 ${CurveCrawlerGpuVertexAttribute.Deformation};`);
    expect(effect).toContain(`in vec4 ${CurveCrawlerGpuVertexAttribute.DeformationPivot};`);
    expect(effect).toContain('v_worldNormal = normalize');
    expect(effect).toContain('texture(poseTexture, uv)');
    expect(effect).not.toMatch(/\bflat\s+(?:in|out)\b/);
  });

  it('把每实体 SoA 姿态压入固定 RGBA32F Texel 行', () => {
    const state = createCurveCrawlerMeshTestState(1);
    state.data.transform.x[0] = 14;
    state.data.transform.y[0] = -9;
    state.data.animation.phase[0] = 1.25;
    state.data.animation.hitFlash[0] = 0.65;
    state.data.animation.fragmentOffsetZ[3] = 2.75;
    state.data.animation.fragmentRotation[3] = -0.4;
    const buffer = new CurveCrawlerGpuPoseBuffer();
    buffer.resize(3);
    buffer.begin();
    buffer.writeState(state, 1);

    expect(buffer.data).toHaveLength(
      3 * CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT * CURVE_CRAWLER_GPU_POSE_COMPONENT_COUNT,
    );
    expect(readTexel(buffer.data, 0, CurveCrawlerGpuPoseTexel.Transform))
      .toEqual([0, 0, 0, 0]);
    expect(readTexel(buffer.data, 1, CurveCrawlerGpuPoseTexel.Transform))
      .toEqual([14, -9, 1, 0]);
    expect(readTexel(buffer.data, 1, CurveCrawlerGpuPoseTexel.AnimationPrimary)[0])
      .toBeCloseTo(1.25, 6);
    expect(readTexel(buffer.data, 1, CurveCrawlerGpuPoseTexel.AnimationSecondary)[3])
      .toBeCloseTo(0.65, 6);
    expect(readTexel(buffer.data, 1, CurveCrawlerGpuPoseTexel.FragmentFirst + 3))
      .toEqual([0, 0, 2.75, -0.4000000059604645]);
  });

  it('只在结构创建时生成完整局部 Bind Pose 与 GPU 变形元数据', () => {
    const state = createCurveCrawlerMeshTestState(1);
    const geometry = new CurveCrawlerGpuGeometry(
      2,
      curveCrawlerMeshPlan,
      [{ state, gpuSlotOffset: 1 }],
    );
    const firstEntityVertex = curveCrawlerMeshPlan.vertexCount;
    const firstPosition = firstEntityVertex * 3;
    const firstUv = firstEntityVertex * 2;

    expect(Array.from(geometry.positions.subarray(0, firstPosition)))
      .toEqual(Array.from(new Float32Array(firstPosition)));
    expect(Array.from(geometry.positions.subarray(firstPosition)).every(Number.isFinite))
      .toBe(true);
    expect(Array.from(geometry.normals.subarray(firstPosition)).every(Number.isFinite))
      .toBe(true);
    for (let vertex = firstEntityVertex; vertex < geometry.vertexCount; vertex++) {
      const offset = vertex * 3;
      const length = Math.hypot(
        geometry.normals[offset] ?? 0,
        geometry.normals[offset + 1] ?? 0,
        geometry.normals[offset + 2] ?? 0,
      );
      expect(length).toBeCloseTo(1, 4);
    }
    expect(geometry.slotAndSemantic[firstUv]).toBe(1);
    expect(geometry.slotAndSemantic[firstUv + 1]).toBe(CurveCrawlerMeshSemantic.Leg);
    const liquidUv = (firstEntityVertex + curveCrawlerMeshPlan.liquid.vertexOffset) * 2;
    expect(geometry.slotAndSemantic[liquidUv + 1]).toBe(CurveCrawlerMeshSemantic.Liquid);
    const eggUv = (
      firstEntityVertex
      + curveCrawlerMeshPlan.emergence.vertexOffset
      + curveCrawlerMeshPlan.emergence.eggVertexOffset
    ) * 2;
    expect(geometry.slotAndSemantic[eggUv + 1]).toBe(CurveCrawlerMeshSemantic.EmergenceEgg);
    expect(Array.from(geometry.colors.subarray(firstEntityVertex * 4)).every(Number.isFinite))
      .toBe(true);
  });
});

function readTexel(
  source: Float32Array,
  gpuSlot: number,
  texel: number,
): number[] {
  const offset = (gpuSlot * CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT + texel)
    * CURVE_CRAWLER_GPU_POSE_COMPONENT_COUNT;
  return Array.from(source.subarray(offset, offset + CURVE_CRAWLER_GPU_POSE_COMPONENT_COUNT));
}
