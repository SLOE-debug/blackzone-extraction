import {
  VANGUARD_MANTLE_CONTROL_BINDING,
  VANGUARD_MATTE_CAGE,
} from './vanguard-model-cage';
import { compileVanguardMeshPlan } from './vanguard-mesh-compiler';
import { VanguardMatteSurface } from './vanguard-surface';

/** 人体、面部、衣物、头发、帽子和披肩使用的已编译哑光计划。 */
export const VANGUARD_MATTE_MESH_PLAN = compileVanguardMeshPlan(
  VANGUARD_MATTE_CAGE,
  VanguardMatteSurface.Count,
  VANGUARD_MANTLE_CONTROL_BINDING,
);

/** 主角单一动态材质层的固定三角面数量。 */
export const VANGUARD_TOTAL_TRIANGLE_COUNT = VANGUARD_MATTE_MESH_PLAN.indexCount / 3;
