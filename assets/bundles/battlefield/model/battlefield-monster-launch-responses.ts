import { type MonsterLaunchResponse } from '../../../core/contracts/monster-effects';
import { BattlefieldMonsterId } from './battlefield-monster-id';

/** 每种普通战场怪物的显式击退与方向腾空响应。 */
export const BATTLEFIELD_MONSTER_LAUNCH_RESPONSES = Object.freeze({
  [BattlefieldMonsterId.CurveCrawler]: Object.freeze({
    launchable: true,
    heightScale: 1,
    horizontalScale: 1,
    knockbackScale: 1,
  }),
  [BattlefieldMonsterId.VenomLobber]: Object.freeze({
    launchable: true,
    heightScale: 0.72,
    horizontalScale: 0.78,
    knockbackScale: 0.58,
  }),
}) satisfies Readonly<Record<BattlefieldMonsterId, Readonly<MonsterLaunchResponse>>>;
