import { type BattlefieldCombatModuleId } from './battlefield-combat-module';

/** Input 阶段生成、ActionExecution 阶段消费的模块意图。 */
export interface BattlefieldCombatModuleIntent {
  moduleId: BattlefieldCombatModuleId;
  active: boolean;
  released: boolean;
  directionX: number;
  directionZ: number;
  amplitude: number;
}

/** 行为模块计算携带姿态时只读取的玩家权威世界状态。 */
export interface BattlefieldActionPlayerPose {
  x: number;
  y: number;
  z: number;
  heading: number;
  alive: boolean;
}
