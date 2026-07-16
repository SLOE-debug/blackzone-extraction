import { describe, expect, it } from 'vitest';
import { createEntityRange } from '../../assets/core/entities/entity-range';
import {
  createSurfaceGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import { vanguardOpaqueGeometry } from '../../assets/player/vanguard/geometry/vanguard-opaque-geometry';
import { vanguardSensorGeometry } from '../../assets/player/vanguard/geometry/vanguard-sensor-geometry';
import {
  VANGUARD_ARMOR_VERTEX_COUNT,
  VANGUARD_PANEL_VERTEX_COUNT,
} from '../../assets/player/vanguard/geometry/vanguard-topology';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import { type VanguardPopulationOptions } from '../../assets/player/vanguard/model/vanguard-options';
import { VanguardJoint } from '../../assets/player/vanguard/model/vanguard-schema';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import {
  vanguardOpaqueVertexShading,
  vanguardSensorVertexShading,
} from '../../assets/player/vanguard/rendering/vanguard-vertex-shading';

const TEST_BASE_Y = 0.72;
const TEST_FOCUS_Z = -2;
const TEST_OPTIONS = Object.freeze({
  position: Object.freeze({ x: 0, y: TEST_BASE_Y, z: TEST_FOCUS_Z }),
  heading: 0,
  action: VanguardAction.WalkWithHandgun,
  walkSpeed: 1.05,
  weaponReady: 1,
}) satisfies VanguardPopulationOptions;

describe('可复用主角程序化模型', () => {
  it('保持长腿、窄腰、小头和宽肩的战术机甲比例', () => {
    const fixture = createVanguardFixture();
    const { transform, joints } = fixture.state.data;
    const baseY = transform.y[0] ?? 0;
    const headTopY = getJoint(joints.y, VanguardJoint.HeadTop);
    const neckY = getJoint(joints.y, VanguardJoint.Neck);
    const leftShoulderX = getJoint(joints.x, VanguardJoint.LeftShoulderOuter);
    const rightShoulderX = getJoint(joints.x, VanguardJoint.RightShoulderOuter);
    const totalHeight = headTopY - baseY;
    const headRatio = (headTopY - neckY) / totalHeight;

    expect(baseY).toBeCloseTo(TEST_BASE_Y);
    expect(totalHeight).toBeGreaterThan(4.25);
    expect(headRatio).toBeLessThan(0.18);
    expect(rightShoulderX - leftShoulderX).toBeGreaterThan(1.8);
  });

  it('双腿反相迈步且双手保持手枪前指姿势', () => {
    const fixture = createVanguardFixture();
    const beforeLeftAnkleZ = getJoint(fixture.state.data.joints.z, VanguardJoint.LeftAnkle);
    const beforeRightAnkleZ = getJoint(fixture.state.data.joints.z, VanguardJoint.RightAnkle);

    fixture.animation.update(fixture.state, 0.16);

    const joints = fixture.state.data.joints;
    const leftAnkleZ = getJoint(joints.z, VanguardJoint.LeftAnkle);
    const rightAnkleZ = getJoint(joints.z, VanguardJoint.RightAnkle);
    const weaponRearX = getJoint(joints.x, VanguardJoint.WeaponRear);
    const weaponFrontX = getJoint(joints.x, VanguardJoint.WeaponFront);
    const weaponFrontZ = getJoint(joints.z, VanguardJoint.WeaponFront);
    const weaponMuzzleZ = getJoint(joints.z, VanguardJoint.WeaponMuzzle);
    const leftPalmZ = getJoint(joints.z, VanguardJoint.LeftPalmEnd);
    const rightPalmZ = getJoint(joints.z, VanguardJoint.RightPalmEnd);
    const weaponRearZ = getJoint(joints.z, VanguardJoint.WeaponRear);

    expect(leftAnkleZ).not.toBeCloseTo(beforeLeftAnkleZ);
    expect(rightAnkleZ).not.toBeCloseTo(beforeRightAnkleZ);
    expect(leftAnkleZ - TEST_FOCUS_Z).toBeGreaterThan(0);
    expect(rightAnkleZ - TEST_FOCUS_Z).toBeLessThan(0);
    expect(Math.abs(weaponFrontX - weaponRearX)).toBeLessThan(0.02);
    expect(weaponMuzzleZ - weaponFrontZ).toBeGreaterThan(0.14);
    expect(Math.abs(leftPalmZ - weaponRearZ)).toBeLessThan(0.03);
    expect(Math.abs(rightPalmZ - weaponRearZ)).toBeLessThan(0.03);
  });

  it('装甲和传感器保持固定拓扑、单位分面法线与语义颜色区段', () => {
    const fixture = createVanguardFixture();
    const range = createEntityRange(0, fixture.state.count, fixture.state.count);
    const opaque = createSurfaceGeometry(
      vanguardOpaqueGeometry.metrics.verticesPerEntity,
      vanguardOpaqueGeometry.metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const opaqueWriter = new TriangleMeshWriter(opaque);
    opaqueWriter.reset(true);
    vanguardOpaqueGeometry.write(opaqueWriter, fixture.state, range);
    opaqueWriter.commit();
    vanguardOpaqueVertexShading.update(opaque, fixture.state, range);

    expect(opaque.vertexCount).toBe(vanguardOpaqueGeometry.metrics.verticesPerEntity);
    expect(opaque.indexCount).toBe(vanguardOpaqueGeometry.metrics.indicesPerEntity);
    expectUnitNormals(opaque.normals, opaque.vertexCount);
    expect(getMinimumY(opaque.positions, opaque.vertexCount)).toBeGreaterThan(
      TEST_BASE_Y - 0.03,
    );
    const armorColor = 0;
    const panelColor = VANGUARD_ARMOR_VERTEX_COUNT * 4;
    const weaponColor = (VANGUARD_ARMOR_VERTEX_COUNT + VANGUARD_PANEL_VERTEX_COUNT) * 4;
    expect(opaque.colors[panelColor] ?? 1).toBeLessThan(opaque.colors[armorColor] ?? 0);
    expect(opaque.colors[weaponColor] ?? 1).toBeLessThan(opaque.colors[panelColor] ?? 0);
    expectBlackNeutralColor(opaque.colors, armorColor);
    expectBlackNeutralColor(opaque.colors, panelColor);

    const sensor = createSurfaceGeometry(
      vanguardSensorGeometry.metrics.verticesPerEntity,
      vanguardSensorGeometry.metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const sensorWriter = new TriangleMeshWriter(sensor);
    sensorWriter.reset(true);
    vanguardSensorGeometry.write(sensorWriter, fixture.state, range);
    sensorWriter.commit();
    vanguardSensorVertexShading.update(sensor, fixture.state, range);
    expect(sensor.colors[0] ?? 0).toBeGreaterThan(0.8);
    expect(Math.abs((sensor.colors[0] ?? 0) - (sensor.colors[2] ?? 0))).toBeLessThan(0.03);
  });
});

/** 创建完成初始关节姿态的单实体主角夹具。 */
function createVanguardFixture(): {
  readonly state: VanguardState;
  readonly animation: VanguardAnimationSystem;
} {
  const state = new VanguardState(TEST_OPTIONS);
  const animation = new VanguardAnimationSystem();
  animation.initialize(state);
  return { state, animation };
}

/** 验证装甲颜色保持接近中性的黑灰，不出现红色主导。 */
function expectBlackNeutralColor(colors: Float32Array, colorOffset: number): void {
  const red = colors[colorOffset] ?? 0;
  const green = colors[colorOffset + 1] ?? 0;
  const blue = colors[colorOffset + 2] ?? 0;
  expect(Math.abs(red - green)).toBeLessThan(0.03);
  expect(Math.abs(green - blue)).toBeLessThan(0.03);
}

/** 读取单实体关节分量。 */
function getJoint(values: Float32Array, joint: VanguardJoint): number {
  return values[joint] ?? 0;
}

/** 验证全部硬分面顶点法线保持单位长度。 */
function expectUnitNormals(normals: Float32Array, vertexCount: number): void {
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const offset = vertex * 3;
    const length = Math.hypot(
      normals[offset] ?? 0,
      normals[offset + 1] ?? 0,
      normals[offset + 2] ?? 0,
    );
    expect(length).toBeCloseTo(1, 5);
  }
}

/** 返回有效顶点中的最低世界高度。 */
function getMinimumY(positions: Float32Array, vertexCount: number): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    minimum = Math.min(minimum, positions[vertex * 3 + 1] ?? 0);
  }
  return minimum;
}
