import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { type FixedTopologyMetrics } from '../../../core/geometry/fixed-topology';
import {
  emitSampledFlatGrid,
  sampleFlatGrid,
} from '../../../core/geometry/grid/flat-grid-emitter';
import {
  compileFlatGridPlan,
  FlatGridDiagonalKind,
  type FlatGridPlan,
  FlatGridWinding,
  getFlatGridTopologyMetrics,
  PRIMARY_FIRST_FLAT_GRID_TRIANGLE_ORDER,
} from '../../../core/geometry/grid/flat-grid-plan';
import {
  createFlatGridWorkspace,
  type FlatGridWorkspace,
  FlatGridWorkspacePrecision,
} from '../../../core/geometry/grid/flat-grid-workspace';
import {
  defineSurfaceFrame,
  type SurfaceFrame,
} from '../../../core/geometry/grid/surface-frame';
import { LOBBY_LAYOUT } from '../../model/lobby-layout';
import {
  LobbySurfaceNormalDeformation,
  type LobbySurfaceDeformationContext,
} from '../deformers/lobby-surface-deformer';
import {
  type LobbyGridSamplerContext,
  lobbyGridSampler,
} from '../samplers/lobby-grid-sampler';

/** 大厅壳体中由统一 Grid Patch 发射器生成的曲面标识。 */
export enum LobbyHallSurfaceId {
  Floor = 'floor',
  Ceiling = 'ceiling',
  FrontWall = 'front-wall',
  LeftWall = 'left-wall',
  RightWall = 'right-wall',
}

interface LobbyHallSurfaceRecipe {
  readonly plan: Readonly<FlatGridPlan>;
  readonly workspace: Readonly<FlatGridWorkspace>;
  readonly sampleContext: Readonly<LobbyGridSamplerContext>;
}

const FLOOR_FRAME = defineSurfaceFrame({
  originX: -LOBBY_LAYOUT.hallHalfWidth,
  originY: 0,
  originZ: -LOBBY_LAYOUT.hallHalfDepth,
  ux: 1, uy: 0, uz: 0,
  vx: 0, vy: 0, vz: 1,
  nx: 0, ny: 1, nz: 0,
});

const CEILING_FRAME = defineSurfaceFrame({
  originX: -LOBBY_LAYOUT.hallHalfWidth,
  originY: LOBBY_LAYOUT.hallHeight,
  originZ: -LOBBY_LAYOUT.hallHalfDepth,
  ux: 1, uy: 0, uz: 0,
  vx: 0, vy: 0, vz: 1,
  nx: 0, ny: -1, nz: 0,
});

const FRONT_WALL_FRAME = defineSurfaceFrame({
  originX: -LOBBY_LAYOUT.hallHalfWidth,
  originY: 0,
  originZ: LOBBY_LAYOUT.hallHalfDepth,
  ux: 1, uy: 0, uz: 0,
  vx: 0, vy: 1, vz: 0,
  nx: 0, ny: 0, nz: -1,
});

const LEFT_WALL_FRAME = defineSurfaceFrame({
  originX: -LOBBY_LAYOUT.hallHalfWidth,
  originY: 0,
  originZ: -LOBBY_LAYOUT.hallHalfDepth,
  ux: 0, uy: 0, uz: 1,
  vx: 0, vy: 1, vz: 0,
  nx: 1, ny: 0, nz: 0,
});

const RIGHT_WALL_FRAME = defineSurfaceFrame({
  originX: LOBBY_LAYOUT.hallHalfWidth,
  originY: 0,
  originZ: -LOBBY_LAYOUT.hallHalfDepth,
  ux: 0, uy: 0, uz: 1,
  vx: 0, vy: 1, vz: 0,
  nx: -1, ny: 0, nz: 0,
});

const LOBBY_HALL_SURFACE_RECIPES = Object.freeze({
  [LobbyHallSurfaceId.Floor]: createRecipe({
    columns: 6,
    rows: 7,
    width: LOBBY_LAYOUT.hallHalfWidth * 2,
    height: LOBBY_LAYOUT.hallHalfDepth * 2,
    frame: FLOOR_FRAME,
    diagonalOffset: 0,
    winding: FlatGridWinding.Reverse,
    context: createJitterContext(11, 0, 0.07, 2, 0.07, 1, 0.025),
  }),
  [LobbyHallSurfaceId.Ceiling]: createRecipe({
    columns: 10,
    rows: 7,
    width: LOBBY_LAYOUT.hallHalfWidth * 2,
    height: LOBBY_LAYOUT.hallHalfDepth * 2,
    frame: CEILING_FRAME,
    diagonalOffset: 0,
    winding: FlatGridWinding.Forward,
    context: createCaveContext(23, 0, 0.18, 2, 0.18, 0.68),
  }),
  [LobbyHallSurfaceId.FrontWall]: createRecipe({
    columns: 10,
    rows: 7,
    width: LOBBY_LAYOUT.hallHalfWidth * 2,
    height: LOBBY_LAYOUT.hallHeight,
    frame: FRONT_WALL_FRAME,
    diagonalOffset: 1,
    winding: FlatGridWinding.Reverse,
    context: createCaveContext(41, 0, 0.18, 1, 0.12, 0.2),
  }),
  [LobbyHallSurfaceId.LeftWall]: createRecipe({
    columns: 12,
    rows: 7,
    width: LOBBY_LAYOUT.hallHalfDepth * 2,
    height: LOBBY_LAYOUT.hallHeight,
    frame: LEFT_WALL_FRAME,
    diagonalOffset: 0,
    winding: FlatGridWinding.Reverse,
    context: createCaveContext(53, 2, 0.18, 1, 0.12, 1.45),
  }),
  [LobbyHallSurfaceId.RightWall]: createRecipe({
    columns: 12,
    rows: 7,
    width: LOBBY_LAYOUT.hallHalfDepth * 2,
    height: LOBBY_LAYOUT.hallHeight,
    frame: RIGHT_WALL_FRAME,
    diagonalOffset: 0,
    winding: FlatGridWinding.Forward,
    context: createCaveContext(61, 2, 0.18, 1, 0.12, 1.45),
  }),
}) satisfies Readonly<Record<LobbyHallSurfaceId, LobbyHallSurfaceRecipe>>;

/** 根据类型化壳体清单写入单个大厅曲面。 */
export function writeLobbyHallSurface(
  writer: TriangleMeshWriter,
  surface: LobbyHallSurfaceId,
): void {
  const recipe = LOBBY_HALL_SURFACE_RECIPES[surface];
  sampleFlatGrid(recipe.plan, lobbyGridSampler, recipe.sampleContext, recipe.workspace);
  emitSampledFlatGrid(recipe.plan, recipe.workspace, writer, undefined);
}

/** 根据大厅壳体 Recipe 返回对应 Flat Grid 的固定拓扑容量。 */
export function getLobbyHallSurfaceMetrics(
  surface: LobbyHallSurfaceId,
): FixedTopologyMetrics {
  return getFlatGridTopologyMetrics(LOBBY_HALL_SURFACE_RECIPES[surface].plan);
}

interface RecipeOptions {
  readonly columns: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
  readonly frame: Readonly<SurfaceFrame>;
  readonly diagonalOffset: 0 | 1;
  readonly winding: FlatGridWinding;
  readonly context: Readonly<LobbySurfaceDeformationContext>;
}

/** 创建冻结后的大厅曲面 Recipe。 */
function createRecipe(options: Readonly<RecipeOptions>): LobbyHallSurfaceRecipe {
  const plan = compileFlatGridPlan({
    columns: options.columns,
    rows: options.rows,
    diagonal: Object.freeze({
      kind: FlatGridDiagonalKind.Alternating,
      parityOffset: options.diagonalOffset,
    }),
    winding: options.winding,
    triangleOrder: PRIMARY_FIRST_FLAT_GRID_TRIANGLE_ORDER,
  });
  return Object.freeze({
    plan,
    workspace: createFlatGridWorkspace(plan, FlatGridWorkspacePrecision.Float64),
    sampleContext: Object.freeze({
      columns: options.columns,
      rows: options.rows,
      width: options.width,
      height: options.height,
      frame: options.frame,
      deformation: options.context,
    }),
  });
}

/** 创建轻微法向起伏曲面的固定形变上下文。 */
function createJitterContext(
  seed: number,
  uSeedOffset: number,
  uAmplitude: number,
  vSeedOffset: number,
  vAmplitude: number,
  normalSeedOffset: number,
  normalAmplitude: number,
): LobbySurfaceDeformationContext {
  return Object.freeze({
    seed,
    uJitter: Object.freeze({ seedOffset: uSeedOffset, amplitude: uAmplitude }),
    vJitter: Object.freeze({ seedOffset: vSeedOffset, amplitude: vAmplitude }),
    normal: Object.freeze({
      kind: LobbySurfaceNormalDeformation.Jitter,
      seedOffset: normalSeedOffset,
      amplitude: normalAmplitude,
    }),
  });
}

/** 创建洞穴隆起曲面的固定形变上下文。 */
function createCaveContext(
  seed: number,
  uSeedOffset: number,
  uAmplitude: number,
  vSeedOffset: number,
  vAmplitude: number,
  reliefScale: number,
): LobbySurfaceDeformationContext {
  return Object.freeze({
    seed,
    uJitter: Object.freeze({ seedOffset: uSeedOffset, amplitude: uAmplitude }),
    vJitter: Object.freeze({ seedOffset: vSeedOffset, amplitude: vAmplitude }),
    normal: Object.freeze({
      kind: LobbySurfaceNormalDeformation.CaveRelief,
      scale: reliefScale,
    }),
  });
}
