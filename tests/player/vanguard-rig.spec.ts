import { describe, expect, it } from 'vitest';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../../assets/player/vanguard/model/vanguard-bone';
import { VanguardForwardKinematics } from '../../assets/player/vanguard/rigging/vanguard-forward-kinematics';
import { VanguardTwoBoneIkSolver } from '../../assets/player/vanguard/rigging/vanguard-two-bone-ik';
import {
  VANGUARD_QUATERNION_COMPONENTS,
  writeAxisAngleQuaternion,
} from '../../assets/player/vanguard/rigging/vanguard-pose-math';
import {
  VANGUARD_BIND_WORLD_MATRICES,
  VANGUARD_BONE_PARENTS,
  VANGUARD_INVERSE_BIND_MATRICES,
  VANGUARD_LOCAL_POSITION_COMPONENTS,
  writeVanguardBindLocalPose,
} from '../../assets/player/vanguard/rigging/vanguard-rig';

describe('主角标准层级骨架', () => {
  it('父骨骼全部先于子骨骼，并覆盖完整骨骼清单', () => {
    expect(VANGUARD_BONE_PARENTS).toHaveLength(VanguardBone.Count);
    expect(VANGUARD_BONE_PARENTS[VanguardBone.Root]).toBe(-1);
    for (let bone = 1; bone < VanguardBone.Count; bone++) {
      expect(VANGUARD_BONE_PARENTS[bone]).toBeGreaterThanOrEqual(0);
      expect(VANGUARD_BONE_PARENTS[bone]).toBeLessThan(bone);
    }
    expect(VANGUARD_BONE_PARENTS[VanguardBone.LeftToe]).toBe(VanguardBone.LeftFoot);
    expect(VANGUARD_BONE_PARENTS[VanguardBone.WeaponAimRoot]).toBe(
      VanguardBone.VisualRoot,
    );
  });

  it('绑定局部姿态经过 FK 后精确还原绑定世界矩阵', () => {
    const fixture = createPoseFixture();
    fixture.forwardKinematics.writeWorldPose(
      fixture.localPositions,
      fixture.localRotations,
      fixture.matrices,
      0,
      ROOT_TRANSFORM,
    );
    for (let component = 0; component < fixture.matrices.length; component++) {
      expect(fixture.matrices[component]).toBeCloseTo(
        VANGUARD_BIND_WORLD_MATRICES[component] ?? 0,
        5,
      );
    }
  });

  it('每根骨骼的 inverse-bind 会把绑定世界原点还原到局部原点', () => {
    for (let bone = 0; bone < VanguardBone.Count; bone++) {
      const offset = bone * VANGUARD_BONE_MATRIX_COMPONENTS;
      const worldX = VANGUARD_BIND_WORLD_MATRICES[offset + 9] ?? 0;
      const worldY = VANGUARD_BIND_WORLD_MATRICES[offset + 10] ?? 0;
      const worldZ = VANGUARD_BIND_WORLD_MATRICES[offset + 11] ?? 0;
      expect(transformAxis(VANGUARD_INVERSE_BIND_MATRICES, offset, worldX, worldY, worldZ, 0))
        .toBeCloseTo(0, 6);
      expect(transformAxis(VANGUARD_INVERSE_BIND_MATRICES, offset, worldX, worldY, worldZ, 1))
        .toBeCloseTo(0, 6);
      expect(transformAxis(VANGUARD_INVERSE_BIND_MATRICES, offset, worldX, worldY, worldZ, 2))
        .toBeCloseTo(0, 6);
    }
  });

  it('旋转 VisualRoot 会让整条手臂与双腿继承运动', () => {
    const fixture = createPoseFixture();
    const visualRotationOffset = VanguardBone.VisualRoot
      * VANGUARD_QUATERNION_COMPONENTS;
    writeAxisAngleQuaternion(
      fixture.localRotations,
      visualRotationOffset,
      0,
      1,
      0,
      Math.PI * 0.5,
    );
    fixture.forwardKinematics.writeWorldPose(
      fixture.localPositions,
      fixture.localRotations,
      fixture.matrices,
      0,
      ROOT_TRANSFORM,
    );
    for (const bone of [
      VanguardBone.LeftHand,
      VanguardBone.RightHand,
      VanguardBone.LeftFoot,
      VanguardBone.RightFoot,
    ]) {
      const offset = bone * VANGUARD_BONE_MATRIX_COMPONENTS;
      const bindX = VANGUARD_BIND_WORLD_MATRICES[offset + 9] ?? 0;
      const bindY = VANGUARD_BIND_WORLD_MATRICES[offset + 10] ?? 0;
      const bindZ = VANGUARD_BIND_WORLD_MATRICES[offset + 11] ?? 0;
      expect(fixture.matrices[offset + 9]).toBeCloseTo(bindZ, 5);
      expect(fixture.matrices[offset + 10]).toBeCloseTo(bindY, 5);
      expect(fixture.matrices[offset + 11]).toBeCloseTo(-bindX, 5);
    }
  });

  it('实体根朝向、缩放和位移只在 FK 出口统一应用一次', () => {
    const fixture = createPoseFixture();
    fixture.forwardKinematics.writeWorldPose(
      fixture.localPositions,
      fixture.localRotations,
      fixture.matrices,
      0,
      { positionX: 7, positionY: 2, positionZ: -4, heading: Math.PI * 0.5, scale: 2 },
    );
    const headOffset = VanguardBone.Head * VANGUARD_BONE_MATRIX_COMPONENTS;
    const bindX = VANGUARD_BIND_WORLD_MATRICES[headOffset + 9] ?? 0;
    const bindY = VANGUARD_BIND_WORLD_MATRICES[headOffset + 10] ?? 0;
    const bindZ = VANGUARD_BIND_WORLD_MATRICES[headOffset + 11] ?? 0;
    expect(fixture.matrices[headOffset + 9]).toBeCloseTo(7 + bindZ * 2, 5);
    expect(fixture.matrices[headOffset + 10]).toBeCloseTo(2 + bindY * 2, 5);
    expect(fixture.matrices[headOffset + 11]).toBeCloseTo(-4 - bindX * 2, 5);
  });

  it('双骨 IK 在保持腿段长度时把脚踝拉到世界目标', () => {
    const fixture = createPoseFixture();
    fixture.forwardKinematics.writeWorldPose(
      fixture.localPositions,
      fixture.localRotations,
      fixture.matrices,
      0,
      ROOT_TRANSFORM,
    );
    const solver = new VanguardTwoBoneIkSolver(fixture.forwardKinematics);
    const footOffset = VanguardBone.LeftFoot * VANGUARD_BONE_MATRIX_COMPONENTS;
    const targetX = (fixture.matrices[footOffset + 9] ?? 0) - 0.08;
    const targetY = (fixture.matrices[footOffset + 10] ?? 0) + 0.12;
    const targetZ = (fixture.matrices[footOffset + 11] ?? 0) + 0.34;
    solver.solve(
      fixture.localPositions,
      fixture.localRotations,
      fixture.matrices,
      0,
      VanguardBone.LeftThigh,
      VanguardBone.LeftShin,
      VanguardBone.LeftFoot,
      targetX,
      targetY,
      targetZ,
      -0.34,
      0.82,
      0.85,
      1,
      ROOT_TRANSFORM,
    );
    expect(fixture.matrices[footOffset + 9]).toBeCloseTo(targetX, 4);
    expect(fixture.matrices[footOffset + 10]).toBeCloseTo(targetY, 4);
    expect(fixture.matrices[footOffset + 11]).toBeCloseTo(targetZ, 4);
    const thighOffset = VanguardBone.LeftThigh * VANGUARD_BONE_MATRIX_COMPONENTS;
    const shinOffset = VanguardBone.LeftShin * VANGUARD_BONE_MATRIX_COMPONENTS;
    expect(distanceBetween(fixture.matrices, thighOffset, shinOffset)).toBeCloseTo(
      distanceBetween(VANGUARD_BIND_WORLD_MATRICES, thighOffset, shinOffset),
      5,
    );
    expect(distanceBetween(fixture.matrices, shinOffset, footOffset)).toBeCloseTo(
      distanceBetween(VANGUARD_BIND_WORLD_MATRICES, shinOffset, footOffset),
      5,
    );
  });
});

const ROOT_TRANSFORM = Object.freeze({
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  heading: 0,
  scale: 1,
});

function createPoseFixture() {
  const localPositions = new Float32Array(
    VanguardBone.Count * VANGUARD_LOCAL_POSITION_COMPONENTS,
  );
  const localRotations = new Float32Array(
    VanguardBone.Count * VANGUARD_QUATERNION_COMPONENTS,
  );
  writeVanguardBindLocalPose(localPositions, localRotations, 0);
  return {
    localPositions,
    localRotations,
    matrices: new Float32Array(
      VanguardBone.Count * VANGUARD_BONE_MATRIX_COMPONENTS,
    ),
    forwardKinematics: new VanguardForwardKinematics(),
  };
}

function distanceBetween(
  matrices: Readonly<Float32Array> | Readonly<Float64Array>,
  fromOffset: number,
  toOffset: number,
): number {
  return Math.hypot(
    (matrices[toOffset + 9] ?? 0) - (matrices[fromOffset + 9] ?? 0),
    (matrices[toOffset + 10] ?? 0) - (matrices[fromOffset + 10] ?? 0),
    (matrices[toOffset + 11] ?? 0) - (matrices[fromOffset + 11] ?? 0),
  );
}

function transformAxis(
  matrices: Readonly<Float64Array>,
  offset: number,
  x: number,
  y: number,
  z: number,
  axis: number,
): number {
  return (matrices[offset + 9 + axis] ?? 0)
    + (matrices[offset + axis] ?? 0) * x
    + (matrices[offset + 3 + axis] ?? 0) * y
    + (matrices[offset + 6 + axis] ?? 0) * z;
}
