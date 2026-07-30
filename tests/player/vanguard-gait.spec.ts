import { describe, expect, it } from 'vitest';
import { UNCONSTRAINED_PLANAR_MOVEMENT } from '../../assets/core/contracts/planar-movement-constraint';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import { VANGUARD_ANATOMY } from '../../assets/player/vanguard/model/vanguard-anatomy';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../../assets/player/vanguard/model/vanguard-bone';
import { VanguardGaitPhase } from '../../assets/player/vanguard/model/vanguard-gait-phase';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import { VanguardWeaponAction } from '../../assets/player/vanguard/model/vanguard-weapon-action';
import { VanguardMovementSystem } from '../../assets/player/vanguard/movement/vanguard-movement-system';

describe('主角脚底锁定步态', () => {
  it('支撑期脚踝保持在世界锚点而角色根继续移动', () => {
    const state = new VanguardState(Object.freeze({
      position: Object.freeze({ x: 0, y: 0.05, z: 0 }),
      heading: 0,
      action: VanguardAction.Idle,
    }));
    const movement = new VanguardMovementSystem(UNCONSTRAINED_PLANAR_MOVEMENT);
    const animation = new VanguardAnimationSystem();
    animation.initialize(state);
    state.data.intent.moveZ[0] = 1;

    let observed = 0;
    for (let frame = 0; frame < 120; frame++) {
      movement.update(state, 1 / 60);
      animation.update(state, 1 / 60);
      if ((state.data.animation.locomotionBlend[0] ?? 0) < 0.995
        || (state.data.gait.leftPhase[0] as VanguardGaitPhase)
          !== VanguardGaitPhase.Stance) {
        continue;
      }
      const footOffset = VanguardBone.LeftFoot * VANGUARD_BONE_MATRIX_COMPONENTS;
      const hipOffset = VanguardBone.LeftThigh * VANGUARD_BONE_MATRIX_COMPONENTS;
      const footX = state.data.pose.boneMatrices[footOffset + 9] ?? 0;
      const footZ = state.data.pose.boneMatrices[footOffset + 11] ?? 0;
      const hipX = state.data.pose.boneMatrices[hipOffset + 9] ?? 0;
      const hipY = state.data.pose.boneMatrices[hipOffset + 10] ?? 0;
      const hipZ = state.data.pose.boneMatrices[hipOffset + 11] ?? 0;
      const anchorX = state.data.gait.leftAnchorX[0] ?? 0;
      const anchorZ = state.data.gait.leftAnchorZ[0] ?? 0;
      const footDrift = Math.hypot(
        footX - (state.data.gait.leftAnchorX[0] ?? 0),
        footZ - (state.data.gait.leftAnchorZ[0] ?? 0),
      );
      expect(
        footDrift,
        `第 ${frame} 帧脚底漂移，角色 Z=${state.data.transform.z[0] ?? 0}，`
          + `髋部=(${hipX}, ${hipY}, ${hipZ})，锚点=(${anchorX}, ${anchorZ})`,
      ).toBeLessThan(0.02);
      observed++;
    }
    expect(observed).toBeGreaterThan(10);
    expect(state.data.transform.z[0]).toBeGreaterThan(8);
  });

  it('极限移动中大腿、小腿与脚掌保持连续的人体关节链', () => {
    const state = new VanguardState(Object.freeze({
      position: Object.freeze({ x: 0, y: 0.05, z: 0 }),
      heading: 0,
      action: VanguardAction.Idle,
    }));
    const movement = new VanguardMovementSystem(UNCONSTRAINED_PLANAR_MOVEMENT);
    const animation = new VanguardAnimationSystem();
    animation.initialize(state);
    state.data.intent.moveZ[0] = 1;

    for (let frame = 0; frame < 120; frame++) {
      movement.update(state, 1 / 60);
      animation.update(state, 1 / 60);
      expect(readBoneDistance(state, VanguardBone.LeftThigh, VanguardBone.LeftShin))
        .toBeCloseTo(VANGUARD_ANATOMY.thighLength, 2);
      expect(readBoneDistance(state, VanguardBone.LeftShin, VanguardBone.LeftFoot))
        .toBeCloseTo(VANGUARD_ANATOMY.shinLength, 2);
      expect(readBoneDistance(state, VanguardBone.RightThigh, VanguardBone.RightShin))
        .toBeCloseTo(VANGUARD_ANATOMY.thighLength, 2);
      expect(readBoneDistance(state, VanguardBone.RightShin, VanguardBone.RightFoot))
        .toBeCloseTo(VANGUARD_ANATOMY.shinLength, 2);
    }
  });

  it('横扫锁定对侧支撑脚且砸地同时锁定双脚', () => {
    const state = new VanguardState(Object.freeze({
      position: Object.freeze({ x: 0, y: 0.05, z: 0 }),
      heading: 0,
      action: VanguardAction.Idle,
    }));
    const animation = new VanguardAnimationSystem();
    animation.initialize(state);
    state.data.motion.speed[0] = 5;
    state.data.motion.velocityZ[0] = 5;
    state.data.motion.locomotionForward[0] = 5;
    state.data.intent.weaponAction[0] = VanguardWeaponAction.SwingLeft;
    state.data.intent.weaponActionSide[0] = -1;
    animation.update(state, 0.1);
    expect(state.data.gait.rightPhase[0]).toBe(VanguardGaitPhase.Stance);

    state.data.intent.weaponAction[0] = VanguardWeaponAction.GroundSlam;
    animation.update(state, 0.1);
    expect(state.data.gait.leftPhase[0]).toBe(VanguardGaitPhase.Stance);
    expect(state.data.gait.rightPhase[0]).toBe(VanguardGaitPhase.Stance);
  });
});

function readBoneDistance(
  state: VanguardState,
  from: VanguardBone,
  to: VanguardBone,
): number {
  const fromOffset = from * VANGUARD_BONE_MATRIX_COMPONENTS;
  const toOffset = to * VANGUARD_BONE_MATRIX_COMPONENTS;
  const matrices = state.data.pose.boneMatrices;
  return Math.hypot(
    (matrices[toOffset + 9] ?? 0) - (matrices[fromOffset + 9] ?? 0),
    (matrices[toOffset + 10] ?? 0) - (matrices[fromOffset + 10] ?? 0),
    (matrices[toOffset + 11] ?? 0) - (matrices[fromOffset + 11] ?? 0),
  );
}
