import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { damp, dampAngle } from '../../../../../core/math/scalar';
import { type VenomLobberState } from '../model/venom-lobber-state';

/** 按连续 SoA 流推进 Venom Lobber 的速度、朝向和位移。 */
export class VenomLobberMovementSystem implements EntitySystem<VenomLobberState, number> {
  public update(state: VenomLobberState, deltaTime: number): void {
    const { transform, vitality, intent, motion } = state.data;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        motion.currentSpeed[index] = 0;
        continue;
      }
      const speed = damp(
        motion.currentSpeed[index] ?? 0,
        intent.targetSpeed[index] ?? 0,
        6.5,
        deltaTime,
      );
      const heading = dampAngle(
        transform.heading[index] ?? 0,
        transform.targetHeading[index] ?? 0,
        intent.turnRate[index] ?? 2.8,
        deltaTime,
      );
      motion.currentSpeed[index] = speed;
      transform.heading[index] = heading;
      transform.x[index] = (transform.x[index] ?? 0) + Math.cos(heading) * speed * deltaTime;
      transform.y[index] = (transform.y[index] ?? 0) + Math.sin(heading) * speed * deltaTime;
    }
  }
}
