/** 动态实体渲染数据可能发生变化的强类型位标志。 */
export enum EntityRenderDirty {
  None = 0,
  Position = 1 << 0,
  Color = 1 << 1,
  Topology = 1 << 2,
  Parameters = 1 << 3,
  Visibility = 1 << 4,
  Bounds = 1 << 5,
  All = Position | Color | Topology | Parameters | Visibility | Bounds,
}
