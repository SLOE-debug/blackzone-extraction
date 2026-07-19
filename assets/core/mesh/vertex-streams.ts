import {
  type GeometryIndexArray,
  type VertexLayoutBufferGeometry,
} from '../geometry/buffer-geometry';
import {
  type LitColorVertexSemantic,
  type VertexSemantic,
  type VertexStreams as LayoutVertexStreams,
} from './vertex-layout';

/** 精确包含指定布局语义的运行时 SoA 顶点流视图。 */
export type VertexStreams<
  TSemantics extends VertexSemantic = LitColorVertexSemantic,
> = LayoutVertexStreams<TSemantics>;

/**
 * 从已经提交有效计数的布局几何创建运行时顶点流视图。
 *
 * @param geometry 提供布局和底层强类型缓冲的几何。
 * @returns 与几何有效顶点范围共享底层 ArrayBuffer 的精确流集合。
 */
export function createVertexStreams<
  TSemantics extends VertexSemantic,
  TIndex extends GeometryIndexArray,
>(
  geometry: VertexLayoutBufferGeometry<TSemantics, TIndex>,
): VertexStreams<TSemantics> {
  const streams: Partial<Record<VertexSemantic, Float32Array>> = {};
  for (const semantic of geometry.layout.semantics) {
    streams[semantic] = geometry.getStreamView(semantic);
  }
  return Object.freeze(streams) as VertexStreams<TSemantics>;
}
