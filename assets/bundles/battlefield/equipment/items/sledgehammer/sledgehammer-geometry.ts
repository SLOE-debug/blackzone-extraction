import { PrebakedFacetedMeshSink } from '../../../../../core/geometry/faceted/prebaked-facet-color';
import { appendSledgehammerHandle } from './sledgehammer-handle-geometry';
import { appendSledgehammerHead } from './sledgehammer-head-geometry';

/** 编译错心木柄、矿钢护环和多层破岩锤头组成的程序化裂岩大锤。 */
export function createSledgehammerGeometry() {
  const sink = new PrebakedFacetedMeshSink();
  appendSledgehammerHandle(sink);
  appendSledgehammerHead(sink);
  return sink.build();
}

/** 模块级复用的大锤固定拓扑。 */
export const SLEDGEHAMMER_GEOMETRY = createSledgehammerGeometry();
