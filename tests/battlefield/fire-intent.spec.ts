import { describe, expect, it } from 'vitest';
import {
  BATTLEFIELD_AIM_ASSIST,
  writeSoftAimDirection,
} from '../../assets/bundles/battlefield/combat/battlefield-aim-assist';
import { BattlefieldPlayerAimController } from '../../assets/bundles/battlefield/combat/battlefield-player-aim-controller';
import { VanguardWeaponAction } from '../../assets/player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../assets/player/vanguard/model/vanguard-weapon-pose';

describe('战场轻度辅助瞄准', () => {
  it('使用敲定的六度、十六单位和三成修正参数', () => {
    expect(BATTLEFIELD_AIM_ASSIST.maximumAngleRadians).toBeCloseTo(Math.PI / 30, 8);
    expect(BATTLEFIELD_AIM_ASSIST.maximumDistance).toBe(16);
    expect(BATTLEFIELD_AIM_ASSIST.correctionWeight).toBe(0.3);
    expect(BATTLEFIELD_AIM_ASSIST.freeAimDistance).toBe(32);
  });

  it('目标方向只占三成权重并重新归一化', () => {
    const result = { x: 0, z: 0 };
    writeSoftAimDirection(0, 1, 1, 0, result);
    expect(result.x).toBeCloseTo(0.393919, 5);
    expect(result.z).toBeCloseTo(0.919145, 5);
  });

  it('右摇杆未激活时不查询怪物，也不会由左摇杆触发射击', () => {
    const controller = new BattlefieldPlayerAimController();
    const fixture = createAimControllerFixture(false);
    const firing = controller.apply(
      fixture.player,
      fixture.monsters,
      fixture.camera,
      fixture.controls,
      VanguardWeaponPose.Handgun,
      VanguardWeaponAction.Ready,
      0,
      1,
      fixture.fireTarget,
    );
    expect(firing).toBe(false);
    expect(fixture.resolveCalls()).toBe(0);
    expect(fixture.intent()?.aiming).toBe(false);
  });

  it('右摇杆激活但没有目标时仍沿手动方向自由射击', () => {
    const controller = new BattlefieldPlayerAimController();
    const fixture = createAimControllerFixture(true);
    const firing = controller.apply(
      fixture.player,
      fixture.monsters,
      fixture.camera,
      fixture.controls,
      VanguardWeaponPose.Handgun,
      VanguardWeaponAction.Ready,
      0,
      1,
      fixture.fireTarget,
    );
    expect(firing).toBe(true);
    expect(fixture.resolveCalls()).toBe(1);
    expect(fixture.fireTarget).toEqual({ x: 44, y: 5.35, z: -8 });
    expect(fixture.intent()?.aiming).toBe(true);
  });
});

function createAimControllerFixture(aiming: boolean) {
  let latestIntent: Readonly<{ aiming: boolean }> | null = null;
  let resolveCalls = 0;
  const player = {
    positionX: 12,
    positionY: 3,
    positionZ: -8,
    heading: 0,
    setControlIntent(intent: Readonly<{ aiming: boolean }>) {
      latestIntent = { ...intent };
    },
  };
  const monsters = {
    resolveAimTarget() {
      resolveCalls++;
      return false;
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
    fireTarget: { x: 0, y: 0, z: 0 },
    resolveCalls: () => resolveCalls,
    intent: () => latestIntent,
  };
}
