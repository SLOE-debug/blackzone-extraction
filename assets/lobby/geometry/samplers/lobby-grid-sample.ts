/** 大厅 Deformer 原地修改的局部曲面坐标。 */
export interface LobbyLocalSurfacePoint {
  u: number;
  v: number;
  n: number;
}

/** 当前大厅网格采样点的稳定索引与归一化参数。 */
export interface LobbyGridSample {
  readonly column: number;
  readonly row: number;
  readonly columns: number;
  readonly rows: number;
  readonly u01: number;
  readonly v01: number;
  readonly edge: boolean;
}
