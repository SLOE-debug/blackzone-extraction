import { describe, expect, it } from 'vitest';
import {
  sampleVanguardRunFlightAmount,
  sampleVanguardRunFootPitch,
  sampleVanguardRunHipAngle,
  sampleVanguardRunKneeFlexion,
} from '../../assets/player/vanguard/animation/vanguard-run-cycle';

const TAU = Math.PI * 2;

describe('主角连续人体跑步周期', () => {
  it('落地后髋部从前摆转为后伸，膝盖保持柔软而非锁死', () => {
    const touchdownHip = sampleVanguardRunHipAngle(0);
    const touchdownKnee = sampleVanguardRunKneeFlexion(0);
    const toeOffHip = sampleVanguardRunHipAngle(TAU * 0.43);
    const toeOffKnee = sampleVanguardRunKneeFlexion(TAU * 0.43);

    expect(touchdownHip).toBeGreaterThan(0.3);
    expect(touchdownKnee).toBeGreaterThan(0.18);
    expect(toeOffHip).toBeLessThan(-0.28);
    expect(toeOffKnee).toBeGreaterThan(0.18);
  });

  it('摆动中段由膝盖折叠小腿并向前提膝，而不是抬起整条直腿', () => {
    const middleSwingPhase = TAU * 0.7;

    expect(sampleVanguardRunHipAngle(middleSwingPhase)).toBeGreaterThan(0.28);
    expect(sampleVanguardRunKneeFlexion(middleSwingPhase)).toBeGreaterThan(1.75);
    expect(Math.abs(sampleVanguardRunFootPitch(middleSwingPhase))).toBeLessThan(0.05);
  });

  it('只保留很短且柔和的双脚腾空阶段', () => {
    expect(sampleVanguardRunFlightAmount(TAU * 0.25)).toBe(0);
    expect(sampleVanguardRunFlightAmount(TAU * 0.462)).toBeGreaterThan(0.25);
    expect(sampleVanguardRunFlightAmount(TAU * 0.55)).toBe(0);
  });

  it('周期首尾的髋、膝和脚掌角度连续闭合', () => {
    expect(sampleVanguardRunHipAngle(TAU)).toBeCloseTo(sampleVanguardRunHipAngle(0), 8);
    expect(sampleVanguardRunKneeFlexion(TAU)).toBeCloseTo(
      sampleVanguardRunKneeFlexion(0),
      8,
    );
    expect(sampleVanguardRunFootPitch(TAU)).toBeCloseTo(
      sampleVanguardRunFootPitch(0),
      8,
    );
  });
});
