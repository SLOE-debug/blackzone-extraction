import { describe, expect, it } from 'vitest';
import { BattlefieldPlayerAimController } from '../../assets/bundles/battlefield/combat/battlefield-player-aim-controller';
import { VanguardWeaponAction } from '../../assets/player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../assets/player/vanguard/model/vanguard-weapon-pose';

describe('战场射击意图', () => {
  it('右摇杆未激活时不会由左摇杆触发射击', () => {
    const controller = new BattlefieldPlayerAimController();
    const fixture = createAimControllerFixture(false);

    const firing = applyController(controller, fixture);

    expect(firing).toBe(false);
    expect(fixture.intent()?.aiming).toBe(false);
  });

  it('输入阶段只保留手动 XZ，不再查询玩家脚底附近的纵向目标', () => {
    const controller = new BattlefieldPlayerAimController();
    const fixture = createAimControllerFixture(true);

    const firing = applyController(controller, fixture);

    expect(firing).toBe(true);
    expect(fixture.fireDirection).toEqual({
      directionX: 1,
      directionZ: 0,
    });
    expect(fixture.intent()).toMatchObject({
      aiming: true,
      aimX: 1,
      aimZ: 0,
      aimPitch: 0,
    });
  });
});

function applyController(
  controller: BattlefieldPlayerAimController,
  fixture: ReturnType<typeof createAimControllerFixture>,
): boolean {
  return controller.apply(
    fixture.player,
    fixture.camera,
    fixture.controls,
    VanguardWeaponPose.Handgun,
    VanguardWeaponAction.Ready,
    0,
    1,
    fixture.fireDirection,
  );
}

function createAimControllerFixture(aiming: boolean) {
  let latestIntent: Readonly<{
    aiming: boolean;
    aimX: number;
    aimZ: number;
    aimPitch: number;
  }> | null = null;
  const player = {
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
  const camera = {
    queueOrbitRotation() {},
    writeWorldPlanarDirection(x: number, y: number, result: { x: number; z: number }) {
      result.x = x;
      result.z = y;
    },
  };
  return {
    player: player as never,
    camera: camera as never,
    controls: Object.freeze({
      moveX: 1,
      moveY: 0,
      aimX: 1,
      aimY: 0,
      aiming,
      cameraOrbitDeltaX: 0,
    }),
    fireDirection: {
      directionX: 0,
      directionZ: 0,
    },
    intent: () => latestIntent,
  };
}
