import { VANGUARD_MATTE_CAGE, VANGUARD_METAL_CAGE } from './vanguard-model-cage';
import { compileVanguardMeshPlan } from './vanguard-mesh-compiler';
import { VanguardMatteSurface, VanguardMetalSurface } from './vanguard-surface';

/** 人体、面部、衣物、头发和围巾使用的已编译哑光计划。 */
export const VANGUARD_MATTE_MESH_PLAN = compileVanguardMeshPlan(
  VANGUARD_MATTE_CAGE,
  VanguardMatteSurface.Count,
);

/** 长剑与扣件使用的已编译金属计划。 */
export const VANGUARD_METAL_MESH_PLAN = compileVanguardMeshPlan(
  VANGUARD_METAL_CAGE,
  VanguardMetalSurface.Count,
);

/** 主角两个材质层合计的固定三角面数量。 */
export const VANGUARD_TOTAL_TRIANGLE_COUNT = (VANGUARD_MATTE_MESH_PLAN.indexCount
  + VANGUARD_METAL_MESH_PLAN.indexCount) / 3;
