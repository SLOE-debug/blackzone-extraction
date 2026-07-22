/** 数据导向 World 的稳定执行阶段。 */
export enum WorldPhase {
  Input,
  PreSimulation,
  Simulation,
  SpatialIndex,
  Combat,
  PostSimulation,
  RenderPreparation,
  RenderUpload,
  Presentation,
}
