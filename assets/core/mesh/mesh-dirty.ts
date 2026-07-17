/** 描述运行时顶点流和包围盒发生变化的位标志。 */
export enum MeshDirty {
  /** 没有任何变化。 */
  None = 0,
  /** 位置顶点流发生变化。 */
  Position = 1 << 0,
  /** 法线顶点流发生变化。 */
  Normal = 1 << 1,
  /** 姿态几何必须成对更新的位置与法线流。 */
  Pose = Position | Normal,
  /** 颜色顶点流发生变化。 */
  Color = 1 << 2,
  /** 模型空间包围盒发生变化。 */
  Bounds = 1 << 3,
  /** 位置、法线和包围盒构成的几何变化。 */
  Geometry = Pose | Bounds,
  /** 所有受运行时管理的数据均需要求值。 */
  All = Geometry | Color,
}
