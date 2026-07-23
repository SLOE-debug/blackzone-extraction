import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_AIM_ASSIST } from '../../assets/bundles/battlefield/combat/battlefield-aim-assist';
import { BattlefieldPlayerAimController } from '../../assets/bundles/battlefield/combat/battlefield-player-aim-controller';
import { VanguardWeaponAction } from '../../assets/player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../assets/player/vanguard/model/vanguard-weapon-pose';

describe('战场射击意图', () => {
  it('只保留六度与十六单位的纵向候选查询范围', () => {
    expect(BATTLEFIELD_AIM_ASSIST.maximumAngleRadians).toBeCloseTo(Math.PI / 30, 12);
    expect(BATTLEFIELD_AIM_ASSIST.maximumDistance).toBe(16);
    expect(Object.keys(BATTLEFIELD_AIM_ASSIST)).toEqual([
      'maximumAngleRadians',
      'maximumDistance',
    ]);
  });

  it('右摇杆未激活时不查询怪物，也不会由左摇杆触发射击', () => {
    const controller = new BattlefieldPlayerAimController();
    const fixture = createAimControllerFixture(false, null);
    const firing = applyController(controller, fixture);
    expect(firing).toBe(false);
    expect(fixture.resolveCalls()).toBe(0);
    expect(fixture.intent()?.aiming).toBe(false);
  });

  it('没有候选怪物时保留手动 XZ，并请求枪口高度的水平射击', () => {
    const controller = new BattlefieldPlayerAimController();
    const fixture = createAimControllerFixture(true, null);
    const firing = applyController(controller, fixture);
    expect(firing).toBe(true);
    expect(fixture.resolveCalls()).toBe(1);
    expect(fixture.fireIntent).toEqual({
      directionX: 1,
      directionZ: 0,
      targetElevation: null,
      targetDistance: null,
    });
    expect(fixture.intent()?.aiming).toBe(true);
    expect(fixture.intent()?.aimPitch).toBe(0);
  });

  it('候选怪物只提供高度和投影距离，绝不修改手动 XZ', () => {
    const controller = new BattlefieldPlayerAimController();
    const fixture = createAimControllerFixture(true, { x: 20, y: 2.1, z: -7 });
    const firing = applyController(controller, fixture);
    expect(firing).toBe(true);
    expect(fixture.fireIntent.directionX).toBe(1);
    expect(fixture.fireIntent.directionZ).toBe(0);
    expect(fixture.fireIntent.targetElevation).toBe(2.1);
    expect(fixture.fireIntent.targetDistance).toBe(8);
    expect(fixture.intent()?.aimX).toBe(1);
    expect(fixture.intent()?.aimZ).toBe(0);
    expect(fixture.intent()?.aimPitch).toBeLessThan(0);
  });
});

function applyController(
  controller: BattlefieldPlayerAimController,
  fixture: ReturnType<typeof createAimControllerFixture>,
): boolean {
  return controller.apply(
    fixture.player,
    fixture.monsters,
    fixture.camera,
    fixture.controls,
    VanguardWeaponPose.Handgun,
    VanguardWeaponAction.Ready,
    0,
    1,
    fixture.fireIntent,
  );
}

function createAimControllerFixture(
  aiming: boolean,
  target: Readonly<{ x: number; y: number; z: number }> | null,
) {
  let latestIntent: Readonly<{
    aiming: boolean;
    aimX: number;
    aimZ: number;
    aimPitch: number;
  }> | null = null;
  let resolveCalls = 0;
  const player = {
    positionX: 12,
    positionY: 3,
    positionZ: -8,
    heading: 0,
    setControlIntent(intent: Readonly<{
      aiming: boolean;
      aimX: number;
      aimZ: number;
      aimPitch: number;
    }>) {
      latestIntent = {
        aiming: intent.aiming,
        aimX: intent.aimX,
        aimZ: intent.aimZ,
        aimPitch: intent.aimPitch,
      };
    },
  };
  const monsters = {
    resolveAimTarget(
      _originX: number,
      _originZ: number,
      _directionX: number,
      _directionZ: number,
      result: { x: number; y: number; z: number },
    ) {
      resolveCalls++;
      if (target === null) {
        return false;
      }
      result.x = target.x;
      result.y = target.y;
      result.z = target.z;
      return true;
    },
  };
  const camera = {
    queueOrbitRotation() {},
    writeWorldPlanarDirection(x: number, y: number, result: { x: number; z: number }) {
      result.x = x;
      result.z = y;
    },
  };
  return {
    player: player as never,
    monsters: monsters as never,
    camera: camera as never,
    controls: Object.freeze({
      moveX: 1,
      moveY: 0,
      aimX: 1,
      aimY: 0,
      aiming,
      cameraOrbitDeltaX: 0,
    }),
    fireIntent: {
      directionX: 0,
      directionZ: 0,
      targetElevation: null,
      targetDistance: null,
    },
    resolveCalls: () => resolveCalls,
    intent: () => latestIntent,
  };
}
